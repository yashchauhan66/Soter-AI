#!/usr/bin/env python3
"""
AC2: head-to-head against the competitors named in the goal spec, on THIS battery.

WHY AC2 MOVED TO THE FRONT
    The original sequencing put competitor benchmarks last. The AC6 frontier
    measurement inverted that: AC6 as written (recall >=99% AND FPR <1%) is
    unreachable -- at FPR 1% the model gives 50.85% recall, and reaching 99% recall
    costs 30% FPR, from AUC 0.9513. So AC6's target has to move, and a target picked
    in a vacuum is unfalsifiable. The only defensible replacement is relative: match
    or beat the best available alternative ON THE SAME ROWS. That makes AC2 a
    prerequisite for AC6, not a victory lap.

HONESTY RULES BAKED IN
    1. UNMEASURABLE is not a pass and is not averaged away. An arm with no
       credentials reports UNMEASURABLE with the exact unblock step, and the summary
       counts it separately. The repo already has the opposite failure on record:
       two in-repo ranking documents were WITHDRAWN after ProtectAI's DeBERTa beat
       SoterAI on a like-for-like corpus.
    2. Scope fairness is reported, not assumed. This battery contains attack classes
       the competitors never claimed (PII, SECRET, RAG poisoning, content harm).
       Scoring a prompt-injection classifier on those is unfair to it, so every arm
       is reported twice: FULL battery, and the IN-SCOPE subset (PROMPT_INJECTION +
       JAILBREAK attacks, all benign rows -- FPR is always in scope). The in-scope
       number is the fair head-to-head; the full number is the product-level one.
    3. Comparison is at matched operating points, not at whatever default each
       vendor ships. AUC is threshold-free. Iso-FPR recall answers the question that
       actually matters: at the SAME false-positive rate, who catches more?
    4. SoterAI's numbers are not recomputed here. They come from
       scripts/ml/export-soterai-scores.ts, i.e. from production code, because
       re-implementing the guard in Python would compare a competitor to a lookalike.

    python scripts/ml/ac2-competitor-benchmark.py
"""
from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BATTERY = ROOT / "artifacts/ml/v18-balanced-comparison-rows.jsonl"
SOTER_SCORES = ROOT / "artifacts/ml/soterai-per-row-scores-2026-10-02.json"
OUT = ROOT / "artifacts/ml/ac2-competitor-benchmark-2026-10-02.json"

# Attack labels the prompt-injection competitors actually claim to cover. Anything
# else in the battery is out of their advertised scope.
IN_SCOPE_ATTACK_LABELS = {"PROMPT_INJECTION", "JAILBREAK", "SYSTEM_PROMPT_LEAK_ATTEMPT"}

# The four the goal spec names. AC2 cannot pass while any of these is unscored,
# whatever other arms happen to run.
NEMO_ARM = "NVIDIA NeMo Guardrails (model-based jailbreak rail)"
NAMED_COMPETITORS = (
    "Meta PromptGuard 2 (86M)",
    "Lakera Guard",
    "Azure AI Prompt Shields",
    NEMO_ARM,
)
# A jailbreak detector judged on prompt-injection and prompt-leak rows is judged
# outside its stated scope. Every arm is also scored on JAILBREAK attacks alone, so
# NemoGuard can be compared on its home turf.
JAILBREAK_ONLY = {"JAILBREAK"}


@dataclass
class ArmResult:
    name: str
    status: str                      # MEASURED | UNMEASURABLE
    unblock: str = ""
    scores: list[float] = field(default_factory=list)   # P(attack) per row, battery order
    truncated: list[bool] = field(default_factory=list)  # per row: input exceeded the window
    notes: str = ""


def auc_score(y_true: list[int], y_score: list[float]) -> float:
    """Mann-Whitney AUC with tie handling (average ranks)."""
    paired = sorted(zip(y_score, y_true), key=lambda p: p[0])
    ranks: list[float] = [0.0] * len(paired)
    i = 0
    while i < len(paired):
        j = i
        while j + 1 < len(paired) and paired[j + 1][0] == paired[i][0]:
            j += 1
        avg = (i + j) / 2.0 + 1.0
        for k in range(i, j + 1):
            ranks[k] = avg
        i = j + 1
    n_pos = sum(t for _, t in paired)
    n_neg = len(paired) - n_pos
    if n_pos == 0 or n_neg == 0:
        return float("nan")
    rank_sum = sum(r for r, (_, t) in zip(ranks, paired) if t == 1)
    return (rank_sum - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg)


