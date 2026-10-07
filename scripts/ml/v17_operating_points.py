#!/usr/bin/env python3
"""Apply production-faithful decision rules to `v17-score-matrix.jsonl`.

The matrix holds raw probabilities, so every question about the operating point is
arithmetic here rather than a 72-minute rescore.

WHAT "PRODUCTION" MEANS IN THIS FILE — ported from the real path, not approximated:

  lib/ml/onnxBackend.ts decide()          -> backend_decide()
  lib/ml/calibration.ts shouldAbstain()   -> abstention floor 0.55 + entropy budget
  lib/guard/mlAugment.ts:385-401          -> rawPredictedLabel restore, confidence
                                             floor / attack-prob fusion, allowlist

Two deliberate differences, both stated in the output so no reader has to infer them:

  1. SEMANTIC VETO NOT APPLIED. `passesPrecisionGate` also calls `classifySemantic`,
     which is TypeScript. The veto can only turn a flag into SAFE, so every number
     below is an UPPER BOUND on flagging for both axes -- it inflates recall and FPR
     together, identically for all three arms.
  2. ML TIER ONLY. Production ORs the rules tier over this. The rules tier is
     byte-identical across arms (it does not see the model), so excluding it is what
     isolates the model comparison; it is not a production FPR.
"""
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Two evidence sets, one decision layer. `heldout` is the 13,000-row multilingual matrix
# (v17_score_matrix.py); `gate` is the 3,987-row canonical English gate the historical
# 97.52% / 5.56% was measured on (v17_score_gate.py). A promotion has to survive both, so
# they deliberately share every line of decision code below.
SETS = {
    "heldout": ("v17-score-matrix", "v17-operating-points"),
    "gate": ("v17-gate-matrix", "v17-gate-operating-points"),
}
WHICH = sys.argv[1] if len(sys.argv) > 1 else "heldout"
if WHICH not in SETS:
    sys.exit(f"unknown set {WHICH!r} -- choose one of {', '.join(SETS)}")
_stem, _out = SETS[WHICH]
MATRIX = ROOT / "artifacts" / "ml" / f"{_stem}.jsonl"
META = ROOT / "artifacts" / "ml" / f"{_stem}-meta.json"
OUT = ROOT / "artifacts" / "ml" / f"{_out}.json"

# lib/guard/mlAugment.ts:146-156
RELIABLE_INPUT = {
    "PROMPT_INJECTION",
    "JAILBREAK",
    "SYSTEM_PROMPT_LEAK_ATTEMPT",
    "PII",
    "SECRET",
    "RAG_POISONING",
    "ENCODING_OBFUSCATION",
    "MODEL_EXTRACTION",
    "TOOL_CALL_ABUSE",
}
# .env: ML_ONNX_CONFIDENCE_FLOOR=0.5, SOTERAI_ML_ABSTAIN_ENTROPY=0.40
CONF_FLOOR = 0.5
ATTACK_PROB_FLOOR = 0.85  # ML_ONNX_ATTACK_PROB_FLOOR default
PROD_ENTROPY = 0.40
ABSTAIN_FLOOR = 0.55  # ood.suggested_abstain_max_prob, identical in all three artifacts
LN2 = math.log(2.0)


def binent(p):
    p = min(max(p, 0.0), 1.0)
    if p <= 1e-12 or p >= 1 - 1e-12:
        return 0.0
    return -(p * math.log(p) + (1 - p) * math.log(1 - p))


def entropy(probs):
    return -sum(p * math.log(p) for p in probs if p > 1e-12)


def q4(x):
    """Reproduce `Number(x.toFixed(4))` at the backend -> mlAugment boundary.

    onnxBackend.ts:669-676 rounds BOTH values mlAugment then compares against a floor:
    `confidence` (line 629) and `raw.attackProbability` (line 673). Abstention is decided
    earlier, inside decide(), on the UNROUNDED probability vector -- so rounding is applied
    here in exactly one place, not globally. It only ever matters within 5e-5 of a floor,
    but a comparison that disagrees with production at the boundary is the kind of thing
    that turns up later as an unreproducible row.
    """
    return math.floor(x * 10000 + 0.5) / 10000


