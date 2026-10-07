#!/usr/bin/env python3
"""Score the CANONICAL ENGLISH GATE the same way, so both reads share one decision layer.

`artifacts/ml/_crossdist-gate-subset.jsonl` (3,987 rows = 3,069 attacks / 918 benign) is
the file the headline 97.52% / 5.56% was actually measured on. It is the gate that has
historically decided ship / no-ship, and it is 78% English -- the complement of the
13,000-row held-out matrix, which is where the multilingual evidence lives.

This writes the SAME matrix format as `v17_score_matrix.py`, so `v17_operating_points.py`
reads it with no new decision code:

    python scripts/ml/v17_score_gate.py
    python scripts/ml/v17_operating_points.py gate

Which matters because the two files disagree about what an operating point costs, and a
promotion decision has to survive both. Phase 0.2 (pricing MULTI_TURN_ESCALATION into the
INPUT allowlist) is only payable if the benign FPR *here* moves by <= ~0.3 points.

TWO HONEST CAVEATS, reported rather than silently handled
---------------------------------------------------------
1. NO HOLDOUT FILTER. The 10k matrix drops every row whose augmentation group key appears
   in training. This file does not: the published 97.52% baseline was measured on all
   3,987 rows, and filtering here would compare against a number nobody ever ran. Instead
   the overlap is COUNTED and written into the meta, so the contamination is visible and
   quantified rather than assumed to be zero.
2. UNION OVERLAP. v14 and v17 were trained on different corpora (146,757 vs 155,883 rows).
   The audit indexes the union of all corpus files, so the reported overlap is an upper
   bound that is identical for every arm -- it cannot flatter one of them.
"""
import gc
import hashlib
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

import v14_vs_v17_10k_honest as H  # noqa: E402  (same loaders, same tokenizer, same arms)

GATE = ROOT / "artifacts" / "ml" / "_crossdist-gate-subset.jsonl"
OUT = ROOT / "artifacts" / "ml" / "v17-gate-matrix.jsonl"
META = ROOT / "artifacts" / "ml" / "v17-gate-matrix-meta.json"
ARM_DIR = ROOT / "artifacts" / "ml"


def arm_file(name):
    return ARM_DIR / f"v17-gate-{name}.jsonl"


def main():
    t0 = time.time()
    if not GATE.exists():
        sys.exit(f"missing {GATE}")

    rows = [json.loads(l) for l in GATE.read_text(encoding="utf-8").split("\n") if l.strip()]
    n_atk = sum(1 for r in rows if r["label"] != "SAFE")
    print(f"gate: {len(rows)} rows ({n_atk} atk, {len(rows)-n_atk} ben)", flush=True)

    # File order is the selection -- no seed, no sampling. The hash still guards against
    # the file itself being regenerated underneath a partially scored run.
    fp = hashlib.sha256("\n".join(r["text"] for r in rows).encode("utf-8")).hexdigest()
    print(f"gate sha256: {fp}", flush=True)
    if META.exists():
        prev = json.loads(META.read_text(encoding="utf-8")).get("selectionSha256")
        if prev and prev != fp:
            sys.exit(f"gate file changed since the last run ({prev[:16]}… -> {fp[:16]}…) — delete the per-arm files to rescore")

    # ── Contamination audit: counted, not filtered (see the module docstring) ──
    train_groups = H.audit_train_overlap(None, None)
    import soter_augment

    gk = soter_augment.group_key_for
    overlap = sum(1 for r in rows if gk(r["text"]) in train_groups)
    ov_atk = sum(1 for r in rows if r["label"] != "SAFE" and gk(r["text"]) in train_groups)
    print(
        f"[audit] {overlap}/{len(rows)} gate rows ({overlap/len(rows)*100:.1f}%) share a training "
        f"group key — {ov_atk} attacks, {overlap-ov_atk} benign. NOT filtered: the published "
        f"baseline was measured on the unfiltered file.",
        flush=True,
    )
    del train_groups
    gc.collect()

    # ── One arm at a time, streamed and resumable (same contract as the 10k run) ──
    stats = {}
    for name, d in H.ARMS:
        af = arm_file(name)
        sf = ARM_DIR / f"v17-gate-{name}-stats.json"
        if af.exists() and sf.exists():
            done = sum(1 for l in af.read_text(encoding="utf-8").split("\n") if l.strip())
            if done == len(rows):
                stats[name] = json.loads(sf.read_text(encoding="utf-8"))
                print(f"-- {name}: already complete ({done} rows), skipping --", flush=True)
                continue
            print(f"-- {name}: partial ({done}/{len(rows)}), rescoring --", flush=True)

        print(f"\n-- scoring {name} on the gate --", flush=True)
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
                    fh.flush()
                if (i + 1) % 1000 == 0:
                    print(f"  {name}: {i+1}/{len(rows)}  ({(time.time()-t0)/60:.1f} min elapsed)", flush=True)
        ls = sorted(lat)
        stats[name] = {
            "labelOrder": [labels[str(i2)] for i2 in order],
            "safeIndex": order.index(safe_idx),
            "p50": ls[len(ls) // 2],
            "p95": ls[int(len(ls) * 0.95)],
            "mean": sum(lat) / len(lat),
        }
        sf.write_text(json.dumps(stats[name], indent=2), encoding="utf-8")
        print(f"{name}: p50={stats[name]['p50']:.1f}ms p95={stats[name]['p95']:.1f}ms", flush=True)
        del sess, tok, labels
        gc.collect()

    # ── Merge ────────────────────────────────────────────────────────────────
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
                        "src": r.get("source") or "crossdist-gate-subset",
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
                "gateFile": str(GATE.relative_to(ROOT)).replace("\\", "/"),
                "selectionSha256": fp,
                "attackRows": n_atk,
                "benignRows": len(rows) - n_atk,
                "trainGroupOverlap": {"rows": overlap, "attacks": ov_atk, "benign": overlap - ov_atk,
                                      "note": "counted, not filtered; union of all corpus files"},
                "arms": {name: {"dir": d, **stats[name]} for name, d in H.ARMS},
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