def recall_at_fpr(y_true: list[int], y_score: list[float], target_fpr: float) -> tuple[float, float]:
    """Max recall achievable while FPR <= target. Returns (recall, achieved_fpr)."""
    pos = sorted((s for s, t in zip(y_score, y_true) if t == 1))
    neg = sorted((s for s, t in zip(y_score, y_true) if t == 0))
    if not pos or not neg:
        return float("nan"), float("nan")
    best = (0.0, 0.0)
    for thr in sorted(set(y_score)):
        fpr = sum(1 for s in neg if s >= thr) / len(neg)
        if fpr <= target_fpr:
            rec = sum(1 for s in pos if s >= thr) / len(pos)
            if rec > best[0]:
                best = (rec, fpr)
    return best


def load_arm(arm: str, label: str, n_rows: int) -> ArmResult:
    """
    Read a cached arm score file written by score-competitor-arm.py.

    Scoring lives in that script because 4,000 CPU inferences do not fit in one
    background window -- two runs were killed mid-flight before it was split out.
    This comparison stays pure and instant, so it can be re-run freely as new arms
    land without re-paying for inference.
    """
    path = ROOT / f"artifacts/ml/arm-scores-{arm}.json"
    if not path.exists():
        return ArmResult(label, "UNMEASURABLE",
                         unblock=f"python scripts/ml/score-competitor-arm.py --arm {arm}")
    d = json.loads(path.read_text(encoding="utf-8"))
    scores = d.get("scores") or []
    if len(scores) != n_rows:
        return ArmResult(label, "UNMEASURABLE",
                         unblock=f"{path.name} has {len(scores)} rows, battery has {n_rows}; rescore")
    missing = sum(1 for s in scores if s is None)
    if missing:
        return ArmResult(
            label, "UNMEASURABLE",
            unblock=f"scoring incomplete ({n_rows - missing}/{n_rows}); re-run "
                    f"score-competitor-arm.py --arm {arm} (it resumes)",
        )
    return ArmResult(label, "MEASURED", scores=[float(s) for s in scores],
                     truncated=[bool(t) for t in (d.get("truncated") or [])],
                     notes=str(d.get("notes") or ""))


def blocked(name: str, unblock: str) -> ArmResult:
    return ArmResult(name, "UNMEASURABLE", unblock=unblock)


