#!/usr/bin/env python3
"""
Is "ProtectAI beats SoterAI at 1% FPR" a model gap, or a battery artefact?

WHY THIS CHECK EXISTS
    ac2-competitor-benchmark.py found ProtectAI ahead at FPR 1%: in-scope recall
    54.49% vs 40.44% (58.50% vs 42.58% on the common untruncated subset). That
    reverses the AC6 recommendation, so it has to survive the most likely way it
    could be wrong.

    FPR 1% on 2000 benign rows is a threshold set by the TOP ~20 BENIGN SCORES. The
    benign set is not 2000 independent samples: measure-benign-scenario-clustering
    found the same benign request translated into 28 languages, all flagged. If one
    such family sits in SoterAI's benign tail, it alone exhausts the 20-FP budget
    and drags the threshold up. That would be a property of how the battery was
    built, not of the model -- and it would hit SoterAI (multilingual) far harder
    than ProtectAI (English-only), which may simply score foreign text as benign.

WHAT IT REPORTS
    1. The cluster structure itself, BEFORE anything relies on it. A grouping key
       nobody inspected is how a correction becomes a fudge.
    2. The top-20 benign rows per model, with each row's family size. This is the
       direct answer: is the budget eaten by one family?
    3. Ties at the top of the score range (saturated softmax makes "the threshold
       at 1%" ill-defined if many rows share the maximum).
    4. Three low-FPR metrics, because a single operating point on ~20 rows is noisy:
         recall@FPR<=1%            the number in the report
         pAUC to FPR 1% and 5%     mean recall over the low-FPR band
         recall@weighted-FPR<=1%   each benign FAMILY weighs 1, not each row
    5. A cluster-paired bootstrap CI on the difference. Families are resampled
       whole, so the interval reflects how many independent scenarios exist rather
       than how many translated copies were made of them.

    The verdict is computed, and can come out either way.

    python scripts/ml/ac2-low-fpr-robustness.py
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
BATTERY = ROOT / "artifacts/ml/v18-balanced-comparison-rows.jsonl"
SOTER = ROOT / "artifacts/ml/soterai-per-row-scores-2026-10-02.json"
PROTECTAI = ROOT / "artifacts/ml/arm-scores-protectai.json"
OUT = ROOT / "artifacts/ml/ac2-low-fpr-robustness-2026-10-15.json"

IN_SCOPE = {"PROMPT_INJECTION", "JAILBREAK", "SYSTEM_PROMPT_LEAK_ATTEMPT"}
B = 2000
RNG = np.random.default_rng(20261015)

# Same literal anchors as scripts/ml/measure-benign-scenario-clustering.ts. re.ASCII
# keeps \b and \d ASCII-only, matching JavaScript; without it Python would treat
# Devanagari digits as \d and split families the TS script merged.
ANCHORS = [
    re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", re.ASCII),
    re.compile(r"https?://[^\s\"'<>]{4,}", re.ASCII),
    re.compile(r"\b[A-Z][A-Z0-9_]{3,}\b", re.ASCII),
    re.compile(r"\b(?:sk|pk|ck|api)[-_][A-Za-z0-9]{4,}", re.ASCII | re.IGNORECASE),
    re.compile(r"\b\d{4,}\b", re.ASCII),
]


def literal_signature(text: str) -> str | None:
    found = sorted({m.lower() for rx in ANCHORS for m in rx.findall(text)})
    return "|".join(found) if found else None


def recall_at_fpr(att: np.ndarray, ben: np.ndarray, fpr: float) -> float:
    """Recall with #benign strictly above the threshold <= floor(fpr * n_benign)."""
    k = int(np.floor(fpr * len(ben)))
    thr = np.sort(ben)[::-1][k] if k < len(ben) else -np.inf
    return float(np.mean(att > thr))


def weighted_recall_at_fpr(att, ben, w_ben, fpr):
    """Same, but the FP budget is counted in family-weight, not rows."""
    order = np.argsort(-ben)
    b_sorted, w_sorted = ben[order], w_ben[order]
    budget = fpr * w_ben.sum()
    cum = np.cumsum(w_sorted)
    # largest prefix of the benign tail whose total weight fits the budget
    j = int(np.searchsorted(cum, budget, side="right"))
    thr = b_sorted[j] if j < len(b_sorted) else -np.inf
    return float(np.mean(att > thr))


