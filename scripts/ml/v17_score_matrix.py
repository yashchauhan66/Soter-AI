#!/usr/bin/env python3
"""Score the 13,000-row held-out set ONCE per arm and dump raw probabilities.

WHY THIS EXISTS — the defect it repairs
---------------------------------------
`v14_vs_v17_10k_honest.py` folded the decision layer into the forward pass, so its
recall/FPR pairs are only readable at ONE operating point: each arm's own shipped
calibration. Two of the mechanisms it applied are not the ones production uses:

  1. ABSTENTION BUDGET. The harness used `calibration.ood.binary_entropy_p95`, which is
     a DIFFERENT number in each artifact -- v14 0.0359, v17 0.0646, v17-minilm 0.1523.
     Production overrides all three: `.env` sets SOTERAI_ML_ABSTAIN_ENTROPY=0.40, and
     `lib/ml/calibration.ts:216-219` reads that override FIRST. So the three arms were
     compared at three different, non-production operating points, and a 4x looser
     budget buys recall and FPR together -- exactly the ordering the run reported.
  2. PER-LABEL THRESHOLDS. The harness demoted below-threshold attacks to SAFE and
     stopped there. Production restores them: `lib/guard/mlAugment.ts:385-390` prefers
     `rawPredictedLabel` when the backend demoted only on thresholding, then re-decides
     with the confidence floor, attack-probability fusion and the precision gate.
     v17's SYSTEM_PROMPT_LEAK_ATTEMPT threshold is 0.5 against v14's 0.157, and that
     label is 6,073 of the 10,000 sampled attacks.

Dumping probabilities separates the model from the operating point: every decision rule
is then a pure function of this file and costs seconds instead of a 72-minute rescore.

FIDELITY CONTRACT
-----------------
Row selection is byte-identical to `v14_vs_v17_10k_honest.py` -- same EVAL_FILES, same
SEED, same group-key holdout filter, same stratify-then-top-up, same 3,000-benign
subsample. `v17_operating_points.py` re-derives that run's published numbers from this
matrix as its control; if they do not reproduce exactly, the selection has drifted and
nothing downstream is comparable.
"""
import hashlib
import gc
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

import v14_vs_v17_10k_honest as H  # noqa: E402  (helpers + the constants under test)

# The frozen selection's fingerprint, first emitted by the killed 2026-09-17 run and by
# every resume since. A rerun that produces a different hash has drifted (eval files,
# corpora, seed or sampling order changed) and must not be merged with existing columns.
EXPECTED_SELECTION_SHA = "c1f96dd3ce8dd5105d81b333148b14926dd93a2bb277ff4610aba23a8c8fa5d4"

OUT = ROOT / "artifacts" / "ml" / "v17-score-matrix.jsonl"
META = ROOT / "artifacts" / "ml" / "v17-score-matrix-meta.json"
ROWS_FILE = ROOT / "artifacts" / "ml" / "v17-matrix-rows.jsonl"
ARM_DIR = ROOT / "artifacts" / "ml"


def arm_file(name):
    return ARM_DIR / f"v17-score-{name}.jsonl"


def select_rows():
    """Verbatim port of the selection in H.main(), with the source file recorded.

    Kept as a copy rather than a refactor of H: editing the script that produced
    `v14-vs-v17-10k-honest.json` would invalidate that artifact's provenance.
    """
    import random

    pool = []
    for f in H.EVAL_FILES:
        rows = H.load_jsonl(str(ROOT / f))
        for r in rows:
            r["_src"] = f
        print(f"loaded {len(rows)} from {f}", flush=True)
        pool += rows
    seen, dd = set(), []
    for r in pool:
        if r["text"] not in seen:
            seen.add(r["text"])
            dd.append(r)
    pool = dd
    train_groups = H.audit_train_overlap(None, None)
    import soter_augment

    gk = soter_augment.group_key_for
    pool = [r for r in pool if gk(r["text"]) not in train_groups]
    atk = [r for r in pool if r["label"] != "SAFE"]
    ben = [r for r in pool if r["label"] == "SAFE"]
    print(f"clean pool: {len(pool)} ({len(atk)} atk, {len(ben)} ben)", flush=True)

    rnd = random.Random(H.SEED)
    by = {}
    for r in atk:
        by.setdefault(r["label"], []).append(r)
    labs = sorted(by)
    base = H.ATTACK_TARGET // len(labs)
    rem = H.ATTACK_TARGET - base * len(labs)
    samp = []
    for l in labs:
        q = min(len(by[l]), base + (1 if rem > 0 else 0))
        if rem > 0:
            rem -= 1
        samp += rnd.sample(by[l], q)
    samp = rnd.sample(samp, min(H.ATTACK_TARGET, len(samp)))
    if len(samp) < H.ATTACK_TARGET:
        left = [r for r in atk if r["text"] not in {s["text"] for s in samp}]
        rnd.shuffle(left)
        samp += left[: H.ATTACK_TARGET - len(samp)]
    ben_eval = rnd.sample(ben, min(3000, len(ben)))
    rows = samp + ben_eval
    print(f"EVAL: {len(samp)} atk + {len(ben_eval)} ben = {len(rows)} rows", flush=True)
    return rows


