#!/usr/bin/env python3
"""
Blocker 1 + Blocker 2 for the v12 deploy, computed from a pre-dumped probability
matrix (scripts/ml/dump-model-probs.py) so both are numpy, not re-inference.

BLOCKER 1 — should any of v12's five NEW labels join the INPUT allowlist?
  lib/guard/mlAugment.ts::passesPrecisionGate drops any INPUT prediction whose
  label is not in DEFAULT_INPUT_RELIABLE_LABELS. v12 can emit five labels v7
  physically could not, and none of them are on that list, so today every one of
  those predictions is discarded. The list was last widened (3 -> 6 labels) on
  measured FPR evidence, and the same standard applies here: admit a label only if
  it costs no measurable benign false positive.

BLOCKER 2 — v12 ships temperature 1.341 where v7 shipped 0.81, so the abstention
  operating point selected for v7 (SOTERAI_ML_ABSTAIN_ENTROPY=0.40, swept on v7's
  distribution) is not automatically right for v12. Swept here on one row half and
  verified on the DISJOINT other half, because that is where the last sweep's real
  cost showed up (recall gain doubled, FPR cost tripled, held out).

  NOTE ON WHAT DOES *NOT* NEED RE-SWEEPING: SOTERAI_ML_SEMANTIC_MARGIN. That gate
  calls classifySemantic(TEXT) — a rules-tier prototype classifier that never sees
  the model's probabilities. Its verdict on a given string is identical whichever
  model sits behind it, so v7's -0.10 carries to v12 unchanged. It is also why the
  numbers below are an UPPER BOUND on escalations: the veto can only remove more.

HONESTY BOUNDS ON EVERY NUMBER HERE
  * labelSpaceUncertain is NOT modelled: it fires only on a truncated view
    (>256 tokens) and the dump carries no token counts. It can only ADD
    abstention, so measured detection is an upper bound and measured FPR too.
  * The semantic veto is not modelled (see above) — same direction.
  * Only 4 of v12's 14 classes appear in the gold labels of this corpus. Recall
    for the five new labels is therefore UNMEASURABLE here, and this script does
    not pretend otherwise: it measures their FALSE POSITIVE cost, which is the
    half of the evidence that can be measured.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

NEW_V12_LABELS = ["TOOL_CALL_ABUSE", "ENCODING_OBFUSCATION", "MULTI_TURN_ESCALATION",
                  "MODEL_EXTRACTION", "TOXICITY_HARASSMENT"]
CURRENT_ALLOWLIST = ["PROMPT_INJECTION", "JAILBREAK", "SYSTEM_PROMPT_LEAK_ATTEMPT",
                     "PII", "SECRET", "RAG_POISONING"]


def binary_entropy(p: np.ndarray) -> np.ndarray:
    p = np.clip(p, 0.0, 1.0)
    out = np.zeros_like(p)
    m = (p > 1e-12) & (p < 1 - 1e-12)
    pm = p[m]
    out[m] = -(pm * np.log(pm) + (1 - pm) * np.log(1 - pm))
    return out


def decide(probs, labels, thresholds, conf_floor, abstain_floor, entropy_budget):
    """Vectorised lib/ml/onnxBackend.ts::decide for a COMPLETE view (see bounds)."""
    idx = probs.argmax(axis=1)
    conf = probs[np.arange(len(probs)), idx]
    pred = np.array(labels, dtype=object)[idx]
    p_attack = 1.0 - probs[:, 0]
    is_safe = pred == "SAFE"

    decision_conf = np.maximum(p_attack, 1.0 - p_attack)
    abstained = (~is_safe) & ((decision_conf < abstain_floor) |
                              (binary_entropy(p_attack) > entropy_budget))

    thr = np.array([thresholds.get(l, None) for l in labels], dtype=object)
    has_thr = np.array([t is not None for t in thr])
    thr_num = np.array([float(t) if t is not None else np.nan for t in thr])
    clears = is_safe | (has_thr[idx] & (conf >= thr_num[idx]))
    # Global floor only applies where no per-label threshold exists (see decide()).
    global_fail = (~is_safe) & (~has_thr[idx]) & (conf < conf_floor)

    final = pred.copy()
    final[abstained | (~clears) | global_fail] = "SAFE"
    return final, conf, p_attack


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
    print(f"rows: {len(probs):,} clean ({int(contaminated.sum())} contaminated dropped), "
          f"{len(labels)} labels")

    cal = json.loads((Path(args.model_dir) / "calibration.json").read_text(encoding="utf-8"))
    thresholds = cal["per_label_thresholds"]
    abstain_floor = float(cal["ood"].get("suggested_abstain_max_prob", 0.35))
    fitted_binary = cal["ood"].get("binary_entropy_p95")
    conf_floor = 0.5   # ML_ONNX_CONFIDENCE_FLOOR in .env

    is_attack = gold != "SAFE"
    n_atk, n_ben = int(is_attack.sum()), int((~is_attack).sum())
    print(f"      {n_atk:,} attacks / {n_ben:,} benign")
    print(f"gold label space present: {sorted(set(gold.tolist()))}")

    # ── BLOCKER 1 ─────────────────────────────────────────────────────────────
    # Measured at the operating point .env actually runs today (entropy 0.40).
    env_entropy = 0.40
    final, conf, p_atk = decide(probs, labels, thresholds, conf_floor,
                               abstain_floor, env_entropy)

    print("\n" + "=" * 78)
    print("BLOCKER 1 — INPUT allowlist admission evidence for v12's five new labels")
    print("=" * 78)
    print(f"{'label':<26} {'benign rows':>12} {'benign FPR':>11} {'attack rows':>12}")
    print("-" * 78)
    b1 = {}
    for lab in NEW_V12_LABELS:
        nb = int(((final == lab) & ~is_attack).sum())
        na = int(((final == lab) & is_attack).sum())
        b1[lab] = {"benign_rows": nb, "benign_fpr_pct": rate(nb, n_ben), "attack_rows": na}
        print(f"{lab:<26} {nb:>12} {rate(nb, n_ben):>10.3f}% {na:>12}")
    print("-" * 78)
    tot_b = int((np.isin(final, NEW_V12_LABELS) & ~is_attack).sum())
    tot_a = int((np.isin(final, NEW_V12_LABELS) & is_attack).sum())
    print(f"{'ALL FIVE':<26} {tot_b:>12} {rate(tot_b, n_ben):>10.3f}% {tot_a:>12}")
    print("\nattack rows above are rows the model names with a new label INSTEAD of the")
    print("gold class — admitting the label converts each into an escalation; benign")
    print("rows are the false positives that conversion buys. Recall for these classes")
    print("on their OWN gold rows is unmeasurable: this corpus contains none.")

    # ── BLOCKER 2 ─────────────────────────────────────────────────────────────
    # Select on half A, verify on the DISJOINT half B.
    rng = np.random.RandomState(20260820)
    half = rng.rand(len(probs)) < 0.5
    allow = CURRENT_ALLOWLIST

    def measure(mask, floor, budget):
        f, _, _ = decide(probs[mask], labels, thresholds, conf_floor, floor, budget)
        esc = np.isin(f, allow)
        a, b = is_attack[mask], ~is_attack[mask]
        return rate(int((esc & a).sum()), int(a.sum())), rate(int((esc & b).sum()), int(b.sum()))

    print("\n" + "=" * 78)
    print("BLOCKER 2 — abstention operating point on v12 (temperature 1.341, not 0.81)")
    print("=" * 78)
    print("ML-tier only (rules tier excluded); escalations limited to the 6-label allowlist.")
    print(f"selection half: {int(half.sum()):,} rows   verification half: "
          f"{int((~half).sum()):,} rows   (disjoint)")
    print(f"\n{'floor':>6} {'entropy':>9} | {'SELECT det%':>11} {'SELECT fp%':>10} | "
          f"{'VERIFY det%':>11} {'VERIFY fp%':>10}")
    print("-" * 78)
    grid = []
    budgets = [0.05, float(fitted_binary) if fitted_binary else 0.12, 0.20, 0.2029,
               0.30, 0.40, 0.50, 0.6932]
    for floor in (0.55, 0.50):
        for budget in sorted(set(round(b, 4) for b in budgets)):
            sd, sf = measure(half, floor, budget)
            vd, vf = measure(~half, floor, budget)
            tag = ""
            if floor == abstain_floor and abs(budget - env_entropy) < 1e-9:
                tag = "  <- .env today"
            if floor == abstain_floor and fitted_binary and abs(budget - round(float(fitted_binary), 4)) < 1e-9:
                tag += "  <- fitted binary_entropy_p95"
            if abs(budget - 0.6932) < 1e-9:
                tag += "  (entropy gate off: > ln2)"
            grid.append({"abstain_floor": floor, "entropy_budget": budget,
                         "select_detection_pct": sd, "select_fpr_pct": sf,
                         "verify_detection_pct": vd, "verify_fpr_pct": vf})
            print(f"{floor:>6.2f} {budget:>9.4f} | {sd:>10.2f}% {sf:>9.2f}% | "
                  f"{vd:>10.2f}% {vf:>9.2f}%{tag}")
    print("-" * 78)
    print("Bounds: labelSpaceUncertain and the semantic veto are not modelled, and both")
    print("can only REMOVE escalations — every det% and fp% here is an upper bound.")

    out = {
        "npz": args.npz,
        "model_dir": args.model_dir,
        "rows_clean": len(probs),
        "attacks": n_atk,
        "benign": n_ben,
        "gold_labels_present": sorted(set(gold.tolist())),
        "operating_point_measured": {"conf_floor": conf_floor,
                                     "abstain_floor": abstain_floor,
                                     "entropy_budget": env_entropy},
        "blocker1_new_label_costs": b1,
        "blocker1_all_five": {"benign_rows": tot_b, "benign_fpr_pct": rate(tot_b, n_ben),
                              "attack_rows": tot_a},
        "blocker2_sweep": grid,
        "bounds": [
            "labelSpaceUncertain not modelled (no token counts in the dump) — "
            "can only add abstention",
            "semantic-benign veto not modelled (needs text) — can only remove escalations",
            "recall for the five new v12 labels is unmeasurable: no gold rows exist for them",
        ],
    }
    if args.out:
        Path(args.out).write_text(json.dumps(out, indent=2), encoding="utf-8")
        print(f"\nwrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
