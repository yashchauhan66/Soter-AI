#!/usr/bin/env python3
"""HONEST 3-way v14 vs v17ctrl vs v17cand. Part 1/3: helpers."""
import json, random, sys, time
from pathlib import Path
import numpy as np
ROOT = Path(__file__).resolve().parents[2]
ARMS = [("v14", "models/ml-classifier-v14"),
        ("v17-control-minilm", "models/ml-classifier-v17-minilm"),
        ("v17-candidate-mdistilbert", "models/ml-classifier-v17")]
EVAL_FILES = ["datasets/crossdist-eval-v3-complement.jsonl",
              "datasets/external-real-v1.jsonl",
              "datasets/external-real-v2.jsonl",
              "datasets/external-real-v3.jsonl",
              "datasets/v15-test-battery.jsonl",
              "datasets/v16-probe-battery.jsonl",
              "datasets/v17-multilingual-battery.jsonl"]
ATTACK_TARGET = 10000
SEED = 20260913
# Strip the [PAD] tail before each forward pass. Proven decision-identical (see
# the DYNPAD note in the scoring loop); set SOTER_DYNPAD=0 to restore pad-to-256.
import os
DYNPAD = os.environ.get("SOTER_DYNPAD", "1") != "0"
def load_jsonl(f):
    out = []
    for line in open(f, encoding="utf-8").read().split("\n"):
        line = line.strip()
        if not line: continue
        try:
            o = json.loads(line)
            if isinstance(o.get("text"), str) and isinstance(o.get("label"), str): out.append(o)
        except Exception: pass
    return out
def softmax(x):
    x = np.asarray(x, dtype=np.float64); x -= x.max(); e = np.exp(x); return e / e.sum()
def mcnemar(b, c):
    n = b + c
    if n == 0: return 1.0
    k = min(b, c)
    cur, tail = 1.0, 0.0
    h = 0.5 ** n
    for i in range(n + 1):
        if i <= k or i >= n - k: tail += cur * h
        cur = cur * (n - i) / (i + 1)
    return min(1.0, tail)

class BertTok:
    def __init__(self, vocab, do_lower=True, strip_acc=None, tok_cjk=True, max_len=256):
        self.v = vocab; self.do_lower = do_lower
        self.strip = strip_acc if strip_acc is not None else do_lower
        self.cjk = tok_cjk; self.max_len = max_len
        import unicodedata
        self.ud = unicodedata
        self.unk = vocab.get("[UNK]", 100)
    def basic(self, text):
        if self.do_lower:
            text = text.lower()
            if self.strip: text = "".join(c for c in self.ud.normalize("NFD", text) if self.ud.category(c) != "Mn")
        toks = []
        for tok in text.strip().split():
            if self.cjk:
                buf = ""
                for ch in tok:
                    cp = ord(ch)
                    if (0x4E00 <= cp <= 0x9FFF) or (0x3400 <= cp <= 0x4DBF) or (0x20000 <= cp <= 0x2A6DF) or (0xF900 <= cp <= 0xFAFF):
                        if buf: toks.append(buf); buf = ""
                        toks.append(ch)
                    else: buf += ch
                if buf: toks.append(buf)
            else: toks.append(tok)
        out = []
        for tok in toks:
            cur = ""
            for ch in tok:
                import unicodedata as u
                cat = u.category(ch); o = ord(ch)
                if ch in ("\t", "\n", "\r", " ") or cat.startswith("Z"):
                    if cur: out.append(cur); cur = ""
                elif cat.startswith("C"):
                    # HF _clean_text REMOVES control chars (Cf/Cc like U+200B) without
                    # splitting the word — it does not tokenize them as a separator.
                    continue
                elif cat.startswith("P") or (33 <= o <= 47) or (58 <= o <= 64) or (91 <= o <= 96) or (123 <= o <= 126):
                    if cur: out.append(cur); cur = ""
                    out.append(ch)
                else: cur += ch
            if cur: out.append(cur)
        return out
    def wp(self, tok):
        if len(tok) > 100: return [self.unk]
        ids = []; start = 0
        while start < len(tok):
            end = len(tok); cur = None
            while start < end:
                sub = tok[start:end] if start == 0 else "##" + tok[start:end]
                if sub in self.v: cur = end; break
                end -= 1
            if cur is None: return [self.unk]
            sub = tok[start:cur] if start == 0 else "##" + tok[start:cur]
            ids.append(self.v[sub]); start = cur
        return ids
    def encode(self, text):
        ids = [self.v.get("[CLS]", 101)]
        for t in self.basic(text):
            ids.extend(self.wp(t))
            if len(ids) >= self.max_len - 1: break
        ids.append(self.v.get("[SEP]", 102))
        ids = ids[:self.max_len]
        mask = [1] * len(ids)
        while len(ids) < self.max_len: ids.append(0); mask.append(0)
        return ids, mask
    def encode_content(self, text):
        return [i for t in self.basic(text) for i in self.wp(t)]