def mcnemar(b, c):
    n = b + c
    if n == 0:
        return 1.0
    k = min(b, c)
    cur, tail = 1.0, 0.0
    h = 0.5**n
    for i in range(n + 1):
        if i <= k or i >= n - k:
            tail += cur * h
        cur = cur * (n - i) / (i + 1)
    return min(1.0, tail)


class Arm:
    def __init__(self, name, d, label_order, safe_index):
        self.name = name
        self.labels = label_order
        self.safe = safe_index
        c = json.loads((ROOT / d / "calibration.json").read_text(encoding="utf-8"))
        self.thr = c.get("per_label_thresholds", {})
        self.ood = c.get("ood", {})


def flagged(arm, probs, truncated, *, mode, entropy_budget=None, allowlist=None):
    """One row's ML-tier verdict. `mode` selects which decision layer is applied.

    mode="shipped": the v14_vs_v17_10k_honest.py layer -- per-arm entropy budget from
      calibration, per-label thresholds terminal, no restore, no floors, no allowlist.
    mode="prod": the real INPUT path, minus the semantic veto (see module docstring).
    """
    pred = max(range(len(probs)), key=lambda i: probs[i])
    pname = arm.labels[pred]
    conf = probs[pred]
    p_attack = 1.0 - probs[arm.safe]

    if pname == "SAFE":
        return False, "SAFE_ARGMAX", pname

    if mode == "shipped":
        budget = arm.ood.get("binary_entropy_p95", arm.ood.get("entropy_p95"))
        floor = arm.ood.get("suggested_abstain_max_prob", 0.35)
    else:
        budget = PROD_ENTROPY if entropy_budget is None else entropy_budget
        floor = ABSTAIN_FLOOR

    abstained = False
    if max(p_attack, 1 - p_attack) < floor:
        abstained = True
    elif budget is not None and binent(p_attack) > budget:
        abstained = True
    elif truncated and arm.ood.get("entropy_p95") is not None and entropy(probs) > arm.ood["entropy_p95"]:
        abstained = True
    if abstained:
        return False, "ABSTAINED", pname

    t = arm.thr.get(pname)
    clears = conf >= t if t is not None else conf >= CONF_FLOOR

    if mode == "shipped":
        return (clears, "OK" if clears else "BELOW_THRESHOLD", pname)

    # Production: a threshold demotion is restored from rawPredictedLabel
    # (mlAugment.ts:385-390), so the per-label thresholds are inert on INPUT.
    #
    # NOTE ON THE SAFE ARGMAX: mlAugment's effectiveLabel is the raw argmax, so a SAFE
    # argmax stays SAFE and `isAttack` (line 398) rejects it no matter how much attack
    # mass it carries. onnxBackend.ts:594-596 claims attack-probability fusion recovers
    # those rows; it cannot, because fusion only relaxes `confident`, never the label.
    # The early return above matches shipped behaviour. main() measures what that costs.
    effective = pname
    confident = q4(conf) >= CONF_FLOOR or q4(p_attack) >= ATTACK_PROB_FLOOR
    if not confident:
        return False, "BELOW_CONF_FLOOR", effective
    allow = RELIABLE_INPUT if allowlist is None else allowlist
    if effective not in allow:
        return False, "NOT_IN_ALLOWLIST", effective
    return True, "FLAGGED", effective


