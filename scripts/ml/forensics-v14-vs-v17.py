"""
forensics-v14-vs-v17.py — Phase 1 weakness analysis from cached evidence only.

Sources (no model is loaded, no threshold is fitted here):
  * artifacts/ml/v18-balanced-comparison-rows.jsonl   4,000 leak-audited rows
  * artifacts/ml/v18-balanced-comparison/{v14,v17-minilm,v17-multilingual}-scores.json
  * artifacts/ml/v18-balanced-comparison/report.json  (rows_file_sha256 must match)
  * artifacts/ml/soterai-per-row-scores-2026-10-02.json  per row: rulesFlagged,
    production action, production attack score, language, category

Expected verdicts to reproduce (otherwise this script, not the evidence, is wrong):
  ML-only at shared_input_gate: v14 .8975/.1635, v17-multilingual .8815/.1360,
  v17-minilm .8485/.1425.

Slices are diagnostics, not release evidence: the battery carries 1,762 English
benign rows and ~4 per other language, and some categories have single-digit n.
"""
import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from importlib import import_module

contract = import_module("compare-v18-bases")  # never fork the decision layer
decisions, metrics = contract.decisions, contract.metrics

ROOT = Path(__file__).resolve().parents[2]
ARMS = {"v14": "v14", "v17-minilm": "v17-minilm", "v17-multilingual": "v17-multilingual"}
GATE = "shared_input_gate"
MIN_SLICE = 25  # below this a per-slice rate is reported as n/a


def load_scores(arm):
    p = ROOT / "artifacts/ml/v18-balanced-comparison" / f"{arm}-scores.json"
    j = json.loads(p.read_text(encoding="utf-8"))
    return (
        np.asarray(j["probabilities"], dtype=float),
        j["identity"]["labels"],
        j["content_lengths"],
        j["calibration"],  # cached at scoring time and fingerprinted in identity
    )


def bucket(n):
    return "<=64" if n <= 64 else "65-128" if n <= 128 else "129-254" if n <= 254 else ">254"


def main():
    rows = [json.loads(l) for l in (ROOT / "artifacts/ml/v18-balanced-comparison-rows.jsonl").open(encoding="utf-8") if l.strip()]
    prod = json.loads((ROOT / "artifacts/ml/soterai-per-row-scores-2026-10-02.json").read_text(encoding="utf-8"))
    report = json.loads((ROOT / "artifacts/ml/v18-balanced-comparison/report.json").read_text(encoding="utf-8"))
    if report["rows_file_sha256"] != "a30603c4189dbb9c46ca1853c5179e98283ed6904b7696c2e822fa4c6fc3feb2":
        raise SystemExit("battery changed since the cached scores were produced; re-score first")
    if len(prod["perRow"]) != len(rows):
        raise SystemExit("production score file does not cover the battery")
    truth = np.array([r["label"] != "SAFE" for r in rows])
    lang = [r.get("language") or "??" for r in rows]
    cat = [r.get("label") for r in rows]
    src = [r.get("source") or "?" for r in rows]
    rules = np.array([bool(p["rulesFlagged"]) for p in prod["perRow"]])

    out = {"rows": len(rows), "rows_file_sha256": report["rows_file_sha256"], "arms": {}}
    flags = {}
    for name, arm in ARMS.items():
        probs, labels, lengths, calib = load_scores(arm)
        m = decisions(probs, labels, lengths, calib)
        f = np.asarray(m[GATE], dtype=bool)
        flags[name] = f
        entry = {"overall_ml_only": metrics(truth, f)}
        # Product path: rules OR ML on rows the rules let through. This is the
        # number a user experiences, and the one the ML tier can only make worse.
        prodpath = rules | (~rules & f)
        entry["product_path_rules_or_ml"] = metrics(truth, prodpath)
        entry["slices"] = {
            "language": {}, "category": {}, "length_bucket": {}, "source": {},
        }
        lengths_b = [bucket(int(n)) for n in lengths]
        for key, values in (("language", lang), ("category", cat), ("length_bucket", lengths_b), ("source", src)):
            for v in sorted(set(values)):
                idx = np.array([x == v for x in values])
                t, fl = truth[idx], f[idx]
                if len(t) < MIN_SLICE or t.sum() == 0 or (~t).sum() == 0:
                    continue
                entry["slices"][key][v] = {
                    "n": int(len(t)), "attacks": int(t.sum()),
                    "recall": round(float(fl[t].mean()), 4),
                    "fpr": round(float(fl[~t].mean()), 4),
                }
        out["arms"][name] = entry

    # Paired error structure v14 vs v17-multilingual, the two arms worth keeping.
    a, b = flags["v14"], flags["v17-multilingual"]
    paired = {
        "attacks_only_v14_catches": int((truth & a & ~b).sum()),
        "attacks_only_v17_catches": int((truth & b & ~a).sum()),
        "attacks_both_miss": int((truth & ~a & ~b).sum()),
        "benign_only_v14_flags": int((~truth & a & ~b).sum()),
        "benign_only_v17_flags": int((~truth & b & ~a).sum()),
    }
    out["paired_v14_vs_v17multilingual"] = paired

    # The miss population that a student must actually fix.
    miss = truth & ~a & ~b
    out["both_miss_by_category"] = dict(Counter(cat[i] for i in np.where(miss)[0]).most_common())
    out["both_miss_by_source"] = dict(Counter(src[i] for i in np.where(miss)[0]).most_common(12))
    out["both_miss_by_language"] = dict(Counter(lang[i] for i in np.where(miss)[0]).most_common(20))
    # Rules already catch these; the model is never consulted, so they are not
    # evidence about the model, but they are the product's recall floor.
    out["rules_only_attacks"] = int((truth & rules).sum())
    out["attacks_nobody_catches"] = int((truth & ~rules & ~a & ~b).sum())
    out["samples_both_miss"] = [rows[i]["text"][:180] for i in np.where(miss)[0][:12]]

    dest = ROOT / "artifacts/ml/forensics-v14-v17-2026-10-17.json"
    dest.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")

    for name, e in out["arms"].items():
        o = e["overall_ml_only"]
        print(f"{name:18} ML-only recall {o['recall']:.4f} fpr {o['fpr']:.4f} | product-path recall {e['product_path_rules_or_ml']['recall']:.4f} fpr {e['product_path_rules_or_ml']['fpr']:.4f}")
    print("paired:", paired)
    print("both-miss by category:", out["both_miss_by_category"])
    print("rules-only attacks:", out["rules_only_attacks"], "| attacks nobody catches:", out["attacks_nobody_catches"])
    print("wrote", dest)


if __name__ == "__main__":
    main()
