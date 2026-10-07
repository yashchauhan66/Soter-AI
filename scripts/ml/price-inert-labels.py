#!/usr/bin/env python3
"""Price admitting labels that the INPUT allowlist currently discards.

THE DEFECT BEING PRICED
  lib/guard/mlAugment.ts gates INPUT escalation on DEFAULT_INPUT_RELIABLE_LABELS. A
  label outside that set is detected by the model and then thrown away, so no amount
  of retraining can make it protect anyone. The acceptance report surfaces this as a
  deployment blocker for MULTI_TURN_ESCALATION, DATA_EXFILTRATION_ATTEMPT and
  TOXICITY_HARASSMENT: whole spec attack families are measured and discarded.

WHY PRICE IT INSTEAD OF JUST WIDENING THE ALLOWLIST
  The allowlist is a precision control. Widening it is the cheapest possible "recall
  win" to write and one of the easiest ways to ship a worse product, because the cost
  lands on benign traffic where nobody is looking. V17-DECISION-AND-ULTRA-PLAN.md
  phase 0.2 sets the rule this script enforces: admit only if benign FPR rises by no
  more than ~0.3 points.

WHAT IS MEASURED
  Benefit is NOT bounded by how many rows carry that gold label. The gate keys off the
  model's argmax, so any attack row the model predicts as an inert label is discarded
  today regardless of its gold label. Benefit is therefore every attack row that passes
  the common gate and is currently rejected only because its argmax is inert.

  Because argmax is single-valued, per-label admissions are disjoint by construction:
  admitting {A, B} rescues exactly the union of admitting A and admitting B. The script
  ASSERTS this rather than assuming it, so an interaction (which would mean the gate is
  not what this model of it says) fails loudly instead of quietly biasing the verdict.

🚨 WHAT AN "ADMIT" HERE IS NOT
  This prices the ML TIER IN ISOLATION. The product runs rules first, and the rules tier
  already catches most of what widening appears to rescue — so an attack counted as
  "rescued" here was, in the product, very often never lost. The false positives are not
  discounted the same way: a benign row the widened gate flags is new in full.
  ADMIT therefore OVERSTATES the gain and states the cost accurately, which is the
  dangerous direction for a precision control.

  Measured, v14, DATA_EXFILTRATION_ATTEMPT, same 4,000 rows, 2026-09-22:
      ML tier alone (this script)   +37 attacks rescued / +2 false positives
      real product path             +1  attack  rescued / +1 false positive
  A 37x overstatement, which turned a comfortable ADMIT into HOLD OUT. Cause: 19 of the
  24 gold rows are caught by rules alone and all 24 are caught at product baseline.

  So: USE THIS TO FIND CANDIDATES, NEVER TO APPLY ONE. Confirm every ADMIT through the
  real path before changing SOTERAI_ML_INPUT_TRUSTED_LABELS:
      npx tsx scripts/ml/measure-gate-widening.ts --file <rows> --out <report> \
        --only <LABEL>

No inference runs. Consumes the same caches as eval-acceptance.py and re-decides
through compare-v18-bases.py, imported rather than reimplemented.
"""
import argparse
import hashlib
import importlib.util
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
DECISION_LAYER = Path(__file__).resolve().parent / "compare-v18-bases.py"

# Phase 0.2's admission budget, in FPR points (0.003 = 0.3 points).
DEFAULT_FPR_BUDGET = 0.003

# Attacks a label must rescue per new false positive. A trade can sit inside the FPR
# budget and still be plainly bad — 1 attack for 5 benign blocks is inside 0.3 points on
# a 2,000-row benign set. This is the same 5:1 rule measure-gate-widening.ts applies on
# the real path; the two instruments must not disagree about what "favourable" means.
MIN_RESCUE_PER_FALSE_POSITIVE = 5


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def display_path(path):
    """Repo-relative when it can be, absolute when it cannot. Never raises."""
    try:
        return str(Path(path).resolve().relative_to(ROOT))
    except ValueError:
        return str(path)