def main():
    t0 = time.time()

    # ── Step 1: freeze the selection ──────────────────────────────────────────
    # Cached because rebuilding it re-indexes 137,746 training group keys, which is
    # both slow and a memory spike of its own — and a resume must not risk selecting
    # a different 13,000 rows than the arms already scored.
    if ROWS_FILE.exists():
        rows = [json.loads(l) for l in ROWS_FILE.read_text(encoding="utf-8").split("\n") if l.strip()]
        print(f"reusing frozen selection: {len(rows)} rows from {ROWS_FILE.name}", flush=True)
    else:
        rows = select_rows()
        with open(ROWS_FILE, "w", encoding="utf-8") as fh:
            for r in rows:
                fh.write(json.dumps({k: r[k] for k in ("text", "label", "_src") if k in r}
                                    | {"language": r.get("language")}, ensure_ascii=False) + "\n")
        print(f"froze selection to {ROWS_FILE.name}", flush=True)

    # Selection fingerprint: any drift in the eval files, the corpora, the seed or the
    # sampling order moves this hash, and a moved hash means the matrix is not
    # comparable to the 10k run.
    fp = hashlib.sha256("\n".join(r["text"] for r in rows).encode("utf-8")).hexdigest()
    print(f"selection sha256: {fp}", flush=True)
    if fp != EXPECTED_SELECTION_SHA:
        sys.exit(f"selection drifted (expected {EXPECTED_SELECTION_SHA[:16]}…) — refusing to score")

    # ── Step 2: one arm at a time, streamed to its own file ───────────────────
    # WHY PER-ARM: the first attempt held all three arms in memory and wrote only at
    # the end. It was reaped by the OS on the third arm at 43 min, and BOTH completed
    # arms were lost with it. Each arm is now an independent, resumable unit.
    stats = {}
    for name, d in H.ARMS:
        af = arm_file(name)
        if af.exists():
            done = sum(1 for l in af.read_text(encoding="utf-8").split("\n") if l.strip())
            if done == len(rows):
                stats[name] = json.loads((ARM_DIR / f"v17-score-{name}-stats.json").read_text(encoding="utf-8"))
                print(f"-- {name}: already complete ({done} rows), skipping --", flush=True)
                continue
            print(f"-- {name}: partial ({done}/{len(rows)}), rescoring --", flush=True)

        print(f"\n-- scoring {name} --", flush=True)
        labels, thr, ood, safe_idx, tok, sess = H.load_arm(str(ROOT / d))
        order = sorted(int(k) for k in labels.keys())
        lat = []
        with open(af, "w", encoding="utf-8") as fh:
            for i, r in enumerate(rows):
                n_content = len(tok.encode_content(r["text"]))
                ids, mask = tok.encode(r["text"])
                keep = sum(mask)  # dynamic padding: proven decision-identical, 0 flips/500
                ids, mask = ids[:keep], mask[:keep]
                s = time.time()
                logits = sess.run(["logits"], {"input_ids": [ids], "attention_mask": [mask]})[0][0]
                lat.append((time.time() - s) * 1000)
                probs = H.softmax(logits)
                fh.write(
                    json.dumps(
                        {
                            "p": [round(float(probs[i2]), 6) for i2 in order],
                            "n": n_content,
                            "t": 1 if n_content > 254 else 0,
                        }
                    )
                    + "\n"
                )
                if (i + 1) % 500 == 0:
                    fh.flush()  # a reap now costs at most 500 rows of this one arm
                if (i + 1) % 2000 == 0:
                    print(f"  {name}: {i+1}/{len(rows)}  ({(time.time()-t0)/60:.1f} min elapsed)", flush=True)
        ls = sorted(lat)
        stats[name] = {
            "labelOrder": [labels[str(i2)] for i2 in order],
            "safeIndex": order.index(safe_idx),
            "p50": ls[len(ls) // 2],
            "p95": ls[int(len(ls) * 0.95)],
            "mean": sum(lat) / len(lat),
        }
        (ARM_DIR / f"v17-score-{name}-stats.json").write_text(json.dumps(stats[name], indent=2), encoding="utf-8")
        print(f"{name}: p50={stats[name]['p50']:.1f}ms p95={stats[name]['p95']:.1f}ms", flush=True)
        # Release the native ORT session before the next arm loads. mDistilBERT is
        # 541 MB on disk and roughly 1 GB resident; without this the outgoing arm can
        # still be held while the incoming one allocates.
        del sess, tok, labels
        gc.collect()

    # ── Step 3: merge the per-arm columns into one matrix ─────────────────────
    cols = {}
    for name, _ in H.ARMS:
        cols[name] = [json.loads(l) for l in arm_file(name).read_text(encoding="utf-8").split("\n") if l.strip()]
        if len(cols[name]) != len(rows):
            sys.exit(f"{name} has {len(cols[name])} scored rows, expected {len(rows)} — rerun to finish it")

    with open(OUT, "w", encoding="utf-8") as fh:
        for i, r in enumerate(rows):
            fh.write(
                json.dumps(
                    {
                        "i": i,
                        "label": r["label"],
                        "lang": (r.get("language") or "en").lower(),
                        "src": r["_src"],
                        "sha": hashlib.sha1(r["text"].encode("utf-8")).hexdigest()[:16],
                        "arms": {name: cols[name][i] for name, _ in H.ARMS},
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )

    META.write_text(
        json.dumps(
            {
                "seed": H.SEED,
                "files": H.EVAL_FILES,
                "selectionSha256": fp,
                "attackRows": sum(1 for r in rows if r["label"] != "SAFE"),
                "benignRows": sum(1 for r in rows if r["label"] == "SAFE"),
                "arms": {
                    name: {"dir": d, **stats[name]} for name, d in H.ARMS
                },
                "dynamicPadding": True,
                "note": "Raw softmax probabilities only. No decision layer applied here on purpose.",
                "wallClockSeconds": time.time() - t0,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"\nWrote {OUT} and {META} in {(time.time()-t0)/60:.1f} min", flush=True)


if __name__ == "__main__":
    main()
