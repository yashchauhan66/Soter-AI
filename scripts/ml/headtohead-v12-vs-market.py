#!/usr/bin/env python3
"""
Three-way head-to-head on ONE fixed sample of real external rows:

    SoterLLM v12  vs  ProtectAI DeBERTa v2  vs  Meta Prompt-Guard-2 86M

WHY A SEPARATE SCRIPT
  eval-v12-honest.py measures v12 on all 22,681 crossdist rows. The external
  detectors cannot be scored on all of them: they answer ONE question ("does this
  text try to override prior instructions?") and their own model cards disclaim
  content judgement. Scoring them on PII rows would count a task they never
  claimed as a miss and manufacture a flattering win for v12.

  So this script restricts to the labels all three can be fairly scored on
  (PROMPT_INJECTION / JAILBREAK / SYSTEM_PROMPT_LEAK_ATTEMPT / SAFE), takes one
  deterministic sample, and runs every model over THE SAME rows. DeBERTa-v3-base
  is 184M params on CPU, which is why the sample is bounded rather than the full set.

LAKERA IS ABSENT ON PURPOSE
  Lakera Guard is closed and API-only. No key exists in .env and there are no
  weights to download, so no Lakera row can be produced here. The report must say
  "not measured", never an estimate.

BASELINE CONTAMINATION IS UNKNOWN, NOT ZERO
  ProtectAI v2's training mix is public-ish and includes common injection corpora;
  deepset/prompt-injections rows in this eval may well be in it. We can subtract
  v12's training skeletons because we own that manifest. We cannot do the same for
  the baselines. Any baseline number here may therefore be flattered by the same
  train-on-test effect this harness removes from v12 — stated, not hidden.

USAGE
  HF_HUB_OFFLINE=1 python scripts/ml/headtohead-v12-vs-market.py --sample 4000
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

ALL_LABELS = [
    "SAFE", "PROMPT_INJECTION", "JAILBREAK", "SYSTEM_PROMPT_LEAK_ATTEMPT", "PII",
    "SECRET", "UNSAFE_OUTPUT", "RAG_POISONING", "DATA_EXFILTRATION_ATTEMPT",
    "TOOL_CALL_ABUSE", "ENCODING_OBFUSCATION", "MULTI_TURN_ESCALATION",
    "MODEL_EXTRACTION", "TOXICITY_HARASSMENT",
]

OVERRIDE_SCOPE = {"PROMPT_INJECTION", "JAILBREAK", "SYSTEM_PROMPT_LEAK_ATTEMPT", "SAFE"}

BASELINES = {
    "protectai-v2": "protectai/deberta-v3-base-prompt-injection-v2",
    "pg2-86m-mirror": "gravitee-io/Llama-Prompt-Guard-2-86M-onnx",
}


def group_key_for(text: str) -> str:
    t = unicodedata.normalize("NFKD", text)
    t = "".join(ch for ch in t if not unicodedata.combining(ch)).lower()
    leet = {"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i"}
    t = "".join(leet.get(ch, ch) for ch in t)
    letters = re.findall(r"[a-z]+", t)
    letters.sort()
    return " ".join(letters)


def read_jsonl(path: Path):
    rows = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    rows.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return rows


def training_skeletons(manifest_path: Path):
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    skel, missing = set(), []
    for rel in manifest.get("datasets", []):
        p = Path(rel)
        if not p.exists():
            missing.append(rel)
            continue
        with p.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                t = row.get("text")
                if isinstance(t, str) and t.strip():
                    skel.add(group_key_for(t))
    return skel, missing


def metrics(rows, flags):
    atk = [(r, f) for r, f in zip(rows, flags) if r["label"] != "SAFE"]
    safe = [(r, f) for r, f in zip(rows, flags) if r["label"] == "SAFE"]
    tp = sum(1 for _, f in atk if f)
    fp = sum(1 for _, f in safe if f)
    fn = len(atk) - tp
    tn = len(safe) - fp
    recall = tp / len(atk) * 100 if atk else None
    fpr = fp / len(safe) * 100 if safe else None
    prec = tp / (tp + fp) * 100 if (tp + fp) else None
    f1 = (2 * prec * recall / (prec + recall)) if (prec and recall) else None
    per = defaultdict(lambda: [0, 0])
    for r, f in atk:
        per[r["label"]][1] += 1
        if f:
            per[r["label"]][0] += 1
    return {
        "rows": len(rows), "attacks": len(atk), "benign": len(safe),
        "tp": tp, "fp": fp, "fn": fn, "tn": tn,
        "recall_pct": round(recall, 2) if recall is not None else None,
        "fpr_pct": round(fpr, 2) if fpr is not None else None,
        "precision_pct": round(prec, 2) if prec is not None else None,
        "f1_pct": round(f1, 2) if f1 is not None else None,
        "per_label_recall": {
            k: {"detected": v[0], "total": v[1], "recall_pct": round(v[0] / v[1] * 100, 2)}
            for k, v in sorted(per.items())
        },
    }


def run_v12(model_dir: Path, texts, batch):
    import onnxruntime as ort
    from transformers import AutoTokenizer

    sess = ort.InferenceSession(str(model_dir / "model.onnx"), providers=["CPUExecutionProvider"])
    tok = AutoTokenizer.from_pretrained(str(model_dir / "tokenizer_config"))
    cal = json.loads((model_dir / "calibration.json").read_text(encoding="utf-8"))
    thr = cal.get("per_label_thresholds", {})
    flags, lat = [], []
    for i in range(0, len(texts), batch):
        chunk = texts[i : i + batch]
        enc = tok(chunk, padding=True, truncation=True, max_length=256, return_tensors="np")
        t0 = time.perf_counter()
        logits = sess.run(None, {
            "input_ids": enc["input_ids"].astype(np.int64),
            "attention_mask": enc["attention_mask"].astype(np.int64),
        })[0]
        lat.append((time.perf_counter() - t0) / len(chunk) * 1000)
        sh = logits - logits.max(axis=1, keepdims=True)
        probs = np.exp(sh) / np.exp(sh).sum(axis=1, keepdims=True)
        for row in probs:
            idx = int(row.argmax())
            label = ALL_LABELS[idx]
            if idx != 0 and float(row[idx]) < float(thr.get(label, 0.05)):
                label = "SAFE"
            flags.append(label != "SAFE")
    return flags, float(np.mean(lat))


def run_hf(model_id: str, texts, batch, threshold=0.5, max_length=256):
    from transformers import AutoModelForSequenceClassification, AutoTokenizer
    import torch

    # DeBERTa-v3-base is 184M params; on CPU it defaults to a single thread here and
    # takes ~45 min for 3k rows. Use every core, and match v12's 256-token window so
    # the two models see the same amount of each prompt (v12 truncates at 256, so
    # giving the baseline 512 would compare different inputs, not different models).
    torch.set_num_threads(max(1, (__import__("os").cpu_count() or 2)))

    tok = AutoTokenizer.from_pretrained(model_id)
    model = AutoModelForSequenceClassification.from_pretrained(model_id)
    model.eval()
    # Attack column: prefer the id2label map, fall back to the last column.
    id2label = {int(k): str(v).upper() for k, v in (model.config.id2label or {}).items()}
    attack_col = None
    for i, name in id2label.items():
        if any(k in name for k in ("INJECT", "JAILBREAK", "MALICIOUS", "UNSAFE", "LABEL_1", "ATTACK")):
            attack_col = i
    if attack_col is None:
        attack_col = model.config.num_labels - 1
    flags, lat = [], []
    for i in range(0, len(texts), batch):
        chunk = texts[i : i + batch]
        enc = tok(chunk, padding=True, truncation=True, max_length=max_length, return_tensors="pt")
        t0 = time.perf_counter()
        with torch.no_grad():
            logits = model(**enc).logits
        lat.append((time.perf_counter() - t0) / len(chunk) * 1000)
        probs = torch.softmax(logits, dim=-1).cpu().numpy()
        flags.extend(bool(p[attack_col] >= threshold) for p in probs)
    return flags, float(np.mean(lat)), id2label, attack_col


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model-dir", default="models/ml-classifier-v12")
    ap.add_argument("--eval", default="datasets/crossdist-eval-v3.jsonl")
    ap.add_argument("--sample", type=int, default=4000)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--out", default="artifacts/ml/v12-vs-market-headtohead.json")
    args = ap.parse_args()

    model_dir = Path(args.model_dir)
    # The result key and the artifact fingerprint are DERIVED from --model-dir, never
    # hardcoded. The key used to be the literal "soterllm-v12" while --model-dir was
    # honored, so pointing this at v14 wrote v14's numbers under v12's name and the
    # report carried no record of which weights produced it. Same class of defect as
    # the plain-assignment env overwrite in measure-veto-fix.ts: the harness silently
    # disagreed with its own label. sha256 is what makes a stale report detectable.
    soter_key = f"soterllm-{model_dir.name.replace('ml-classifier-', '')}"
    onnx_path = model_dir / "model.onnx"
    onnx_sha = "absent"
    if onnx_path.exists():
        h = hashlib.sha256()
        with onnx_path.open("rb") as fh:
            for chunk in iter(lambda: fh.read(1 << 20), b""):
                h.update(chunk)
        onnx_sha = h.hexdigest()

    rows = read_jsonl(Path(args.eval))
    rows = [r for r in rows if isinstance(r.get("text"), str) and r.get("label") in ALL_LABELS]

    print("=" * 78)
    print("v12 vs market — same rows, override-detection scope only")
    print("=" * 78)

    skel, missing = training_skeletons(model_dir / "dataset_manifest.json")
    if missing:
        print(f"  !! missing training files, contamination check incomplete: {missing}")

    scope = [r for r in rows if r["label"] in OVERRIDE_SCOPE and group_key_for(r["text"]) not in skel]
    print(f"in-scope, v12-clean rows available: {len(scope)}")

    if args.sample and len(scope) > args.sample:
        rng = np.random.RandomState(42)
        idx = sorted(rng.permutation(len(scope))[: args.sample].tolist())
        scope = [scope[i] for i in idx]
    print(f"sampled (seed 42): {len(scope)} rows")
    print("  label mix:", dict(Counter(r["label"] for r in scope)))
    texts = [r["text"] for r in scope]

    report = {
        "harness": "headtohead-v12-vs-market/v1",
        "eval_set": args.eval,
        "scope_labels": sorted(OVERRIDE_SCOPE),
        "rows_scored": len(scope),
        "label_mix": dict(Counter(r["label"] for r in scope)),
        "v12_contamination_removed": True,
        "baseline_contamination": "UNKNOWN — baselines' training sets are not ours to audit; "
                                 "their numbers here may be flattered by train-on-test.",
        "lakera": {"measured": False,
                   "reason": "closed API-only product, no key in .env, no downloadable weights"},
        "models": {},
    }

    print(f"\n[1] SoterLLM {soter_key.replace('soterllm-', '')} "
          f"(raw ONNX + calibration thresholds) ...")
    f12, l12 = run_v12(model_dir, texts, args.batch)
    m12 = metrics(scope, f12)
    m12["ms_per_row_inference_only"] = round(l12, 2)
    m12["artifact"] = {"model_dir": str(model_dir), "model_onnx_sha256": onnx_sha}
    report["models"][soter_key] = m12
    print(f"    recall {m12['recall_pct']}%  FPR {m12['fpr_pct']}%  F1 {m12['f1_pct']}%  "
          f"({l12:.1f} ms/row)")

    for key, model_id in BASELINES.items():
        print(f"\n[+] {key} ({model_id}) ...")
        try:
            fb, lb, id2label, col = run_hf(model_id, texts, args.batch)
        except Exception as exc:  # noqa: BLE001
            print(f"    !! unavailable: {type(exc).__name__}: {exc}")
            report["models"][key] = {"measured": False, "error": f"{type(exc).__name__}: {exc}"}
            continue
        mb = metrics(scope, fb)
        mb["ms_per_row_inference_only"] = round(lb, 2)
        mb["model_id"] = model_id
        mb["id2label"] = id2label
        mb["attack_column"] = col
        report["models"][key] = mb
        print(f"    id2label={id2label} attack_col={col}")
        print(f"    recall {mb['recall_pct']}%  FPR {mb['fpr_pct']}%  F1 {mb['f1_pct']}%  "
              f"({lb:.1f} ms/row)")

    print("\n" + "=" * 78)
    print(f"{'model':<22} {'recall':>9} {'FPR':>8} {'precision':>10} {'F1':>8} {'ms/row':>9}")
    print("-" * 78)
    for name, m in report["models"].items():
        if not m.get("measured", True):
            print(f"{name:<22} {'UNAVAILABLE':>9}")
            continue
        print(f"{name:<22} {str(m['recall_pct'])+'%':>9} {str(m['fpr_pct'])+'%':>8} "
              f"{str(m['precision_pct'])+'%':>10} {str(m['f1_pct'])+'%':>8} "
              f"{m['ms_per_row_inference_only']:>9}")
    print(f"{'lakera-guard':<22} {'NOT MEASURED (closed API, no key)':>9}")
    print("=" * 78)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
