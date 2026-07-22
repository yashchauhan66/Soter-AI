"""Rebuild soterai-train-bundle.zip with the CURRENT fixed training script + v5
dataset. Forward-slash paths only (Linux/Colab-safe)."""
import os, zipfile

ROOT = r"C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard"
OUT = os.path.join(ROOT, "soterai-train-bundle.zip")
MEMBERS = [
    ("scripts/ml/train-onnx-model.py", "scripts/ml/train-onnx-model.py"),
    ("datasets/ml-augmented-v6.jsonl", "datasets/ml-augmented-v6.jsonl"),
]
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    for src, arc in MEMBERS:
        z.write(os.path.join(ROOT, src), arc)

# Verify: forward slashes + fix present
with zipfile.ZipFile(OUT) as z:
    names = z.namelist()
    assert all("\\" not in n for n in names), "backslash in zip!"
    script = z.read("scripts/ml/train-onnx-model.py").decode("utf-8")
    fix = "GROUP-AWARE" in script and "group_key_for" in script
print("rebuilt:", OUT, os.path.getsize(OUT), "bytes")
for n in names:
    print("  ", n)
print("group-aware fix present:", fix)

# Refresh the in-folder copies too
import shutil
shutil.copy(os.path.join(ROOT, "scripts/ml/train-onnx-model.py"),
            os.path.join(ROOT, "colab-train-bundle/scripts/ml/train-onnx-model.py"))
print("in-folder script refreshed")
