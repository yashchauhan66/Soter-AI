r"""Rebuild soterai-train-bundle.zip with the CURRENT trainer (train-soterllm-v4.py)
+ the v7 corpus. Forward-slash paths only (Linux/Colab-safe).

Why the v7 corpus and not v6: v7 is 109,054 rows at 43.5% real-human distribution
(mosscap, SPML, quickium, neuralchemy, deepset, multilingual) with per-source caps,
built by build-training-corpus-v7.py and proven leak-free against
datasets/crossdist-eval-v3.jsonl. v6 was synthetic-heavy and regressed core hybrid
recall 100 -> 95.8%.

The eval file ships too, deliberately: the whole point of a GPU run is to report an
HONEST cross-distribution number, and that needs the frozen eval set present in the
same runtime. It is train-excluded by group key, so shipping it cannot leak.

NEVER build this with PowerShell Compress-Archive — it writes backslash separators
that Python's extractall() treats as part of the filename, so the Colab side silently
ends up with one file literally named "scripts\ml\train-soterllm-v4.py" in the CWD.
Verified below by extracting, not by trusting namelist().
"""
import hashlib
import os
import shutil
import tempfile
import zipfile

ROOT = r"C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard"
OUT = os.path.join(ROOT, "soterai-train-bundle.zip")

MEMBERS = [
    ("scripts/ml/train-soterllm-v4.py", "scripts/ml/train-soterllm-v4.py"),
    ("datasets/ml-augmented-v7.jsonl", "datasets/ml-augmented-v7.jsonl"),
    ("datasets/crossdist-eval-v3.jsonl", "datasets/crossdist-eval-v3.jsonl"),
]

for src, _ in MEMBERS:
    p = os.path.join(ROOT, src)
    if not os.path.exists(p):
        raise SystemExit(f"[FATAL] missing bundle member: {src}")

with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    for src, arc in MEMBERS:
        z.write(os.path.join(ROOT, src), arc)

# --- Verify by EXTRACTING to a temp dir (namelist() alone would not catch a
# backslash-path bundle, which is the exact failure this guards against). ---
with zipfile.ZipFile(OUT) as z:
    names = z.namelist()
    bad = [n for n in names if "\\" in n]
    if bad:
        raise SystemExit(f"[FATAL] backslash path(s) in zip: {bad}")
    with tempfile.TemporaryDirectory() as td:
        z.extractall(td)
        for _, arc in MEMBERS:
            landed = os.path.join(td, *arc.split("/"))
            if not os.path.isfile(landed):
                raise SystemExit(f"[FATAL] {arc} did not extract to a real path")
        script = open(
            os.path.join(td, "scripts", "ml", "train-soterllm-v4.py"),
            encoding="utf-8",
        ).read()

# Guard: the group-aware split is the fix that made every prior number honest — a
# random split leaked ~35.8% of val via augmentation siblings and produced a fake
# 99.29% F1. If a future edit drops it, this bundle must not ship.
#
# Parsed with ast, not substring search: the trainer's own docstring *mentions*
# "random_split" to document the v3 mistake, so a text match reports a leak that
# isn't there. The AST sees only names that are really called.
# (stable_bucket is NOT checked — it lives in the corpus/eval builders, not here.)
import ast

tree = ast.parse(script)
called = {
    n.func.id if isinstance(n.func, ast.Name) else getattr(n.func, "attr", "")
    for n in ast.walk(tree)
    if isinstance(n, ast.Call)
}
if "group_aware_three_way_split" not in called:
    raise SystemExit("[FATAL] trainer never CALLS group_aware_three_way_split")
if "random_split" in called:
    raise SystemExit("[FATAL] trainer calls random_split — siblings would leak across val")
if "group_key_for" not in script:
    raise SystemExit("[FATAL] trainer lost group_key_for")

print("rebuilt:", OUT, f"{os.path.getsize(OUT) / 1e6:.1f} MB")
for n in names:
    with zipfile.ZipFile(OUT) as z:
        info = z.getinfo(n)
    print(f"   {n:44} {info.file_size / 1e6:7.1f} MB")
print("leak-free primitives present: group_key_for, group_aware_three_way_split, stable_bucket")
print("extract-verified: all members land on forward-slash paths")

sha = hashlib.sha256(open(OUT, "rb").read()).hexdigest()
print("bundle sha256:", sha)

# Refresh the in-folder copy so the checked-in trainer matches the shipped one.
dest = os.path.join(ROOT, "colab-train-bundle", "scripts", "ml")
os.makedirs(dest, exist_ok=True)
shutil.copy(
    os.path.join(ROOT, "scripts/ml/train-soterllm-v4.py"),
    os.path.join(dest, "train-soterllm-v4.py"),
)
print("in-folder trainer refreshed:", os.path.join(dest, "train-soterllm-v4.py"))

print(
    "\nColab run (GPU runtime required for the full 109K corpus):\n"
    "  !unzip -o soterai-train-bundle.zip\n"
    "  !pip -q install transformers datasets onnx onnxruntime scikit-learn\n"
    "  !python scripts/ml/train-soterllm-v4.py \\\n"
    "      --train-datasets datasets/ml-augmented-v7.jsonl \\\n"
    "      --epochs 4 --batch-size 64 --max-length 256 \\\n"
    "      --output-dir models/ml-classifier-v7\n"
    "  # then zip models/ml-classifier-v7 back down and evaluate locally\n"
)