def load_arm(d):
    import onnxruntime as ort
    labels = {k: v for k, v in json.loads(open(f"{d}/labels.json", encoding="utf-8").read()).items()}
    calib = json.loads(open(f"{d}/calibration.json", encoding="utf-8").read())
    thr = calib.get("per_label_thresholds", {})
    ood = calib.get("ood", {})
    safe_idx = next(int(k) for k, v in labels.items() if v == "SAFE")
    tokcfg = {}
    try: tokcfg = json.loads(open(f"{d}/tokenizer_config/tokenizer_config.json", encoding="utf-8").read())
    except Exception: pass
    vocab = {}
    for i, line in enumerate(open(f"{d}/tokenizer_config/vocab.txt", encoding="utf-8").read().split("\n")):
        t = line[:-1] if line.endswith("\r") else line
        if t: vocab[t] = i
    tok = BertTok(vocab, tokcfg.get("do_lower_case", True), tokcfg.get("strip_accents", None), tokcfg.get("tokenize_chinese_chars", True))
    sess = ort.InferenceSession(f"{d}/model.onnx", providers=["CPUExecutionProvider"])
    return labels, thr, ood, safe_idx, tok, sess

def decide(logits, labels, thr, ood, safe_idx, floor=0.5, truncated=False, content_tokens=None):
    """Faithful port of ONNXClassifierBackend.decide() — the production decision layer.

    - softmax(logits) with NO temperature division (v4+ exports bake T into the ONNX graph;
      lib/ml/onnxBackend.ts forward() comments this explicitly).
    - abstention: only demotes ATTACK calls; floor=suggested_abstain_max_prob (0.55),
      budget=binary_entropy_p95; PLUS label-space entropy_p95 when the view was truncated.
    - per-label threshold: below -> SAFE. No per-label threshold -> global floor 0.5 -> SAFE.
    """
    probs = softmax(logits)
    order = sorted(int(k) for k in labels.keys())
    pred = order[int(np.argmax([probs[i] for i in order]))]
    pname = labels[str(pred)]
    conf = float(probs[pred])
    p_attack = 1.0 - float(probs[safe_idx])
    def binent(p):
        p = min(max(p, 0.0), 1.0)
        if p <= 1e-12 or p >= 1 - 1e-12: return 0.0
        return -(p * np.log(p) + (1 - p) * np.log(1 - p))
    decision_conf = max(p_attack, 1 - p_attack)
    abstain_floor = ood.get("suggested_abstain_max_prob", 0.35)
    budget = ood.get("binary_entropy_p95", ood.get("entropy_p95"))
    abstained = False
    if pname != "SAFE":
        if decision_conf < abstain_floor: abstained = True
        elif budget is not None and binent(p_attack) > budget: abstained = True
        elif truncated and ood.get("entropy_p95") is not None:
            e = -sum(p * np.log(p) for p in probs if p > 1e-12)
            if e > ood["entropy_p95"]: abstained = True
    if pname == "SAFE": return "SAFE"
    if abstained: return "SAFE"
    t = thr.get(pname)
    if t is not None:
        if conf < t: return "SAFE"
    else:
        if conf < floor: return "SAFE"
    return pname

