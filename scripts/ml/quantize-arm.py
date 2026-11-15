"""
quantize-arm.py — dynamic int8 quantization of a SoterAI arm, for measurement.

Weights stay fp32 in the source dir; output goes to a new dir so the shipped
artifact is never modified. Dynamic quantization needs no calibration data, so
there is nothing to leak from the dev battery into the artifact.

Run:
  python -I -X utf8 scripts/ml/quantize-arm.py --src models/ml-classifier-v17 \
      --dst artifacts/ml/v17-int8 --mode dynamic
"""
import argparse
import json
import shutil
import sys
from pathlib import Path

from onnxruntime.quantization import QuantType, quantize_dynamic


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--dst", required=True)
    ap.add_argument("--mode", default="dynamic", choices=["dynamic"])
    ap.add_argument("--weight-type", default="QInt8")
    args = ap.parse_args()

    src, dst = Path(args.src), Path(args.dst)
    dst.mkdir(parents=True, exist_ok=True)
    for name in ("labels.json", "calibration.json", "training_stats.json", "manifest.json"):
        if (src / name).exists():
            shutil.copy2(src / name, dst / name)
    if (src / "tokenizer_config").exists():
        shutil.copytree(src / "tokenizer_config", dst / "tokenizer_config", dirs_exist_ok=True)

    out = dst / "model.onnx"
    quantize_dynamic(
        model_input=str(src / "model.onnx"),
        model_output=str(out),
        weight_type=QuantType[args.weight_type],
        per_channel=True,
        reduce_range=False,
        extra_options={"MatMulConstBOnly": True},
    )
    before = (src / "model.onnx").stat().st_size
    after = out.stat().st_size
    print(json.dumps({
        "src": str(src), "dst": str(dst), "mode": args.mode,
        "bytes_before": before, "bytes_after": after,
        "ratio": round(after / before, 3),
    }, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
