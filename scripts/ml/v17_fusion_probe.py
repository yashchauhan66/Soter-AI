#!/usr/bin/env python3
"""Can v14 + v17 together beat either alone? Measured, no training, no new artifact.

Both arms already scored every row of the 13,000-row held-out set, so every fusion rule
is arithmetic over `v17-score-matrix.jsonl`. Nothing here trains or exports a model; it
asks whether the two artifacts on disk are complementary enough to be worth combining.

Fusion rules measured, all at the production INPUT operating point:

  OR         flag if EITHER arm flags        -- upper bound on recall, also on FPR
  AND        flag only if BOTH flag          -- precision play
  MAXPROB    re-decide on max(p_attack)      -- takes the more alarmed arm's label
  MEANPROB   re-decide on averaged probs     -- the usual soft-voting baseline
  ROUTE      language routes the arm         -- v14 on en, v17 otherwise
  CASCADE    v14 first, escalate on doubt    -- what a latency budget can actually afford

The honest costs are reported next to the wins:
  - OR/AND/MAXPROB/MEANPROB run BOTH models on every row: p50 ~= sum of both arms.
  - ROUTE needs a language detector in production. This measures it with the dataset's
    own `language` field, i.e. a PERFECT detector -- a real one's error rate comes off
    the top, so treat ROUTE as an upper bound.
  - CASCADE reports escalation rate, which is the only number that decides whether the
    latency is payable.
"""
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from v17_operating_points import (  # noqa: E402
    MATRIX,
    META,
    WHICH,
    Arm,
    CONF_FLOOR,
    PROD_ENTROPY,
    RELIABLE_INPUT,
    binent,
    flagged,
    mcnemar,
)

# `WHICH` comes from argv in v17_operating_points, so `python v17_fusion_probe.py gate`
# probes the canonical English gate and the bare call probes the 13,000-row held-out set.
OUT = ROOT / "artifacts" / "ml" / (
    "v17-fusion-probe.json" if WHICH == "heldout" else f"v17-fusion-probe-{WHICH}.json"
)

BASE = "v14"
CAND = "v17-candidate-mdistilbert"


def decide_from_probs(arm, probs, truncated):
    """Production verdict for an arbitrary probability vector on `arm`'s label space."""
    return flagged(arm, probs, truncated, mode="prod")


def tally(rows, verdicts):
    tp = fn = fp = tn = 0
    atk, ben = [], []
    for r, hit in zip(rows, verdicts):
        if r["label"] != "SAFE":
            tp, fn = tp + hit, fn + (not hit)
            atk.append(hit)
        else:
            fp, tn = fp + hit, tn + (not hit)
            ben.append(not hit)
    return {
        "recall": tp / (tp + fn),
        "fpr": fp / (fp + tn),
        "tp": tp,
        "fn": fn,
        "fp": fp,
        "tn": tn,
        "_atk": atk,
        "_ben": ben,
    }


def pair_mcnemar(a, b):
    out = {}
    for kind in ("_atk", "_ben"):
        oa = sum(1 for x, y in zip(a[kind], b[kind]) if x and not y)
        ob = sum(1 for x, y in zip(a[kind], b[kind]) if y and not x)
        p = mcnemar(oa, ob)
        out[kind.strip("_")] = {
            "onlyBaseline": oa,
            "onlyFusion": ob,
            "p": p,
            "verdict": "no-sig-diff" if p >= 0.05 else ("fusion-better" if ob > oa else "fusion-worse"),
        }
    return out