def audit_train_overlap(samp, ben):
    """Leakage audit with the repo's own group-key standard.

    Verbatim overlap told us 14k eval rows appear in training corpora. The repo's
    trainer defines held-out as GROUP-DISJOINT (group_key_for, the same function
    verify-v17-corpus.py uses for holdout-collision checks), so that is the
    standard applied here: any eval row whose group key appears in ANY training
    corpus file (v14's 8 + the v17 increment's 3) is dropped from EVAL. What
    remains is held-out for BOTH v14 and both v17 arms — nobody saw it or a
    sibling of it.
    """
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import soter_augment
    gk = soter_augment.group_key_for
    corpora = {
        "v14_corpus": ["datasets/ml-augmented-v8-final.jsonl", "datasets/ml-v8-targeted-fix.jsonl",
                       "datasets/ml-v10-advanced-attacks.jsonl", "datasets/ml-v10-targeted-fix.jsonl",
                       "datasets/ml-v11-weak-fix.jsonl", "artifacts/ml-v2/v12-toxicity-fix.jsonl",
                       "datasets/ml-v13-meta-instructional.jsonl", "datasets/ml-v13-attack-gaps.jsonl"],
        "v17_extra": ["datasets/ml-v15-threat-corpus.jsonl", "datasets/ml-v16-threat-corpus.jsonl",
                      "datasets/ml-v17-threat-corpus.jsonl"],
    }
    train_groups = set()
    for group, files in corpora.items():
        for f in files:
            try:
                for line in open(str(ROOT / f), encoding="utf-8"):
                    if not line.strip(): continue
                    try: train_groups.add(gk(json.loads(line)["text"]))
                    except Exception: pass
            except FileNotFoundError:
                print(f"[audit] missing corpus file {f}", flush=True)
    print(f"[audit] train group keys indexed: {len(train_groups)}", flush=True)
    return train_groups