def score(rows, arm, **kw):
    tp = fn = fp = tn = 0
    per, lang, src, gates = {}, {}, {}, {}
    vec_atk, vec_ben = [], []
    for r in rows:
        a = r["arms"][arm.name]
        hit, gate, pname = flagged(arm, a["p"], a["t"] == 1, **kw)
        is_atk = r["label"] != "SAFE"
        if is_atk:
            tp, fn = tp + hit, fn + (not hit)
            vec_atk.append(hit)
            d = per.setdefault(r["label"], [0, 0])
            d[0] += hit
            d[1] += 1
        else:
            fp, tn = fp + hit, tn + (not hit)
            vec_ben.append(not hit)
            if hit:
                gates.setdefault(pname, 0)
                gates[pname] += 1
                src.setdefault(r["src"], 0)
                src[r["src"]] += 1
                lang.setdefault(r["lang"], 0)
                lang[r["lang"]] += 1
    return {
        "recall": tp / (tp + fn),
        "fpr": fp / (fp + tn),
        "tp": tp,
        "fn": fn,
        "fp": fp,
        "tn": tn,
        "perLabel": {k: {"n": v[1], "recall": v[0] / v[1]} for k, v in sorted(per.items())},
        "fpByLabel": dict(sorted(gates.items(), key=lambda kv: -kv[1])),
        "fpBySource": dict(sorted(src.items(), key=lambda kv: -kv[1])),
        "fpByLang": dict(sorted(lang.items(), key=lambda kv: -kv[1])),
        "_atk": vec_atk,
        "_ben": vec_ben,
    }


def precompute(rows, arm):
    """Per-row invariants, computed once so a 277-point sweep is not 277 rescans.

    Everything here is independent of the operating point: argmax, its confidence,
    attack mass, and the two entropies. `score_fast` then varies only the budget, the
    allowlist and the floors. A self-check in main() asserts this path agrees with the
    reference `flagged()` on every row before any sweep result is reported.
    """
    cache = []
    for r in rows:
        a = r["arms"][arm.name]
        probs = a["p"]
        pred = max(range(len(probs)), key=lambda i: probs[i])
        p_attack = 1.0 - probs[arm.safe]
        cache.append(
            (
                arm.labels[pred],  # predicted label
                q4(probs[pred]),  # confidence as mlAugment sees it (4dp at the boundary)
                q4(p_attack),  # attack mass as mlAugment sees it
                p_attack,  # unrounded: abstention runs inside decide(), before rounding
                binent(p_attack),
                entropy(probs),
                a["t"] == 1,
                r["label"] != "SAFE",
            )
        )
    return cache


def score_fast(rows, arm, cache, *, entropy_budget=None, allowlist=None):
    """Production-path verdict over a precomputed cache. Mirrors flagged(mode='prod')."""
    budget = PROD_ENTROPY if entropy_budget is None else entropy_budget
    allow = RELIABLE_INPUT if allowlist is None else allowlist
    label_entropy_cap = arm.ood.get("entropy_p95")
    tp = fn = fp = tn = 0
    atk, ben = [], []
    for pname, c4, a4, p_attack, be, ent, trunc, is_atk in cache:
        hit = False
        if pname != "SAFE":
            abstained = (
                max(p_attack, 1 - p_attack) < ABSTAIN_FLOOR
                or be > budget
                or (trunc and label_entropy_cap is not None and ent > label_entropy_cap)
            )
            if not abstained:
                hit = (c4 >= CONF_FLOOR or a4 >= ATTACK_PROB_FLOOR) and pname in allow
        if is_atk:
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


