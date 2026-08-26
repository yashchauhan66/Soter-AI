#!/usr/bin/env python3
"""
Sweep the per-label threshold CLAMP FLOOR for a SoterLLM artifact.

WHY THIS EXISTS
  train-soterllm-v12-transfer.py::fit_per_label_thresholds ends with

      thresholds[name] = float(max(0.05, min(0.5, sorted_scores[...])))

  so a fitted value below 0.05 is recorded AS 0.05. That is fine as a record, but
  0.05 is not a gate for a 14-class model: the argmax probability of a K-class
  softmax is at least 1/K, and 1/14 = 0.0714 > 0.05. So for every v12 label parked
  at the clamp, `confidence >= threshold` is TRUE for arithmetic reasons and can
  never once fire. v7's clamp landed at 0.15 against a 1/9 = 0.1111 minimum, so
  v7's gate does bite; v12's does not.

  It compounds with lib/ml/onnxBackend.ts::decide, where the global floor is

      } else if (!isSafePred && confidence < this.options.confidenceFloor) {
        if (this.calibration.per_label_thresholds[predictedLabel] === undefined) {

  — the global ML_ONNX_CONFIDENCE_FLOOR (0.5 in .env) applies ONLY to labels with
  NO per-label threshold. v12 defines all 14, so a label sitting at the inert clamp
  is strictly WEAKER than a label with no threshold at all: it neither gates on its
  own nor lets the 0.5 floor gate for it.

  Six of the eight labels on DEFAULT_INPUT_RELIABLE_LABELS are at that clamp in
  v12 (JAILBREAK, PII, SECRET, RAG_POISONING, ENCODING_OBFUSCATION,
  MODEL_EXTRACTION). Only PROMPT_INJECTION (0.3244) and
  SYSTEM_PROMPT_LEAK_ATTEMPT (0.5) were genuinely fitted, and this sweep does not
  touch those two — a fitted operating point is evidence; a clamp artifact is not.

WHAT IS MEASURED
  Escalation as mlAugment would compute it on INPUT: label must be on the
  allowlist. Detection% = escalation rate over attack rows, FPR% = escalation rate
  over benign rows. Selected on one row half, verified on the DISJOINT other half,
  because that is where the last operating-point sweep's real cost appeared.

HONESTY BOUNDS
  * Only 4 of 14 classes appear in this corpus's gold labels, so a row the model
    names RAG_POISONING while gold says PROMPT_INJECTION still counts as detected
    (mlAugment escalates on label membership, not on gold agreement). Raising a
    clamped threshold can therefore LOSE detection on such rows, and that loss is
    real and shows up below.
  * labelSpaceUncertain (truncated views) and the semantic-benign veto are not
    modelled; both can only REMOVE escalations, so every det% and fp% is an upper
    bound.
  * A threshold that lowers FPR on THIS corpus is not thereby proven on the
    meta-instructional benign slice measured by
    scripts/guard-benchmark/_audit-mlbias-2026-08-02.ts. Different distribution.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

ALLOWLIST = ["PROMPT_INJECTION", "JAILBREAK", "SYSTEM_PROMPT_LEAK_ATTEMPT",
             "PII", "SECRET", "RAG_POISONING",
             "ENCODING_OBFUSCATION", "MODEL_EXTRACTION"]
CLAMP = 0.05


def binary_entropy(p: np.ndarray) -> np.ndarray:
    p = np.clip(p, 0.0, 1.0)
    out = np.zeros_like(p)
    m = (p > 1e-12) & (p < 1 - 1e-12)
    pm = p[m]
    out[m] = -(pm * np.log(pm) + (1 - pm) * np.log(1 - pm))
    return out


def decide(probs, labels, thresholds, conf_floor, abstain_floor, entropy_budget):
    """Vectorised lib/ml/onnxBackend.ts::decide for a COMPLETE view."""
    idx = probs.argmax(axis=1)
    conf = probs[np.arange(len(probs)), idx]
    pred = np.array(labels, dtype=object)[idx]
    p_attack = 1.0 - probs[:, 0]
    is_safe = pred == "SAFE"

    decision_conf = np.maximum(p_attack, 1.0 - p_attack)
    abstained = (~is_safe) & ((decision_conf < abstain_floor) |
                              (binary_entropy(p_attack) > entropy_budget))

    thr = [thresholds.get(l) for l in labels]
    has_thr = np.array([t is not None for t in thr])
    thr_num = np.array([float(t) if t is not None else np.nan for t in thr])
    clears = is_safe | (has_thr[idx] & (conf >= thr_num[idx]))
    global_fail = (~is_safe) & (~has_thr[idx]) & (conf < conf_floor)

    final = pred.copy()
    final[abstained | (~clears) | global_fail] = "SAFE"
    return final


def rate(n, d):
    return 100.0 * n / d if d else 0.0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--npz", required=True)
    ap.add_argument("--model-dir", required=True)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    z = np.load(args.npz, allow_pickle=True)
    probs = z["probs"].astype(np.float64)
    labels = [str(x) for x in z["labels"]]
    gold = np.array([str(x) for x in z["gold"]], dtype=object)
    contaminated = z["contaminated"] if "contaminated" in z.files else np.zeros(len(probs), bool)
    keep = ~contaminated
    probs, gold = probs[keep], gold[keep]

    cal = json.loads((Path(args.model_dir) / "calibration.json").read_text(encoding="utf-8"))
    base_thr = dict(cal["per_label_thresholds"])
    abstain_floor = float(cal["ood"].get("suggested_abstain_max_prob", 0.35))
    conf_floor, entropy_budget = 0.5, 0.40      # .env today

    k = len(labels)
    min_argmax = 1.0 / k
    clamped = sorted(l for l, t in base_thr.items()
                     if l != "SAFE" and abs(float(t) - CLAMP) < 1e-9)
    fitted = sorted(l for l, t in base_thr.items()
                    if l != "SAFE" and abs(float(t) - CLAMP) >= 1e-9)

    print("=" * 78)
    print(f"per-label threshold clamp sweep — {args.model_dir}")
    print("=" * 78)
    print(f"rows: {len(probs):,} clean ({int(contaminated.sum())} contaminated dropped)")
    print(f"labels: {k}   minimum possible argmax = 1/{k} = {min_argmax:.4f}")
    print(f"\nat the {CLAMP} clamp ({len(clamped)}): {clamped}")
    print(f"genuinely fitted ({len(fitted)}): "
          f"{ {l: round(float(base_thr[l]), 4) for l in fitted} }")
    print(f"\nARITHMETIC: {CLAMP} < {min_argmax:.4f}, so every clamped gate above is")
    print("provably inert — `confidence >= threshold` cannot be false for them.")
    inert_allowed = [l for l in clamped if l in ALLOWLIST]
    print(f"of those, ON the INPUT allowlist ({len(inert_allowed)}/{len(ALLOWLIST)}): {inert_allowed}")

    is_attack = gold != "SAFE"
    print(f"\ngold: {int(is_attack.sum()):,} attack / {int((~is_attack).sum()):,} benign")
    print(f"gold classes present: {sorted(set(gold.tolist()))}  "
          f"({k - len(set(gold.tolist()))} of {k} classes have no gold rows here)")

    rng = np.random.RandomState(20260820)
    half = rng.rand(len(probs)) < 0.5

    def measure(mask, thresholds):
        f = decide(probs[mask], labels, thresholds, conf_floor, abstain_floor, entropy_budget)
        esc = np.isin(f, ALLOWLIST)
        a, b = is_attack[mask], ~is_attack[mask]
        return (rate(int((esc & a).sum()), int(a.sum())),
                rate(int((esc & b).sum()), int(b.sum())))

    print("\n" + "-" * 78)
    print("raising ONLY the clamped labels to a floor T; fitted labels untouched")
    print("-" * 78)
    print(f"{'T':>7} | {'SELECT det%':>11} {'SELECT fp%':>10} | "
          f"{'VERIFY det%':>11} {'VERIFY fp%':>10} | note")
    print("-" * 78)

    grid = []
    base_sd, base_sf = measure(half, base_thr)
    base_vd, base_vf = measure(~half, base_thr)
    for T in [CLAMP, round(min_argmax, 4), 0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50]:
        thr = dict(base_thr)
        for l in clamped:
            thr[l] = max(float(base_thr[l]), T)
        sd, sf = measure(half, thr)
        vd, vf = measure(~half, thr)
        note = ""
        if abs(T - CLAMP) < 1e-9:
            note = "shipped (inert)"
        elif abs(T - round(min_argmax, 4)) < 1e-9:
            note = f"= 1/{k}, first value that can fire"
        elif abs(T - 0.15) < 1e-9:
            note = "v7's clamp"
        grid.append({"T": T, "select_det_pct": sd, "select_fpr_pct": sf,
                     "verify_det_pct": vd, "verify_fpr_pct": vf,
                     "verify_det_delta": vd - base_vd, "verify_fpr_delta": vf - base_vf})
        print(f"{T:>7.4f} | {sd:>10.2f}% {sf:>9.2f}% | {vd:>10.2f}% {vf:>9.2f}% | {note}")

    print("-" * 78)
    print("VERIFY-half deltas vs the shipped clamp (the number that decides this):")
    for g in grid:
        if abs(g["T"] - CLAMP) < 1e-9:
            continue
        print(f"  T={g['T']:<7.4f} det {g['verify_det_delta']:+6.2f} pts   "
              f"fpr {g['verify_fpr_delta']:+6.2f} pts")

    out = {
        "npz": args.npz, "model_dir": args.model_dir, "rows_clean": int(len(probs)),
        "labels": k, "min_possible_argmax": min_argmax,
        "clamped_labels": clamped, "fitted_labels": {l: float(base_thr[l]) for l in fitted},
        "inert_and_allowlisted": inert_allowed,
        "operating_point": {"conf_floor": conf_floor, "abstain_floor": abstain_floor,
                            "entropy_budget": entropy_budget},
        "baseline_verify": {"det_pct": base_vd, "fpr_pct": base_vf},
        "sweep": grid,
        "bounds": [
            "only 4 of 14 classes have gold rows here; escalation counts label "
            "membership, not gold agreement, so raising a clamped threshold can "
            "lose real detection",
            "labelSpaceUncertain and the semantic veto are not modelled — both can "
            "only remove escalations, so every rate is an upper bound",
            "an FPR win here is NOT transferred to the meta-instructional benign "
            "slice in scripts/guard-benchmark/_audit-mlbias-2026-08-02.ts",
        ],
    }
    if args.out:
        Path(args.out).write_text(json.dumps(out, indent=2), encoding="utf-8")
        print(f"\nwrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
