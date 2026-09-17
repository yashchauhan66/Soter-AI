#!/usr/bin/env python3
"""
Sweep v16's OPERATING POINT (not its weights) against the canonical acceptance gate.

WHAT IS BEING TESTED
  The v14-vs-v16 paired run found 73 attack rows v14 catches and v16 misses.
  Only 24 of them are true model misses (v16 said SAFE). The other 49 are rows
  where v16 predicted an attack label and a GATE discarded it:

      abstention (per-label threshold demoted it)   24
      label-family (INPUT_RELIABLE_LABELS)          23
      mixed / other-attack-label                     2

  Both of those gates are configuration, and both are explicitly documented as
  coupled to the deployed weights:
    - lib/guard/mlAugment.ts admits a label to INPUT_RELIABLE_LABELS only after
      measuring ITS FP cost under THOSE weights ("that is a MODEL-VERSION
      difference, which is exactly why the gate is coupled to the deployed
      weights and not to the label space"). MULTI_TURN_ESCALATION was measured
      as a no-op under v14 and left out. v16 is the first version that actually
      predicts it, so the measurement has to be redone, not inherited.
    - per_label_thresholds were fitted at target_fpr=0.01 on v16's calibration
      split, which produced a 0.5 (clamped from 0.7496) threshold on
      SYSTEM_PROMPT_LEAK_ATTEMPT versus v14's 0.1567.

  So each arm below changes ONE knob, keeps the weights fixed, and is scored on
  the same canonical rows through the same production path.

HONESTY BOUND
  Selecting an arm on this set is selection on the acceptance gate. That is the
  declared deployment gate and it is how the abstain-entropy sweep was decided
  before, but it means the chosen arm MUST then be confirmed on the held-out
  batteries (v15-test-battery, tranches, v16 probe), which are not used here.

USAGE
  python scripts/ml/sweep-v16-operating-point.py --stage allowlist
  python scripts/ml/sweep-v16-operating-point.py --stage thresholds \
      --allowlist "PROMPT_INJECTION,...,MULTI_TURN_ESCALATION"
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

V16 = Path("models/ml-classifier-v16")

DEFAULT_ALLOWLIST = [
    "PROMPT_INJECTION", "JAILBREAK", "SYSTEM_PROMPT_LEAK_ATTEMPT", "PII", "SECRET",
    "RAG_POISONING", "ENCODING_OBFUSCATION", "MODEL_EXTRACTION", "TOOL_CALL_ABUSE",
]


def run_arm(name: str, calibration: Path | None, allowlist: list[str] | None,
            limit: int, evalfile: str, outdir: Path) -> dict:
    env = dict(os.environ)
    env["ML_BACKEND"] = "onnx"
    env["ML_ONNX_MODEL_PATH"] = str(V16 / "model.onnx")
    env["ML_ONNX_LABELS_PATH"] = str(V16 / "labels.json")
    env["ML_ONNX_CALIBRATION_PATH"] = str(calibration or (V16 / "calibration.json"))
    # Deliberately NOT setting SOTERAI_ML_ABSTAIN_ENTROPY or _SEMANTIC_MARGIN: the
    # eval harness loads .env itself, so leaving them alone keeps every arm on the
    # exact settings the canonical v16 baseline ran with. Only the knob under test
    # differs; otherwise a delta could not be attributed.
    if allowlist is not None:
        env["SOTERAI_ML_INPUT_TRUSTED_LABELS"] = ",".join(allowlist)
    else:
        env.pop("SOTERAI_ML_INPUT_TRUSTED_LABELS", None)

    out = outdir / f"{name}.json"
    cmd = ["npx", "tsx", "scripts/ml/eval-crossdist-production.ts",
           "--file", evalfile, "--limit", str(limit), "--out", str(out),
           "--dump-misses", str(outdir / f"{name}-misses.jsonl"),
           "--dump-fps", str(outdir / f"{name}-fps.jsonl")]
    print(f"\n=== arm {name} ===", flush=True)
    print(f"    calibration: {env['ML_ONNX_CALIBRATION_PATH']}", flush=True)
    print(f"    allowlist  : {'default(9)' if allowlist is None else str(len(allowlist)) + ' labels'}", flush=True)
    t0 = time.perf_counter()
    res = subprocess.run(cmd, env=env, shell=(os.name == "nt"),
                         capture_output=True, text=True, encoding="utf-8", errors="replace")
    dt = time.perf_counter() - t0
    if res.returncode != 0 or not out.exists():
        print(res.stdout[-3000:])
        print(res.stderr[-3000:])
        return {"arm": name, "ok": False, "returncode": res.returncode}
    rep = json.loads(out.read_text(encoding="utf-8"))
    e2e = rep["endToEnd"]
    row = {
        "arm": name, "ok": True, "seconds": round(dt, 1),
        "calibration": env["ML_ONNX_CALIBRATION_PATH"],
        "allowlist": allowlist,
        "recall": e2e["recall"], "caught": e2e["caught"], "attacks": e2e["attacks"],
        "fpr": e2e["fpr"], "fp": e2e["fp"], "benign": e2e["benign"],
        "gates": rep.get("gateAttributionForMisses", {}),
        "report": str(out),
    }
    print(f"    -> recall {e2e['recall']}% ({e2e['caught']}/{e2e['attacks']})  "
          f"FPR {e2e['fpr']}% ({e2e['fp']}/{e2e['benign']})  [{dt:.0f}s]", flush=True)
    print(f"    -> gates {row['gates']}", flush=True)
    return row


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--stage", choices=["allowlist", "thresholds", "both"], default="both")
    ap.add_argument("--limit", type=int, default=4250)
    ap.add_argument("--eval", default="datasets/crossdist-eval-v3.jsonl")
    ap.add_argument("--calib-dir", default="artifacts/ml/v16-calib")
    ap.add_argument("--allowlist", default="")
    ap.add_argument("--out", default="artifacts/ml/v16-operating-point-sweep.json")
    ap.add_argument("--outdir", default="artifacts/ml/_v16sweep")
    args = ap.parse_args()

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    results: list[dict] = []

    base_allow = ([s.strip().upper() for s in args.allowlist.split(",") if s.strip()]
                  if args.allowlist else DEFAULT_ALLOWLIST)

    if args.stage in ("allowlist", "both"):
        # Arm 0 reproduces the published v16 baseline so the sweep carries its own
        # control; if this does not land on 97.13% / 5.34% the harness changed and
        # nothing below it is comparable.
        results.append(run_arm("a0-baseline", None, None, args.limit, args.eval, outdir))
        results.append(run_arm("a1-plus-multiturn", None,
                               DEFAULT_ALLOWLIST + ["MULTI_TURN_ESCALATION"],
                               args.limit, args.eval, outdir))
        results.append(run_arm("a2-plus-multiturn-exfil", None,
                               DEFAULT_ALLOWLIST + ["MULTI_TURN_ESCALATION",
                                                    "DATA_EXFILTRATION_ATTEMPT"],
                               args.limit, args.eval, outdir))

    if args.stage in ("thresholds", "both"):
        cal_dir = Path(args.calib_dir)
        idx = cal_dir / "index.json"
        if not idx.exists():
            print(f"!! {idx} missing — run scripts/ml/refit-v16-thresholds.py first")
            return 2
        cands = json.loads(idx.read_text(encoding="utf-8"))["candidates"]
        for tgt, meta in sorted(cands.items(), key=lambda kv: float(kv[0])):
            results.append(run_arm(f"t-fpr{tgt}", Path(meta["file"]), base_allow,
                                   args.limit, args.eval, outdir))

    ok = [r for r in results if r.get("ok")]
    print("\n" + "=" * 86)
    print(f"{'arm':<26}{'recall':>10}{'caught':>14}{'FPR':>9}{'fp':>10}")
    print("-" * 86)
    for r in ok:
        print(f"{r['arm']:<26}{str(r['recall'])+'%':>10}"
              f"{str(r['caught'])+'/'+str(r['attacks']):>14}"
              f"{str(r['fpr'])+'%':>9}{str(r['fp'])+'/'+str(r['benign']):>10}")
    print("=" * 86)
    print("v14 reference: 97.52%  2993/3069   5.56%   51/918   (ceiling 5.6% FPR)")

    Path(args.out).write_text(json.dumps({
        "harness": "sweep-v16-operating-point/v1",
        "eval": args.eval, "limit": args.limit,
        "v14_reference": {"recall": 97.52, "caught": 2993, "attacks": 3069,
                          "fpr": 5.56, "fp": 51, "benign": 918},
        "fpr_ceiling_pct": 5.6,
        "arms": results,
    }, indent=2), encoding="utf-8")
    print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