def safe_argmax_probe(rows, arm, base, floors=(0.55, 0.65, 0.75, 0.85)):
    """Price the rows shipped code can never flag: SAFE argmax carrying attack mass.

    mlAugment's effectiveLabel is the raw argmax, so `isAttack` rejects every SAFE-argmax
    row outright -- attack-probability fusion only relaxes `confident`, never the label.
    onnxBackend.ts:594-596 asserts the opposite ("the caller's attack-probability fusion
    is what recovers those"), which makes this a comment that has drifted from the code.

    The candidate rule measured here: when argmax is SAFE but 1-P(SAFE) clears a floor,
    promote the top NON-SAFE label and put it through the same allowlist. Reported as a
    delta against the arm's own production point, since it is an addition to that path.
    """
    out = {}
    for f in floors:
        add_tp = add_fp = 0
        labs = {}
        for i, r in enumerate(rows):
            probs = r["arms"][arm.name]["p"]
            pred = max(range(len(probs)), key=lambda j: probs[j])
            if arm.labels[pred] != "SAFE":
                continue  # already decided by the normal path
            if q4(1.0 - probs[arm.safe]) < f:
                continue
            alt = max((j for j in range(len(probs)) if j != arm.safe), key=lambda j: probs[j])
            name = arm.labels[alt]
            if name not in RELIABLE_INPUT:
                continue  # the precision gate still applies to the promoted label
            if r["label"] != "SAFE":
                add_tp += 1
                labs[name] = labs.get(name, 0) + 1
            else:
                add_fp += 1
        out[f"{f:.2f}"] = {
            "extraTp": add_tp,
            "extraFp": add_fp,
            "recall": (base["tp"] + add_tp) / (base["tp"] + base["fn"]),
            "fpr": (base["fp"] + add_fp) / (base["fp"] + base["tn"]),
            "dRecallPts": add_tp / (base["tp"] + base["fn"]) * 100,
            "dFprPts": add_fp / (base["fp"] + base["tn"]) * 100,
            "promotedLabels": dict(sorted(labs.items(), key=lambda kv: -kv[1])),
        }
    return out


def pair(a, b):
    """McNemar on both axes. 'onlyA' is where A is CORRECT and B is not."""
    out = {}
    for kind in ("_atk", "_ben"):
        oa = sum(1 for x, y in zip(a[kind], b[kind]) if x and not y)
        ob = sum(1 for x, y in zip(a[kind], b[kind]) if y and not x)
        out[kind.strip("_")] = {
            "onlyA": oa,
            "onlyB": ob,
            "p": mcnemar(oa, ob),
            "verdict": "no-sig-diff" if mcnemar(oa, ob) >= 0.05 else ("B-better" if ob > oa else "A-better"),
        }
    return out


def strip(d):
    return {k: v for k, v in d.items() if not k.startswith("_")}