def load_decision_layer():
    spec = importlib.util.spec_from_file_location("compare_v18_bases", DECISION_LAYER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    for required in ("decisions", "metrics", "wilson", "read_rows", "RELIABLE"):
        if not hasattr(module, required):
            raise RuntimeError(f"{DECISION_LAYER.name} is missing {required}(); decision layer moved")
    return module


DECISIONS = load_decision_layer()
DECISION_LAYER_SHA = sha(DECISION_LAYER)


def price_label(probabilities, labels, content_lengths, calibration, truth,
                baseline_flags, candidates):
    """Effect of admitting `candidates` on top of the baseline gate."""
    widened = DECISIONS.decisions(probabilities, labels, content_lengths, calibration,
                                  extra_allowed=set(candidates))["shared_input_gate_with_extra"]
    # Admission can only add flags. If it ever removes one, the gate is not monotonic
    # in the allowlist and every number below would be meaningless.
    removed = int((baseline_flags & ~widened).sum())
    if removed:
        raise RuntimeError(
            f"Admitting {sorted(candidates)} REMOVED {removed} flags. The allowlist is "
            "supposed to be monotonic; the decision layer changed shape.")
    newly = widened & ~baseline_flags
    before, after = DECISIONS.metrics(truth, baseline_flags), DECISIONS.metrics(truth, widened)
    rescued, new_fp = newly & truth, newly & ~truth
    return {
        "labels": sorted(candidates),
        "attacks_rescued": int(rescued.sum()),
        "new_false_positives": int(new_fp.sum()),
        "recall_before": before["recall"], "recall_after": after["recall"],
        "fpr_before": before["fpr"], "fpr_after": after["fpr"],
        "delta_recall_points": (after["recall"] - before["recall"]) * 100,
        "delta_fpr_points": (after["fpr"] - before["fpr"]) * 100,
        "_rescued_mask": rescued, "_new_fp_mask": new_fp,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--scores-dir", type=Path, required=True)
    parser.add_argument("--rows", type=Path, required=True)
    parser.add_argument("--out", type=Path, default=ROOT / "artifacts/ml/inert-label-pricing.json")
    parser.add_argument("--gate", default="shared_input_gate")
    parser.add_argument("--fpr-budget-points", type=float, default=DEFAULT_FPR_BUDGET * 100,
                        help="Maximum benign FPR rise, in points, that admission may cost")
    parser.add_argument("--min-rescued-attacks", type=int, default=10,
                        help="Attacks a label must rescue before the gain counts as measured "
                             "rather than noise; below it the verdict is INSUFFICIENT-EVIDENCE")
    args = parser.parse_args()

    rows = DECISIONS.read_rows(args.rows)
    # Must match eval-acceptance.py and the caches exactly: the digest is over the
    # PARSED rows in canonical form, not the file bytes, so a reformatted battery with
    # identical content still matches its caches.
    rows_digest = hashlib.sha256(
        json.dumps(rows, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    truth = np.array([r["label"] != "SAFE" for r in rows])
    gold = np.array([r["label"] for r in rows])

    report = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "rows": {"path": display_path(args.rows), "count": len(rows),
                 "sha256": rows_digest,
                 "attacks": int(truth.sum()), "benign": int((~truth).sum())},
        "decision_layer": {"file": DECISION_LAYER.name, "sha256": DECISION_LAYER_SHA},
        "baseline_gate": args.gate,
        "current_allowlist": sorted(DECISIONS.RELIABLE),
        "fpr_budget_points": args.fpr_budget_points,
        "min_rescued_attacks": args.min_rescued_attacks,
        "budget_source": "V17-DECISION-AND-ULTRA-PLAN.md phase 0.2",
        "scope": ("ML TIER ONLY — rules are excluded. attacks_rescued is therefore an "
                  "UPPER BOUND on what widening buys the product, while "
                  "new_false_positives is accurate. ADMIT-CANDIDATE means 'measure this "
                  "on the real path', never 'apply this'. Measured 2026-09-22: v14 "
                  "DATA_EXFILTRATION_ATTEMPT priced +37/+2 here and measured +1/+1 "
                  "through rules+ML on the identical rows."),
        "arms": {},
    }

    caches = sorted(args.scores_dir.glob("*-scores.json"))
    # A mistyped --scores-dir used to glob nothing, write a report with zero arms and
    # exit 0 — a clean-looking artifact that priced nothing at all. Refuse instead.
    if not caches:
        raise SystemExit(
            f"No *-scores.json under {display_path(args.scores_dir)}. Nothing was priced, "
            "so nothing will be written. Score the arms first with compare-v18-bases.py "
            "--out <dir>, then point --scores-dir at that directory.")

    for cache_path in caches:
        name = cache_path.name[: -len("-scores.json")]
        cached = json.loads(cache_path.read_text(encoding="utf-8"))
        if cached["identity"].get("rows_sha256") != rows_digest:
            raise SystemExit(
                f"{name}: cache was scored on different rows than {args.rows.name}. "
                "Refusing to report: pricing against the wrong rows is not pricing.")
        labels = cached["identity"]["labels"]
        probabilities = np.asarray(cached["probabilities"], dtype=float)
        baseline = DECISIONS.decisions(probabilities, labels, cached["content_lengths"],
                                       cached["calibration"])[args.gate]
        predicted = np.array([labels[i] for i in probabilities.argmax(axis=1)])

        # Every label this artifact can emit that INPUT currently discards. Pricing only
        # the three the acceptance report names would hide the rest of the same defect.
        candidates = sorted(set(labels) - set(DECISIONS.RELIABLE) - {"SAFE"})
        singles = []
        for label in candidates:
            priced = price_label(probabilities, labels, cached["content_lengths"],
                                 cached["calibration"], truth, baseline, {label})
            rescued_mask, fp_mask = priced.pop("_rescued_mask"), priced.pop("_new_fp_mask")
            priced["gold_rows_with_this_label"] = int((gold == label).sum())
            priced["rescued_by_gold_label"] = {
                g: int(((gold == g) & rescued_mask).sum())
                for g in sorted(set(gold[rescued_mask]))}
            priced["predicted_this_label"] = int((predicted == label).sum())
            within = priced["delta_fpr_points"] <= args.fpr_budget_points
            enough = priced["attacks_rescued"] >= args.min_rescued_attacks
            favourable = (priced["attacks_rescued"]
                          >= priced["new_false_positives"] * MIN_RESCUE_PER_FALSE_POSITIVE)
            if priced["attacks_rescued"] == 0 and priced["new_false_positives"] == 0:
                priced["verdict"] = "NO-OP"
                priced["why"] = ("No row passes the common gate with this argmax, so admitting "
                                 "it changes nothing on these rows. Not evidence that it is safe "
                                 "to admit, only that this battery cannot see it.")
            elif priced["attacks_rescued"] == 0:
                priced["verdict"] = "REJECT"
                priced["why"] = "Costs false positives and rescues no attack."
            elif not within:
                priced["verdict"] = "REJECT"
                priced["why"] = (f"{priced['delta_fpr_points']:+.3f} FPR points exceeds the "
                                 f"{args.fpr_budget_points:.2f}-point budget.")
            elif not favourable:
                # Inside the budget is not the same as worth it. On a 2,000-row benign set
                # a handful of false positives barely moves FPR, so the budget alone would
                # wave through a 1-attack-for-5-blocks trade.
                priced["verdict"] = "REJECT"
                priced["why"] = (f"{priced['attacks_rescued']} attack(s) for "
                                 f"{priced['new_false_positives']} false positive(s) is below "
                                 f"the {MIN_RESCUE_PER_FALSE_POSITIVE}:1 rule, even though "
                                 f"{priced['delta_fpr_points']:+.3f} FPR points is inside the "
                                 "budget. A small benign set hides a bad ratio.")
            elif not enough:
                # A one-or-two-row gain is a coin flip, not a measurement. Admitting on it
                # is how an allowlist grows past what any evidence supports.
                priced["verdict"] = "INSUFFICIENT-EVIDENCE"
                priced["why"] = (f"Only {priced['attacks_rescued']} attack(s) rescued, below the "
                                 f"{args.min_rescued_attacks}-row floor. The trade may well be "
                                 "good; this battery cannot show that it is.")
            else:
                priced["verdict"] = "ADMIT-CANDIDATE"
                priced["why"] = (f"Rescues {priced['attacks_rescued']} attacks for "
                                 f"{priced['new_false_positives']} new false positives, "
                                 f"{priced['delta_fpr_points']:+.3f} FPR points, inside the "
                                 f"{args.fpr_budget_points:.2f}-point budget — ON THE ML TIER "
                                 "ALONE. Not an instruction to widen the allowlist: confirm on "
                                 "the real path with measure-gate-widening.ts --only "
                                 f"{sorted(candidates)[0]} first. A v14 label that priced at "
                                 "+37/+2 here measured +1/+1 through rules+ML.")
            singles.append(priced)

        joint = price_label(probabilities, labels, cached["content_lengths"],
                            cached["calibration"], truth, baseline, set(candidates))
        joint.pop("_rescued_mask"), joint.pop("_new_fp_mask")
        # Disjointness check: argmax is single-valued, so the union must be the sum.
        summed_rescued = sum(s["attacks_rescued"] for s in singles)
        summed_fp = sum(s["new_false_positives"] for s in singles)
        if (summed_rescued, summed_fp) != (joint["attacks_rescued"], joint["new_false_positives"]):
            raise RuntimeError(
                f"{name}: per-label effects are not disjoint "
                f"({summed_rescued}/{summed_fp} summed vs {joint['attacks_rescued']}/"
                f"{joint['new_false_positives']} joint). The gate is not argmax-keyed.")

        # NOT "recommended_admission" — nothing here recommends a change. These are the
        # labels worth spending a real-path run on, which is a different claim.
        candidates_to_confirm = [s["labels"][0] for s in singles
                                 if s["verdict"] == "ADMIT-CANDIDATE"]
        recommended = price_label(probabilities, labels, cached["content_lengths"],
                                  cached["calibration"], truth, baseline,
                                  set(candidates_to_confirm)) \
            if candidates_to_confirm else None
        if recommended:
            recommended.pop("_rescued_mask"), recommended.pop("_new_fp_mask")

        report["arms"][name] = {
            "emittable_labels": len(labels),
            "candidates": candidates,
            "baseline": DECISIONS.metrics(truth, baseline),
            "per_label": singles,
            "all_candidates_admitted": joint,
            "confirm_on_real_path": candidates_to_confirm,
            "effect_ml_tier_only": recommended,
            "apply_requires": (
                "Real-path confirmation via scripts/ml/measure-gate-widening.ts --only "
                "<LABEL>. ML-tier pricing overstates the gain because the rules tier "
                "already catches most of the rescued rows; it does NOT overstate the "
                "false positives, which are new in full."),
        }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"Inert-label pricing -- {args.rows.name} ({len(rows)} rows, "
          f"{int(truth.sum())} attacks / {int((~truth).sum())} benign)")
    print(f"baseline gate={args.gate}  budget=+{args.fpr_budget_points:.2f} FPR points  "
          f"decision layer {DECISION_LAYER.name}@{DECISION_LAYER_SHA[:12]}\n")
    for name, arm in report["arms"].items():
        print(f"{name}  (baseline recall {arm['baseline']['recall']:.4f} / "
              f"fpr {arm['baseline']['fpr']:.4f})")
        print(f"  {'label':<28} {'gold':>5} {'resc':>5} {'newFP':>6} "
              f"{'dRecall':>9} {'dFPR':>8}  verdict")
        for s in arm["per_label"]:
            print(f"  {s['labels'][0]:<28} {s['gold_rows_with_this_label']:>5} "
                  f"{s['attacks_rescued']:>5} {s['new_false_positives']:>6} "
                  f"{s['delta_recall_points']:>+8.3f}p {s['delta_fpr_points']:>+7.3f}p  "
                  f"{s['verdict']}")
        if arm["effect_ml_tier_only"]:
            r = arm["effect_ml_tier_only"]
            print(f"  -> ML-tier candidates {arm['confirm_on_real_path']}: recall "
                  f"{r['recall_before']:.4f} -> {r['recall_after']:.4f} "
                  f"({r['delta_recall_points']:+.3f}p), fpr {r['fpr_before']:.4f} -> "
                  f"{r['fpr_after']:.4f} ({r['delta_fpr_points']:+.3f}p)")
            print("     NOT AN INSTRUCTION TO WIDEN. Confirm on the real path first:")
            print("       npx tsx scripts/ml/measure-gate-widening.ts --file <rows> "
                  f"--out <report> --only {','.join(arm['confirm_on_real_path'])}")
        else:
            print("  -> nothing to confirm: no candidate both rescues attacks and stays "
                  "in budget")
        print()
    print(f"Written: {display_path(args.out)}")


if __name__ == "__main__":
    main()