def main():
    if not MATRIX.exists():
        sys.exit(f"missing {MATRIX} -- run scripts/ml/v17_score_matrix.py first")
    meta = json.loads(META.read_text(encoding="utf-8"))
    rows = [json.loads(l) for l in MATRIX.read_text(encoding="utf-8").split("\n") if l.strip()]
    arms = {n: Arm(n, m["dir"], m["labelOrder"], m["safeIndex"]) for n, m in meta["arms"].items()}
    a14, a17 = arms[BASE], arms[CAND]

    # The two arms must agree on label order before any probability can be averaged.
    same_space = a14.labels == a17.labels
    print(f"label spaces identical: {same_space}")
    if not same_space:
        print(f"  {BASE}: {a14.labels}\n  {CAND}: {a17.labels}")

    singles, fused = {}, {}
    for n, arm in ((BASE, a14), (CAND, a17)):
        singles[n] = tally(rows, [decide_from_probs(arm, r["arms"][n]["p"], r["arms"][n]["t"] == 1)[0] for r in rows])

    v14_hits = [decide_from_probs(a14, r["arms"][BASE]["p"], r["arms"][BASE]["t"] == 1) for r in rows]
    v17_hits = [decide_from_probs(a17, r["arms"][CAND]["p"], r["arms"][CAND]["t"] == 1) for r in rows]

    # ── OR / AND ──────────────────────────────────────────────────────────────
    fused["OR"] = tally(rows, [a[0] or b[0] for a, b in zip(v14_hits, v17_hits)])
    fused["AND"] = tally(rows, [a[0] and b[0] for a, b in zip(v14_hits, v17_hits)])

    # ── MAXPROB / MEANPROB / WEIGHTED ─────────────────────────────────────────
    if same_space:
        maxv, meanv = [], []
        for r in rows:
            p14, p17 = r["arms"][BASE]["p"], r["arms"][CAND]["p"]
            trunc = (r["arms"][BASE]["t"] == 1) or (r["arms"][CAND]["t"] == 1)
            # MAXPROB: whichever arm assigns more attack mass decides the row outright.
            atk14 = 1.0 - p14[a14.safe]
            atk17 = 1.0 - p17[a17.safe]
            src, arm = (p17, a17) if atk17 >= atk14 else (p14, a14)
            maxv.append(decide_from_probs(arm, src, trunc)[0])
            avg = [(x + y) / 2 for x, y in zip(p14, p17)]
            meanv.append(decide_from_probs(a17, avg, trunc)[0])
        fused["MAXPROB"] = tally(rows, maxv)
        fused["MEANPROB"] = tally(rows, meanv)

        # WEIGHTED: MEANPROB is just w=0.5. Sweeping w is free here and is the only
        # fusion knob that can trade the two arms off continuously rather than in one
        # jump, so it is the fair version of "soft voting" to judge the pair on.
        for w in (0.1, 0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9):
            vs = []
            for r in rows:
                p14, p17 = r["arms"][BASE]["p"], r["arms"][CAND]["p"]
                trunc = (r["arms"][BASE]["t"] == 1) or (r["arms"][CAND]["t"] == 1)
                mix = [w * x + (1 - w) * y for x, y in zip(p14, p17)]
                vs.append(decide_from_probs(a17, mix, trunc)[0])
            fused[f"WEIGHTED_w{w:.1f}_v14"] = tally(rows, vs)

    # ── ROUTE: v14 on English, v17 elsewhere (perfect-detector upper bound) ────
    fused["ROUTE_lang"] = tally(
        rows,
        [(b[0] if r["lang"] not in ("en",) else a[0]) for r, a, b in zip(rows, v14_hits, v17_hits)],
    )

    # ── CASCADE: v14 decides; v17 only sees rows v14 is unsure about ───────────
    cascades = {}
    for band in (0.05, 0.10, 0.20, 0.40, 0.6932):
        verdicts, escalated = [], 0
        for r, a, b in zip(rows, v14_hits, v17_hits):
            p14 = r["arms"][BASE]["p"]
            atk14 = 1.0 - p14[a14.safe]
            unsure = binent(atk14) > band  # v14 sitting near its own decision boundary
            if a[0]:
                verdicts.append(True)  # v14 already flagged; nothing to escalate
            elif unsure:
                escalated += 1
                verdicts.append(b[0])
            else:
                verdicts.append(False)
        t = tally(rows, verdicts)
        t["escalationRate"] = escalated / len(rows)
        cascades[f"band>{band}"] = t
    fused.update({f"CASCADE_{k}": v for k, v in cascades.items()})

    # ── Report ────────────────────────────────────────────────────────────────
    print("\n== SINGLE ARMS (production INPUT point, ML tier only, pre-veto) ==")
    for n, s in singles.items():
        print(f"  {n:26} recall {s['recall']*100:6.2f}%  fpr {s['fpr']*100:6.2f}%  (tp {s['tp']} fp {s['fp']})")

    print("\n== FUSIONS ==")
    print(f"  {'rule':22} {'recall':>8} {'fpr':>8}   {'vs v14 recall':>14} {'vs v14 fpr':>12}   extra")
    report = {"singles": {k: {kk: vv for kk, vv in v.items() if not kk.startswith('_')} for k, v in singles.items()}, "fusions": {}}
    b14 = singles[BASE]
    for name, s in fused.items():
        dr = (s["recall"] - b14["recall"]) * 100
        df = (s["fpr"] - b14["fpr"]) * 100
        extra = f"escalates {s['escalationRate']*100:.1f}%" if "escalationRate" in s else ""
        print(
            f"  {name:22} {s['recall']*100:7.2f}% {s['fpr']*100:7.2f}%   {dr:+13.2f} {df:+11.2f}   {extra}"
        )
        report["fusions"][name] = {
            **{k: v for k, v in s.items() if not k.startswith("_")},
            "dRecallPtsVsV14": dr,
            "dFprPtsVsV14": df,
            "mcnemarVsV14": pair_mcnemar(b14, s),
            "mcnemarVsV17": pair_mcnemar(singles[CAND], s),
        }

    # ── Complementarity: is there anything to fuse at all? ────────────────────
    both = sum(1 for a, b in zip(v14_hits, v17_hits) if a[0] and b[0])
    only14 = sum(1 for a, b in zip(v14_hits, v17_hits) if a[0] and not b[0])
    only17 = sum(1 for a, b in zip(v14_hits, v17_hits) if b[0] and not a[0])
    neither = len(rows) - both - only14 - only17
    atk_only14 = sum(1 for r, a, b in zip(rows, v14_hits, v17_hits) if r["label"] != "SAFE" and a[0] and not b[0])
    atk_only17 = sum(1 for r, a, b in zip(rows, v14_hits, v17_hits) if r["label"] != "SAFE" and b[0] and not a[0])
    print(
        f"\n== COMPLEMENTARITY ==\n  both flag {both}  only-v14 {only14}  only-v17 {only17}  neither {neither}"
        f"\n  attacks caught only by v14: {atk_only14}   only by v17: {atk_only17}"
        f"\n  (a large only-v14 + only-v17 split is what makes fusion worth its latency)"
    )
    report["complementarity"] = {
        "bothFlag": both,
        "onlyV14": only14,
        "onlyV17": only17,
        "neither": neither,
        "attacksOnlyV14": atk_only14,
        "attacksOnlyV17": atk_only17,
    }

    # ── ORACLE: the ceiling every rule above is competing against ─────────────
    # Per row, take whichever arm happens to be RIGHT. This is not a rule -- it needs the
    # label at inference time -- but it is the exact upper bound on what ANY per-row
    # arbitration between these two artifacts can achieve, including a trained router.
    # It is the number that says whether fusion is worth pursuing at all: if the oracle
    # is barely above the better single arm, no router can earn its latency, and the
    # honest answer to "can I beat both?" is "not by combining these two".
    oracle = tally(rows, [(a[0] or b[0]) if r["label"] != "SAFE" else (a[0] and b[0])
                          for r, a, b in zip(rows, v14_hits, v17_hits)])
    best_recall = max(singles[BASE]["recall"], singles[CAND]["recall"])
    best_fpr = min(singles[BASE]["fpr"], singles[CAND]["fpr"])
    headroom_r = (oracle["recall"] - best_recall) * 100
    headroom_f = (best_fpr - oracle["fpr"]) * 100
    print(
        f"\n== ORACLE CEILING (not achievable -- needs the label at inference time) ==\n"
        f"  perfect per-row arbitration: recall {oracle['recall']*100:6.2f}%  fpr {oracle['fpr']*100:6.2f}%\n"
        f"  headroom over the best single arm: {headroom_r:+.2f} recall pts, {headroom_f:+.2f} fpr pts\n"
        f"  (any real router -- language, cascade, learned -- lands strictly inside this)"
    )
    report["oracleCeiling"] = {
        **{k: v for k, v in oracle.items() if not k.startswith("_")},
        "headroomRecallPtsOverBestSingle": headroom_r,
        "headroomFprPtsOverBestSingle": headroom_f,
        "note": "Upper bound on per-row arbitration between these two artifacts. Not a deployable rule.",
    }

    lat = meta["arms"]
    report["latencyNote"] = {
        "v14P50Ms": lat[BASE]["p50"],
        "v17P50Ms": lat[CAND]["p50"],
        "bothP50Ms": lat[BASE]["p50"] + lat[CAND]["p50"],
        "comment": "OR/AND/MAXPROB/MEANPROB pay both arms on every row; CASCADE pays the second only on its escalation rate.",
    }
    OUT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nWrote {OUT}")


if __name__ == "__main__":
    main()