def main() -> int:
    if not BATTERY.exists():
        print(f"[FATAL] battery not found: {BATTERY}", file=sys.stderr)
        return 2
    if not SOTER_SCORES.exists():
        print(f"[FATAL] SoterAI per-row scores not found: {SOTER_SCORES}", file=sys.stderr)
        print("        Run: npx tsx scripts/ml/export-soterai-scores.ts", file=sys.stderr)
        print("        Refusing to benchmark competitors with no baseline to compare against.",
              file=sys.stderr)
        return 2

    rows = [json.loads(l) for l in BATTERY.read_text(encoding="utf-8").splitlines() if l.strip()]
    soter = json.loads(SOTER_SCORES.read_text(encoding="utf-8"))
    per_row = soter["perRow"]
    if len(per_row) != len(rows):
        print(f"[FATAL] score dump has {len(per_row)} rows, battery has {len(rows)}; they are not",
              file=sys.stderr)
        print("        the same evaluation. Re-export. Refusing.", file=sys.stderr)
        return 2

    texts = [r["text"] for r in rows]
    y_true = [0 if r["label"] == "SAFE" else 1 for r in rows]
    in_scope = [
        (r["label"] == "SAFE") or (r["label"] in IN_SCOPE_ATTACK_LABELS)
        for r in rows
    ]
    jb_only = [(r["label"] == "SAFE") or (r["label"] in JAILBREAK_ONLY) for r in rows]

    arms: list[ArmResult] = []
    # The EXACT score is the comparison arm. The production-reported score is rounded
    # to 4 decimals (onnxBackend.ts:673); SoterAI's 1%-FPR threshold sits at 0.9995,
    # inside the band that rounding collapses, so a low-FPR comparison on it measures
    # the quantisation rather than the model. An export without exact scores predates
    # that finding and is refused rather than silently used.
    if any("soterScoreExact" not in p for p in per_row):
        print("[FATAL] SoterAI dump has no soterScoreExact (it predates the 4-decimal rounding",
              file=sys.stderr)
        print("        finding). Re-run: npx tsx scripts/ml/export-soterai-scores.ts. Refusing.",
              file=sys.stderr)
        return 2
    soter_exact = [p["soterScoreExact"] for p in per_row]
    soter_rounded = [p["soterScore"] for p in per_row]
    if any(s is None for s in soter_exact) or any(s is None for s in soter_rounded):
        print("[FATAL] SoterAI dump contains null scores. Refusing.", file=sys.stderr)
        return 2
    arms.append(ArmResult("SoterAI v17-multilingual (ML score)", "MEASURED",
                          scores=[float(s) for s in soter_exact],
                          notes="exact P(attack) from production's own decide(), pre-rounding"))
    # Diagnostic only: never gates the verdict (beats_soter compares against the arm
    # above, which is found first), and is excluded from the loss lists by name.
    arms.append(ArmResult("SoterAI v17-multilingual (rounded, as reported)", "MEASURED",
                          scores=[float(s) for s in soter_rounded],
                          notes="DIAGNOSTIC: production's 4-decimal score; shows the quantisation cost"))

    print("\nAC2 head-to-head — scoring arms on the identical battery\n")
    arms.append(load_arm("protectai", "ProtectAI deberta-v3-base-prompt-injection-v2", len(rows)))
    arms.append(blocked("Meta PromptGuard 2 (86M)",
                        "HF repo is gated=manual: accept the licence at "
                        "huggingface.co/meta-llama/Llama-Prompt-Guard-2-86M, then set HF_TOKEN"))
    arms.append(blocked("Lakera Guard", "set LAKERA_API_KEY (commercial API)"))
    arms.append(blocked("Azure AI Prompt Shields",
                        "set AZURE_CONTENT_SAFETY_ENDPOINT and AZURE_CONTENT_SAFETY_KEY"))
    # NeMo Guardrails is a framework; its model-based jailbreak rail is the
    # NemoGuard-JailbreakDetect model, replicated from NVIDIA's own source. The arm
    # is named for exactly what it is -- not "NeMo Guardrails" in every configuration
    # (an LLM self-check rail would be a different arm).
    arms.append(load_arm("nemoguard", NEMO_ARM, len(rows)))

    # SoterAI's DEPLOYED operating point, for the iso-FPR comparison target.
    soter_fpr = sum(1 for p in per_row if not p["isAttack"] and p["soterFlagged"]) / \
        max(1, sum(1 for p in per_row if not p["isAttack"]))
    soter_recall = sum(1 for p in per_row if p["isAttack"] and p["soterFlagged"]) / \
        max(1, sum(1 for p in per_row if p["isAttack"]))

    report: dict = {
        "generatedAt": __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).isoformat(),
        "battery": str(BATTERY.relative_to(ROOT)),
        "rows": len(rows),
        "soteraiDeployedOperatingPoint": {
            "fprPct": round(soter_fpr * 100, 2),
            "recallPct": round(soter_recall * 100, 2),
            "note": "real two-tier path (rules OR ML), the product as shipped",
        },
        "scopeNote":
            "FULL = every attack label in the battery, including classes the competitors never "
            "claimed (PII/SECRET/RAG/content-harm) — unfair to them, but it is the product-level "
            "question. IN-SCOPE = PROMPT_INJECTION/JAILBREAK/SYSTEM_PROMPT_LEAK_ATTEMPT attacks "
            "plus all benign rows — the fair head-to-head.",
        "arms": [],
    }

    def evaluate(arm: ArmResult, mask: list[bool]) -> dict | None:
        yt = [t for t, m in zip(y_true, mask) if m]
        ys = [s for s, m in zip(arm.scores, mask) if m]
        if not ys or len(set(yt)) < 2:
            return None
        r_iso, f_iso = recall_at_fpr(yt, ys, soter_fpr)
        r_1, f_1 = recall_at_fpr(yt, ys, 0.01)
        return {
            "auc": round(auc_score(yt, ys), 4),
            "recallAtSoterFprPct": round(r_iso * 100, 2),
            "isoFprPct": round(f_iso * 100, 2),
            "recallAt1PctFpr": round(r_1 * 100, 2),
            "attacks": sum(yt),
            "benign": len(yt) - sum(yt),
        }

    print(f"\n  SoterAI deployed operating point: FPR {soter_fpr*100:.2f}%  recall {soter_recall*100:.2f}%")
    print(f"  (iso-FPR comparisons below use FPR <= {soter_fpr*100:.2f}%)\n")
    common_untrunc = [True] * len(rows)
    for _a in arms:
        if _a.status == "MEASURED" and _a.truncated:
            common_untrunc = [u and not t for u, t in zip(common_untrunc, _a.truncated)]
    n_common_dropped = sum(1 for u in common_untrunc if not u)
    print(f"  common untruncated subset: {len(rows) - n_common_dropped}/{len(rows)} rows\n")
    print(f"  {'arm':52s} {'scope':17s} {'AUC':>7s} {'rec@isoFPR':>11s} {'rec@1%FPR':>10s}")

    measured = 0
    for arm in arms:
        entry: dict = {"name": arm.name, "status": arm.status}
        if arm.status != "MEASURED":
            entry["unblock"] = arm.unblock
            report["arms"].append(entry)
            print(f"  {arm.name:52s} UNMEASURABLE — {arm.unblock[:60]}")
            continue
        measured += 1
        entry["notes"] = arm.notes
        # Truncation is reported as a SCOPE, not just a count. 186 of the 4000 battery
        # rows exceed a 512-token window (83 SAFE, 77 JAILBREAK, 24 PII), and a model
        # with a smaller window loses those rows for a reason that is a deployment
        # limit rather than a detection failure. Penalising it silently would be
        # unfair; hiding the limit would be dishonest. So both numbers are printed.
        n_trunc = sum(arm.truncated) if arm.truncated else 0
        entry["truncatedRows"] = n_trunc
        # COMMON untruncated mask across every MEASURED arm, computed below the loop
        # body's reach via `common_untrunc`. Scoring each arm's untruncated figure on
        # its OWN subset is apples-to-oranges: SoterAI records no truncation, so its
        # subset would be all 4000 rows while ProtectAI's is 186 smaller, and the two
        # numbers would not be comparable. The first version did exactly that and
        # printed a SoterAI "untruncated" AUC identical to its in-scope AUC -- the
        # tell that the mask never reached it.
        entry["full"] = evaluate(arm, [True] * len(rows))
        entry["inScope"] = evaluate(arm, in_scope)
        entry["inScopeUntruncated"] = evaluate(
            arm, [a and b for a, b in zip(in_scope, common_untrunc)]
        )
        entry["inScopeUntruncatedNote"] = (
            f"common subset across all measured arms; {n_common_dropped} rows excluded"
        )
        entry["jailbreakOnly"] = evaluate(arm, jb_only)
        report["arms"].append(entry)
        for scope_name, key in (("FULL", "full"), ("IN-SCOPE", "inScope"),
                                ("IN-SCOPE/UNTRUNC", "inScopeUntruncated"),
                                ("JAILBREAK-ONLY", "jailbreakOnly")):
            m = entry[key]
            if m:
                print(f"  {arm.name:52s} {scope_name:17s} {m['auc']:7.4f} "
                      f"{m['recallAtSoterFprPct']:10.2f}% {m['recallAt1PctFpr']:9.2f}%")
        if n_trunc:
            print(f"  {'':52s} ({n_trunc} rows exceeded the model's window and were truncated)")

    report["measuredArms"] = measured
    report["unmeasurableArms"] = len(arms) - measured

    # The verdict must be able to come out BOTH ways, or it is the same
    # cannot-fail instrument this repo keeps catching. AC2 passes only when every
    # named competitor has actually been scored AND SoterAI is at least as good as
    # each on the agreed metric; it fails when one of them beats SoterAI; it is
    # INCOMPLETE while any arm is unscored. UNMEASURABLE is never a pass.
    named = {a["name"]: a for a in report["arms"] if a["name"] in NAMED_COMPETITORS}
    unscored = [n for n in NAMED_COMPETITORS if named.get(n, {}).get("status") != "MEASURED"]
    soter_entry = next(a for a in report["arms"] if a["name"].startswith("SoterAI"))

    def beats_soter(entry: dict, scope: str) -> bool | None:
        m, s = entry.get(scope), soter_entry.get(scope)
        if not m or not s:
            return None
        return m["auc"] > s["auc"]

    losses = [
        n for n, a in named.items()
        if a.get("status") == "MEASURED" and beats_soter(a, "inScope") is True
    ]
    if unscored:
        verdict = (f"INCOMPLETE — {len(unscored)} of {len(NAMED_COMPETITORS)} named competitors "
                   f"unscored ({', '.join(unscored)}). UNMEASURABLE is not a pass.")
    elif losses:
        verdict = f"FAIL — beaten in-scope (AUC) by: {', '.join(losses)}"
    else:
        verdict = "PASS — SoterAI matches or beats every named competitor on in-scope AUC"
    report["ac2Verdict"] = verdict
    report["namedCompetitorsUnscored"] = unscored
    report["beatenBy"] = losses

    # Scored-but-unnamed arms (e.g. ProtectAI) do not gate AC2, but a loss to one is
    # the single most decision-relevant fact here: ProtectAI has beaten SoterAI
    # before and both in-repo ranking docs were withdrawn over it. Surface it.
    extra_losses = [
        a["name"] for a in report["arms"]
        if a["status"] == "MEASURED" and not a["name"].startswith("SoterAI")
        and a["name"] not in NAMED_COMPETITORS and beats_soter(a, "inScope") is True
    ]
    report["beatenByUnnamedArms"] = extra_losses

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\n  measured arms {measured}, unmeasurable {len(arms) - measured}")
    print(f"  AC2 verdict: {report['ac2Verdict']}")
    print(f"\nwrote {OUT.relative_to(ROOT)}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