def main():
    if not MATRIX.exists():
        script = "v17_score_gate.py" if WHICH == "gate" else "v17_score_matrix.py"
        sys.exit(f"missing {MATRIX} -- run scripts/ml/{script} first")
    meta = json.loads(META.read_text(encoding="utf-8"))
    rows = [json.loads(l) for l in MATRIX.read_text(encoding="utf-8").split("\n") if l.strip()]
    arms = [
        Arm(name, m["dir"], m["labelOrder"], m["safeIndex"]) for name, m in meta["arms"].items()
    ]
    names = [a.name for a in arms]
    n_atk = sum(1 for r in rows if r["label"] != "SAFE")
    print(f"[{WHICH}] {len(rows)} rows ({n_atk} atk / {len(rows)-n_atk} ben) | "
          f"selection sha256 {meta['selectionSha256'][:16]}…\n")

    report = {
        "set": WHICH,
        "meta": {k: meta[k] for k in ("seed", "selectionSha256", "attackRows", "benignRows",
                                      "files", "gateFile", "trainGroupOverlap") if k in meta},
    }

    # ── Control: reproduce the published 10k run from the matrix ──────────────
    # Only meaningful for the held-out set: `v14-vs-v17-10k-honest.json` is that exact
    # selection. The gate has no prior probability-level artifact to reproduce.
    if WHICH == "heldout":
        print("== CONTROL: shipped-calibration layer (must reproduce v14-vs-v17-10k-honest.json) ==")
        published = json.loads((ROOT / "artifacts/ml/v14-vs-v17-10k-honest.json").read_text(encoding="utf-8"))
        ctrl, ok = {}, True
        for a in arms:
            s = score(rows, a, mode="shipped")
            ctrl[a.name] = s
            p = published["arms"][a.name]
            match = s["tp"] == p["tp"] and s["fp"] == p["fp"]
            ok &= match
            print(
                f"  {a.name:26} recall {s['recall']*100:6.2f}%  fpr {s['fpr']*100:6.2f}%   "
                f"published {p['recall']*100:6.2f}% / {p['fpr']*100:6.2f}%   {'MATCH' if match else 'DRIFT'}"
            )
        report["control"] = {"reproducesPublished": bool(ok), "arms": {k: strip(v) for k, v in ctrl.items()}}
        if not ok:
            print("  !! selection or decision layer drifted -- downstream numbers are not comparable\n")
    else:
        print("== CONTROL: shipped-calibration layer, for reference (no published artifact to match) ==")
        ctrl = {}
        for a in arms:
            s = score(rows, a, mode="shipped")
            ctrl[a.name] = s
            print(f"  {a.name:26} recall {s['recall']*100:6.2f}%  fpr {s['fpr']*100:6.2f}%")
        report["control"] = {"reproducesPublished": None, "arms": {k: strip(v) for k, v in ctrl.items()}}

    # ── Production operating point ────────────────────────────────────────────
    print("\n== PRODUCTION INPUT path (entropy 0.40 for every arm, allowlist, pre-veto) ==")
    prod, caches = {}, {}
    for a in arms:
        s = score(rows, a, mode="prod")
        prod[a.name] = s
        caches[a.name] = precompute(rows, a)
        # The sweep below runs on the fast path. It is only allowed to speak if it
        # reproduces the reference port exactly -- same tp, same fp, same per-row vector.
        f = score_fast(rows, a, caches[a.name])
        if (f["tp"], f["fp"]) != (s["tp"], s["fp"]) or f["_atk"] != s["_atk"] or f["_ben"] != s["_ben"]:
            sys.exit(
                f"fast path disagrees with the reference decision on {a.name} "
                f"(ref tp/fp {s['tp']}/{s['fp']}, fast {f['tp']}/{f['fp']}) -- refusing to sweep"
            )
        print(f"  {a.name:26} recall {s['recall']*100:6.2f}%  fpr {s['fpr']*100:6.2f}%  (tp {s['tp']} fp {s['fp']})")
    print("  [self-check] fast path reproduces the reference decision on all arms, per row")
    report["production"] = {k: strip(v) for k, v in prod.items()}

    print("\n  McNemar at the production operating point:")
    mc = {}
    base = names[0]
    for other in names[1:]:
        r = pair(prod[base], prod[other])
        mc[f"{base} vs {other}"] = r
        for kind in ("atk", "ben"):
            v = r[kind]
            print(
                f"    {other:26} {kind}: only-{base}={v['onlyA']:5} only-other={v['onlyB']:5} "
                f"p={v['p']:.3e} => {v['verdict']}"
            )
    report["mcnemarProduction"] = mc

    # ── Operating curve: the one production knob, swept ───────────────────────
    print("\n== OPERATING CURVE (SOTERAI_ML_ABSTAIN_ENTROPY swept; 0.6932 disables abstention) ==")
    budgets = [0.02, 0.05, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.6932]
    curve = {}
    print(f"  {'budget':>8} | " + " | ".join(f"{n[:18]:>18}" for n in names))
    for b in budgets:
        cells, row = [], {}
        for a in arms:
            s = score_fast(rows, a, caches[a.name], entropy_budget=b)
            row[a.name] = {"recall": s["recall"], "fpr": s["fpr"], "tp": s["tp"], "fp": s["fp"]}
            cells.append(f"{s['recall']*100:6.2f}% /{s['fpr']*100:6.2f}%")
        curve[f"{b:.4f}"] = row
        print(f"  {b:8.4f} | " + " | ".join(f"{c:>18}" for c in cells))
    report["operatingCurve"] = curve

    # ── Matched-FPR read: recall at v14's production FPR ──────────────────────
    target = prod[base]["fpr"]
    print(f"\n== MATCHED FPR: each arm at {base}'s production FPR ({target*100:.2f}%) ==")
    matched = {}
    for a in arms:
        best = None
        for b in [x / 400 for x in range(1, 278)]:  # 0.0025 .. 0.6925
            s = score_fast(rows, a, caches[a.name], entropy_budget=b)
            if best is None or abs(s["fpr"] - target) < abs(best[1]["fpr"] - target):
                best = (b, s)
        matched[a.name] = {"budget": best[0], "recall": best[1]["recall"], "fpr": best[1]["fpr"]}
        print(
            f"  {a.name:26} budget {best[0]:.4f} -> recall {best[1]['recall']*100:6.2f}%  "
            f"fpr {best[1]['fpr']*100:6.2f}%"
        )
    report["matchedFpr"] = {"targetFpr": target, "arms": matched}

    # ── Phase 0.2: price MULTI_TURN_ESCALATION admission ──────────────────────
    print("\n== MTE ADMISSION (adds MULTI_TURN_ESCALATION to the INPUT allowlist) ==")
    mte = {}
    allow = RELIABLE_INPUT | {"MULTI_TURN_ESCALATION"}
    for a in arms:
        s = score(rows, a, mode="prod", allowlist=allow)
        b = prod[a.name]
        mte[a.name] = {
            "recall": s["recall"],
            "fpr": s["fpr"],
            "dRecallPts": (s["recall"] - b["recall"]) * 100,
            "dFprPts": (s["fpr"] - b["fpr"]) * 100,
            "extraFp": s["fp"] - b["fp"],
            "extraTp": s["tp"] - b["tp"],
        }
        print(
            f"  {a.name:26} recall {b['recall']*100:6.2f}% -> {s['recall']*100:6.2f}% "
            f"({mte[a.name]['dRecallPts']:+.2f} pts, +{mte[a.name]['extraTp']} attacks)   "
            f"fpr {b['fpr']*100:6.2f}% -> {s['fpr']*100:6.2f}% ({mte[a.name]['dFprPts']:+.2f} pts, "
            f"+{mte[a.name]['extraFp']} FP)"
        )
    report["mteAdmission"] = mte

    # ── A lever the shipped code forecloses: SAFE argmax with attack mass ─────
    print("\n== SAFE-ARGMAX PROMOTION (rows no floor can currently rescue; see source note) ==")
    sap = {}
    for a in arms:
        sap[a.name] = safe_argmax_probe(rows, a, prod[a.name])
        cells = " | ".join(
            f"{f}: {v['dRecallPts']:+.2f}/{v['dFprPts']:+.2f} pts (+{v['extraTp']}tp/+{v['extraFp']}fp)"
            for f, v in sap[a.name].items()
        )
        print(f"  {a.name:26} {cells}")
    report["safeArgmaxPromotion"] = sap

    # ── Where the false positives live, at the production point ───────────────
    print("\n== FALSE POSITIVES at the production point, by source file ==")
    for a in arms:
        print(f"  {a.name}: " + ", ".join(f"{k.split('/')[-1]}={v}" for k, v in prod[a.name]["fpBySource"].items()))
    print("\n== FALSE POSITIVES by hallucinated label ==")
    for a in arms:
        print(f"  {a.name}: " + ", ".join(f"{k}={v}" for k, v in prod[a.name]["fpByLabel"].items()))

    print("\n== PER-LABEL RECALL at the production point ==")
    labs = sorted(prod[base]["perLabel"])
    print(f"  {'label':28} " + " ".join(f"{n[:16]:>16}" for n in names))
    for l in labs:
        cells = []
        for n in names:
            d = prod[n]["perLabel"].get(l)
            cells.append(f"{d['recall']*100:5.1f}%({d['n']:4})" if d else "-")
        print(f"  {l:28} " + " ".join(f"{c:>16}" for c in cells))

    OUT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nWrote {OUT}")


if __name__ == "__main__":
    main()