def main():
    t0 = time.time()
    pool = []
    for f in EVAL_FILES:
        rows = load_jsonl(str(ROOT / f)); print(f"loaded {len(rows)} from {f}", flush=True); pool += rows
    seen, dd = set(), []
    for r in pool:
        if r["text"] not in seen: seen.add(r["text"]); dd.append(r)
    pool = dd
    print(f"pool: {len(pool)} raw ({sum(1 for r in pool if r['label'] != 'SAFE')} atk, {sum(1 for r in pool if r['label'] == 'SAFE')} ben)", flush=True)
    train_groups = audit_train_overlap(None, None)
    def is_clean(r):
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        import soter_augment
        return soter_augment.group_key_for(r["text"]) not in train_groups
    clean = [r for r in pool if is_clean(r)]
    dropped = len(pool) - len(clean)
    print(f"[holdout-filter] dropped {dropped} rows whose group key appears in training; {len(clean)} remain", flush=True)
    pool = clean
    atk = [r for r in pool if r["label"] != "SAFE"]
    ben = [r for r in pool if r["label"] == "SAFE"]
    print(f"clean pool: {len(pool)} ({len(atk)} atk, {len(ben)} ben)", flush=True)
    rnd = random.Random(SEED)
    by = {}
    for r in atk: by.setdefault(r["label"], []).append(r)
    labs = sorted(by)
    base = ATTACK_TARGET // len(labs); rem = ATTACK_TARGET - base * len(labs)
    samp = []
    for l in labs:
        q = min(len(by[l]), base + (1 if rem > 0 else 0))
        if rem > 0: rem -= 1
        samp += rnd.sample(by[l], q)
    samp = rnd.sample(samp, min(ATTACK_TARGET, len(samp)))
    # Top up to exactly 10,000 from the leftover pool (label-order, seeded) — the
    # pool has 44k attacks; the strict stratified pass yields ~3.5k because most
    # labels have <770 rows each. Fair: same rows for every arm either way.
    if len(samp) < ATTACK_TARGET:
        left = [r for r in atk if r["text"] not in {s["text"] for s in samp}]
        rnd.shuffle(left)
        samp += left[: ATTACK_TARGET - len(samp)]
    rows = samp + ben
    # USER-DIRECTED SCOPE: attacks-only comparison on the 10,000 sampled attacks.
    # A 3,000-benign seeded subsample is kept ONLY for a rough FP signal (clearly
    # labelled; CI is wide). Full-benign FPR was measured in the earlier 31k run.
    BEN_CAP = 3000
    ben_eval = rnd.sample(ben, min(BEN_CAP, len(ben)))
    rows = samp + ben_eval
    print(f"EVAL: {len(samp)} atk + {len(ben_eval)} ben-subsample = {len(rows)} identical-all-arms (group-disjoint from ALL training corpora)", flush=True)
    res = {}
    for name, d in ARMS:
        print(f"\n-- scoring {name} --", flush=True)
        labels, thr, ood, safe_idx, tok, sess = load_arm(str(ROOT / d))
        atk_ok, ben_ok, lat = [], [], []
        per, lang = {}, {}
        for i, r in enumerate(rows):
            n_content = len(tok.encode_content(r["text"]))
            ids, mask = tok.encode(r["text"])
            if DYNPAD:
                # Drop the [PAD] tail. Measured decision-identical on all three
                # arms -- 0 flips / 500 rows, max|dProb| 0.00e+00, exact-length
                # and bucketed, single- and multi-threaded
                # (artifacts/ml/v17-dynpad-fidelity.json, v17-dynpad-flip-probe.json).
                # Without this the third arm never finished: 256 columns per row
                # at 443 ms p50 instead of 67 ms.
                keep = sum(mask)
                ids, mask = ids[:keep], mask[:keep]
            s = time.time()
            logits = sess.run(["logits"], {"input_ids": [ids], "attention_mask": [mask]})[0][0]
            lat.append((time.time() - s) * 1000)
            truncated = n_content > 254
            pname = decide(logits, labels, thr, ood, safe_idx, truncated=truncated)
            caught = pname != "SAFE"
            if r["label"] != "SAFE":
                atk_ok.append(caught)
                per.setdefault(r["label"], [0, 0]); per[r["label"]][1] += 1; per[r["label"]][0] += caught
            else: ben_ok.append(not caught)
            lg = (r.get("language") or "en").lower()
            lang.setdefault(lg, [0, 0]); lang[lg][1] += 1; lang[lg][0] += (caught if r["label"] != "SAFE" else (not caught))
            if (i + 1) % 2000 == 0: print(f"  {name}: {i+1}/{len(rows)}", flush=True)
        rec = sum(atk_ok) / len(atk_ok); fpr = 1 - sum(ben_ok) / len(ben_ok)
        ls = sorted(lat)
        print(f"{name}: recall={rec*100:.2f}% fpr={fpr*100:.3f}% p50={ls[len(ls)//2]:.1f}ms p95={ls[int(len(ls)*0.95)]:.1f}ms", flush=True)
        res[name] = {"atk": atk_ok, "ben": ben_ok, "recall": rec, "fpr": fpr,
            "tp": sum(atk_ok), "fn": len(atk_ok) - sum(atk_ok), "fp": len(ben_ok) - sum(ben_ok), "tn": sum(ben_ok),
            "p50": ls[len(ls)//2], "p95": ls[int(len(ls)*0.95)],
            "per": {k: {"n": v[1], "recall": v[0]/v[1]} for k, v in per.items()},
            "lang": {k: {"n": v[1], "acc": v[0]/v[1]} for k, v in lang.items()}}
    print("\n== McNemar vs v14 ==", flush=True)
    mc = {}
    for o in ["v17-control-minilm", "v17-candidate-mdistilbert"]:
        for kind in ["atk", "ben"]:
            a, b = res["v14"][kind], res[o][kind]
            oA = sum(1 for x, y in zip(a, b) if x and not y); oB = sum(1 for x, y in zip(a, b) if y and not x)
            p = mcnemar(oA, oB)
            tag = "no-sig-diff" if p >= 0.05 else ("BETTER(sig)" if oB > oA else "WORSE(sig)")
            print(f"{o} {kind}: onlyV14={oA} onlyOther={oB} p={p:.6f} => {tag}", flush=True)
            mc.setdefault(o, {})[kind] = {"onlyV14": oA, "onlyOther": oB, "p": p}
    print("\n-- per-label recall --", flush=True)
    for l in sorted(set(res["v14"]["per"]) | set(res["v17-control-minilm"]["per"]) | set(res["v17-candidate-mdistilbert"]["per"])):
        c = lambda n: f"{res[n]['per'][l]['recall']*100:.1f}%({res[n]['per'][l]['n']})" if l in res[n]["per"] else "-"
        print(f"  {l:28} v14 {c('v14'):14} ctrl {c('v17-control-minilm'):14} cand {c('v17-candidate-mdistilbert')}", flush=True)
    out = ROOT / "artifacts" / "ml" / "v14-vs-v17-10k-honest.json"
    out.write_text(json.dumps({"seed": SEED, "attackRows": len(samp), "benignRows": len(ben_eval), "benignSampleNote": "3000-row seeded subsample of 20936 held-out benign (rough FP signal only)", "files": EVAL_FILES,
        "holdout_standard": "group_key_for disjoint from all 11 training corpus files (same standard as the trainer's split and verify-v17-corpus.py)",
        "arms": {k: {kk: vv for kk, vv in v.items() if kk not in ("atk", "ben")} for k, v in res.items()},
        "mcnemarVsV14": mc, "wallClockSeconds": time.time() - t0}, indent=2), encoding="utf-8")
    print(f"\nWrote {out}", flush=True)

if __name__ == "__main__":
    main()

