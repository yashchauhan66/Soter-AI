#!/usr/bin/env python3
"""Dump calibration OOD numbers + token count per model arm (diagnostic)."""
import json
for d in ["models/ml-classifier-v14", "models/ml-classifier-v17-minilm", "models/ml-classifier-v17"]:
    c = json.load(open(d + "/calibration.json", encoding="utf-8"))
    ood = {k: round(v, 5) if isinstance(v, float) else v for k, v in c.get("ood", {}).items() if k != "entropy_fit_provenance"}
    print("===", d, "===")
    print(" temp:", c.get("temperature"))
    print(" ood:", ood)
