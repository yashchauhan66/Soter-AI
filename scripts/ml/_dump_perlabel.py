#!/usr/bin/env python3
"""Dump per-label in-distribution metrics for all three arms, side by side."""
import json

for d, name in [("models/ml-classifier-v14", "v14 (minilm, 146,757 rows)"),
                ("models/ml-classifier-v17-minilm", "v17-CONTROL (minilm, 155,883 rows)"),
                ("models/ml-classifier-v17", "v17-CANDIDATE (mdistilbert, 155,883 rows)")]:
    e = json.load(open(f"{d}/eval_results.json", encoding="utf-8"))
    print("===", name, "===")
    print("  accuracy=%.4f  f1_macro=%.4f  attack_recall=%.4f  attack_precision=%.4f  benign_fpr=%.4f  ece=%.5f" % (
        e["accuracy"], e["f1_macro"], e["attack_recall"], e["attack_precision"], e["benign_fpr"], e["ece_calibration"]))
    for k, v in e["per_label"].items():
        print("  %-28s R=%.4f P=%.4f F1=%.4f n=%d" % (k, v["recall"], v["precision"], v["f1"], int(v["support"])))
    print()