def roc_points(att: np.ndarray, ben: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """ROC by sorted cumulative counts -- O(n log n), same construction as sklearn."""
    scores = np.concatenate([att, ben])
    y = np.concatenate([np.ones(len(att)), np.zeros(len(ben))])
    order = np.argsort(-scores, kind="mergesort")
    s, y = scores[order], y[order]
    last_of_tie = np.r_[np.where(np.diff(s))[0], len(s) - 1]
    tps = np.cumsum(y)[last_of_tie]
    fps = (last_of_tie + 1) - tps
    return np.r_[0.0, fps / len(ben)], np.r_[0.0, tps / len(att)]


def pauc(att: np.ndarray, ben: np.ndarray, max_fpr: float) -> float:
    """Mean recall over FPR in [0, max_fpr], normalised to [0, 1].

    The band edge is closed by linear interpolation between the two ROC points that
    straddle max_fpr, which is what sklearn's roc_auc_score(max_fpr=...) does before
    its McClish correction. The first version of this function evaluated every
    threshold against every row -- correct, but O(thresholds x rows), which made the
    4,000-call bootstrap take hours.
    """
    fpr, tpr = roc_points(att, ben)
    stop = int(np.searchsorted(fpr, max_fpr, side="right"))
    if stop >= len(fpr):
        f, t = fpr, tpr
    else:
        edge = float(np.interp(max_fpr, fpr[stop - 1:stop + 1], tpr[stop - 1:stop + 1]))
        f, t = np.append(fpr[:stop], max_fpr), np.append(tpr[:stop], edge)
    return float(np.trapezoid(t, f) / max_fpr)


def main() -> int:
    # The battery is multilingual and the Windows console defaults to cp1252, which
    # crashed the first run mid-table on a Devanagari row.
    import sys
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    rows = [json.loads(l) for l in BATTERY.read_text(encoding="utf-8").splitlines() if l.strip()]
    soter = json.loads(SOTER.read_text(encoding="utf-8"))["perRow"]
    pa = json.loads(PROTECTAI.read_text(encoding="utf-8"))
    n = len(rows)
    assert len(soter) == n and len(pa["scores"]) == n, "score files do not match the battery"
    if any("soterScoreExact" not in p for p in soter):
        raise SystemExit("[FATAL] SoterAI export has no exact scores; its 4-decimal rounding is the "
                         "artefact under test. Re-export first. Refusing.")

    s_soter = np.array([float(p["soterScoreExact"]) for p in soter])
    s_soter_rounded = np.array([float(p["soterScore"]) for p in soter])
    s_pa = np.array([float(x) for x in pa["scores"]])
    trunc = np.array([bool(t) for t in pa["truncated"]])
    label = np.array([r["label"] for r in rows])
    lang = np.array([r["language"] for r in rows])
    is_ben = label == "SAFE"
    is_att = np.isin(label, list(IN_SCOPE))

    # ---- 0. the instrument agrees with independent implementations ------------
    # pauc() is checked against sklearn, recall_at_fpr() against the numbers the
    # benchmark artifact reports -- read from the artifact, never hardcoded, so this
    # check cannot pass against stale values after the inputs change. A metric that
    # silently disagrees with the report it is meant to stress-test would make every
    # conclusion below about the metric, not the models.
    from sklearn.metrics import roc_auc_score
    bench = json.loads((ROOT / "artifacts/ml/ac2-competitor-benchmark-2026-10-02.json").read_text(encoding="utf-8"))
    ref = {a["name"]: a["inScope"]["recallAt1PctFpr"] / 100 for a in bench["arms"] if a.get("inScope")}
    checks = (("SoterAI", s_soter, ref["SoterAI v17-multilingual (ML score)"]),
              ("ProtectAI", s_pa, ref["ProtectAI deberta-v3-base-prompt-injection-v2"]))
    for name, s, reported in checks:
        a, b = s[is_att], s[is_ben]
        for mf in (0.01, 0.05):
            y = np.r_[np.ones(len(a)), np.zeros(len(b))]
            mcclish = roc_auc_score(y, np.r_[a, b], max_fpr=mf)
            lo_area, hi_area = 0.5 * mf * mf, mf
            raw = lo_area + (2 * mcclish - 1) * (hi_area - lo_area)
            mine = pauc(a, b, mf) * mf
            if abs(raw - mine) > 1e-6:
                raise SystemExit(f"[FATAL] pauc disagrees with sklearn for {name} at {mf}: "
                                 f"{mine:.8f} vs {raw:.8f}. Refusing.")
        got = recall_at_fpr(a, b, 0.01)
        if abs(got - reported) > 5e-4:
            raise SystemExit(f"[FATAL] recall@1% for {name} = {got:.4f}, report says {reported}. "
                             "This script is not measuring the number it is meant to test. Refusing.")
    print("\n0) instrument check: pauc == sklearn (raw), recall@1% == report  ->  OK")

    # ---- 0b. what the 4-decimal rounding alone cost SoterAI --------------------
    # Same model, same rows; the only difference is onnxBackend.ts:673's toFixed(4).
    # Whatever moves here is the instrument, not the model.
    qa, qb = s_soter_rounded[is_att], s_soter_rounded[is_ben]
    ea, eb = s_soter[is_att], s_soter[is_ben]
    def ties_at_threshold(b: np.ndarray) -> int:
        kth = np.sort(b)[::-1][int(np.floor(0.01 * len(b)))]
        return int(np.sum(b == kth))
    quant = {
        "distinctScores": {"rounded": int(len(np.unique(s_soter_rounded))), "exact": int(len(np.unique(s_soter)))},
        "benignTiedAtThreshold": {"rounded": ties_at_threshold(qb), "exact": ties_at_threshold(eb)},
        "recallAtFpr1": {"rounded": round(recall_at_fpr(qa, qb, 0.01), 4), "exact": round(recall_at_fpr(ea, eb, 0.01), 4)},
        "pauc5": {"rounded": round(pauc(qa, qb, 0.05), 4), "exact": round(pauc(ea, eb, 0.05), 4)},
    }
    print("\n0b) QUANTISATION COST TO SoterAI  (identical model and rows; only toFixed(4) differs)")
    for k, v in quant.items():
        print(f"    {k:22s} rounded {v['rounded']:>8}   exact {v['exact']:>8}")

    # ---- 1. family key, and an honest look at it -------------------------------
    # Two groupings, because they answer different questions and over-merging is
    # exactly how a correction becomes a fudge:
    #
    #   TRANSLATION families (primary) — a group counts only if it spans >= 3
    #     languages. This is the hypothesis under test: translated copies of one
    #     scenario inflating the benign tail.
    #   ALL families (sensitivity) — also merges same-language literal groups, e.g.
    #     46 distinct English SEO prompts sharing [PROMPT]/[TARGETLANGUAGE]. Those
    #     are template siblings, not translations; treating them as one scenario is
    #     a much larger correction than the hypothesis justifies.
    #
    # The verdict is taken on the TRANSLATION grouping; ALL is reported so a reader
    # can see whether the conclusion depends on the more aggressive choice.
    raw_key = []
    for i, r in enumerate(rows):
        c = r.get("category")
        sig = literal_signature(r["text"])
        raw_key.append(f"cat:{c}" if c else (f"lit:{sig}" if sig else f"row:{i}"))
    raw_key = np.array(raw_key)

    key_langs: dict[str, set] = defaultdict(set)
    for k, l in zip(raw_key, lang):
        key_langs[k].add(l)
    fam_all = raw_key
    fam_tr = np.array([k if len(key_langs[k]) >= 3 else f"row:{i}" for i, k in enumerate(raw_key)])

    def describe(fam: np.ndarray, title: str) -> Counter:
        sizes = Counter(fam[is_ben])
        multi = {f: c for f, c in sizes.items() if c > 1}
        print(f"   {title}: {len(sizes)} families; {len(multi)} multi-row covering {sum(multi.values())} rows")
        for f, c in sorted(multi.items(), key=lambda x: -x[1])[:5]:
            nl = len(set(lang[(fam == f) & is_ben]))
            print(f"      {c:3d} rows / {nl:2d} langs  {f[:66]}")
        return sizes

    print("\n1) BENIGN FAMILY STRUCTURE")
    sizes_tr = describe(fam_tr, "TRANSLATION families (primary)")
    sizes_all = describe(fam_all, "ALL families (sensitivity)")

    # Weight is only meaningful for benign rows; an attack row's family may have no
    # benign members at all, so it gets 0 rather than a division by zero.
    w_tr = np.array([1.0 / sizes_tr[f] if is_ben[i] else 0.0 for i, f in enumerate(fam_tr)])
    w_all = np.array([1.0 / sizes_all[f] if is_ben[i] else 0.0 for i, f in enumerate(fam_all)])
    fam, ben_fam_sizes = fam_tr, sizes_tr  # the tail table and bootstrap use the primary

    # ---- 2+3. who owns each model's benign tail --------------------------------
    report: dict = {"generatedAt": __import__("datetime").datetime.now(
        __import__("datetime").timezone.utc).isoformat(), "arms": {}}
    report["quantisationCostToSoterAI"] = quant
    print("\n2) TOP-20 BENIGN SCORES PER MODEL  (the rows that set the 1% threshold)")
    for name, s in (("SoterAI", s_soter), ("ProtectAI", s_pa)):
        idx = np.where(is_ben)[0]
        top = idx[np.argsort(-s[idx])][:20]
        fams_in_top = Counter(fam[top])
        biggest = fams_in_top.most_common(1)[0]
        n_multi = sum(1 for i in top if ben_fam_sizes[fam[i]] > 1)
        non_en = sum(1 for i in top if lang[i] != "en")
        ties = int(np.sum(s[idx] >= s[top[-1]]))
        print(f"\n   {name}: 20th-highest benign score {s[top[-1]]:.6f}; "
              f"{ties} benign rows tie at or above it")
        print(f"      rows from multi-row families: {n_multi}/20 | non-English: {non_en}/20 | "
              f"largest single family in the top 20: {biggest[1]} rows")
        for i in top[:8]:
            print(f"      {s[i]:.6f} [{lang[i]:>8s}] fam={ben_fam_sizes[fam[i]]:2d}  "
                  f"{rows[i]['text'][:78].replace(chr(10), ' ')}")
        report["arms"][name] = {
            "top20_multiFamilyRows": n_multi,
            "top20_nonEnglish": non_en,
            "top20_largestFamily": int(biggest[1]),
            "benignRowsAtOrAbove20th": ties,
        }

    # ---- 4. metrics, on two scopes ---------------------------------------------
    def metrics(mask: np.ndarray) -> dict:
        att_m, ben_m = is_att & mask, is_ben & mask
        out = {}
        for name, s in (("SoterAI", s_soter), ("ProtectAI", s_pa)):
            a, b = s[att_m], s[ben_m]
            out[name] = {
                "recallAtFpr1": round(recall_at_fpr(a, b, 0.01), 4),
                "pauc1": round(pauc(a, b, 0.01), 4),
                "pauc5": round(pauc(a, b, 0.05), 4),
                "wRecallAtFpr1_translation": round(weighted_recall_at_fpr(a, b, w_tr[ben_m], 0.01), 4),
                "wRecallAtFpr1_all": round(weighted_recall_at_fpr(a, b, w_all[ben_m], 0.01), 4),
            }
        out["n"] = {"attacks": int(att_m.sum()), "benign": int(ben_m.sum())}
        return out

    scopes = {"inScope": np.ones(n, bool), "inScopeUntruncated": ~trunc}
    print("\n4) LOW-FPR METRICS   (w-rec = FP budget counted per FAMILY, not per row)")
    for sname, mask in scopes.items():
        m = metrics(mask)
        report[sname] = m
        print(f"\n   {sname}  ({m['n']['attacks']} attacks / {m['n']['benign']} benign)")
        print(f"   {'':10s} {'rec@1%':>8s} {'pAUC1%':>8s} {'pAUC5%':>8s} {'w-rec(tr)':>10s} {'w-rec(all)':>11s}")
        for name in ("SoterAI", "ProtectAI"):
            x = m[name]
            print(f"   {name:10s} {x['recallAtFpr1']:8.4f} {x['pauc1']:8.4f} {x['pauc5']:8.4f} "
                  f"{x['wRecallAtFpr1_translation']:10.4f} {x['wRecallAtFpr1_all']:11.4f}")

    # ---- 5. cluster-paired bootstrap on the difference -------------------------
    # Benign rows resampled BY FAMILY; attacks by row. Both models see the same
    # resample, so the interval is on the paired difference. Run under both
    # groupings: the coarser one has fewer independent units, so its interval is
    # the conservative one.
    ben_idx = np.where(is_ben)[0]
    att_idx = np.where(is_att)[0]
    ci = lambda x: (round(float(np.percentile(x, 2.5)), 4), round(float(np.percentile(x, 97.5)), 4))
    report["bootstrap"] = {"B": B, "resampling": "benign by family, attacks by row, paired"}
    print(f"\n5) CLUSTER-PAIRED BOOTSTRAP  (B={B}; benign resampled by family)")
    for gname, fam_g in (("translation", fam_tr), ("all", fam_all)):
        groups = defaultdict(list)
        for i in ben_idx:
            groups[fam_g[i]].append(i)
        group_list = [np.array(v) for v in groups.values()]
        d_rec, d_pauc5 = [], []
        for _ in range(B):
            pick = RNG.integers(0, len(group_list), len(group_list))
            b_rows = np.concatenate([group_list[g] for g in pick])
            a_rows = att_idx[RNG.integers(0, len(att_idx), len(att_idx))]
            d_rec.append(recall_at_fpr(s_pa[a_rows], s_pa[b_rows], 0.01)
                         - recall_at_fpr(s_soter[a_rows], s_soter[b_rows], 0.01))
            d_pauc5.append(pauc(s_pa[a_rows], s_pa[b_rows], 0.05)
                           - pauc(s_soter[a_rows], s_soter[b_rows], 0.05))
        d_rec, d_pauc5 = np.array(d_rec), np.array(d_pauc5)
        block = {
            "units": len(group_list),
            "deltaRecallAtFpr1": {"mean": round(float(d_rec.mean()), 4), "ci95": ci(d_rec),
                                  "pProtectAIBetter": round(float(np.mean(d_rec > 0)), 4)},
            "deltaPauc5": {"mean": round(float(d_pauc5.mean()), 4), "ci95": ci(d_pauc5),
                           "pProtectAIBetter": round(float(np.mean(d_pauc5 > 0)), 4)},
        }
        report["bootstrap"][gname] = block
        print(f"   grouping={gname:11s} ({block['units']} benign units)")
        for k in ("deltaRecallAtFpr1", "deltaPauc5"):
            v = block[k]
            print(f"      {k:18s} ProtectAI-SoterAI {v['mean']:+.4f}  95% CI {v['ci95']}  "
                  f"P(ProtectAI better) {v['pProtectAIBetter']}")

    # ---- verdict, able to come out either way ----------------------------------
    # Taken on the TRANSLATION grouping (the hypothesis), and required to hold on
    # the conservative ALL-grouping interval too before it is called REAL.
    tr, al = report["bootstrap"]["translation"], report["bootstrap"]["all"]
    lo_tr, hi_tr = tr["deltaRecallAtFpr1"]["ci95"]
    lo_al, _ = al["deltaRecallAtFpr1"]["ci95"]
    w_s = report["inScope"]["SoterAI"]["wRecallAtFpr1_translation"]
    w_p = report["inScope"]["ProtectAI"]["wRecallAtFpr1_translation"]
    if lo_tr > 0 and lo_al > 0 and w_p > w_s:
        verdict = ("REAL: ProtectAI leads at FPR 1%. The cluster-paired CI excludes zero under both "
                   "groupings, and the lead survives counting the FP budget per translation family.")
    elif hi_tr < 0:
        verdict = "REVERSED: SoterAI leads at FPR 1% once translation families are accounted for."
    elif w_p <= w_s:
        verdict = ("ARTEFACT: the lead disappears when each translation family counts once — "
                   "the row-level gap was driven by translated copies in the benign tail.")
    else:
        verdict = "INCONCLUSIVE: a cluster-paired CI includes zero."
    report["verdict"] = verdict
    print(f"\n   VERDICT: {verdict}\n")

    OUT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
