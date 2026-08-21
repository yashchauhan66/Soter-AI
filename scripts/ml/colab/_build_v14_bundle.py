r"""Build soterai-v14-train-bundle.zip for the GPU run.

Members: the v14 trainer, its augmentation module, and the full 8-dataset corpus
(146,757 rows total -- the v13 corpora included, which were never trained before).

NEVER build this with PowerShell Compress-Archive -- it writes backslash
separators that Python's extractall() treats as part of the filename, so the
Colab side silently ends up with one file literally named
"scripts\ml\train-soterllm-v14-fullft.py" in the CWD. Verified below by
EXTRACTING, not by trusting namelist() (that is the established repo rule; see
the v7 bundle builder).

The v13 datasets ship train-only, like every other corpus. The eval set does NOT
ship here: v14 is a training bundle, and the honest OOD number is measured AFTER
training with scripts/ml/eval-crossdist-production.ts against the existing
frozen crossdist evals, which already live in the repo. If you want a one-shot
Colab eval too, add datasets/crossdist-eval-v3.jsonl to MEMBERS -- it is
train-excluded by group key and cannot leak.
"""
import hashlib
import os
import tempfile
import zipfile

ROOT = r"C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard"
OUT = os.path.join(ROOT, "soterai-v14-train-bundle.zip")

MEMBERS = [
    "scripts/ml/train-soterllm-v14-fullft.py",
    "scripts/ml/soter_augment.py",
    # The no-notebook runner ships INSIDE the bundle on purpose: the hosts it
    # exists for (RunPod, Vast.ai, a bare VM) have no notebook UI and often no
    # convenient way to copy a second file over. One upload has to be enough.
    "scripts/ml/colab/run_v14_anywhere.py",
    "datasets/ml-augmented-v8-final.jsonl",
    "datasets/ml-v8-targeted-fix.jsonl",
    "datasets/ml-v10-advanced-attacks.jsonl",
    "datasets/ml-v10-targeted-fix.jsonl",
    "datasets/ml-v11-weak-fix.jsonl",
    "artifacts/ml-v2/v12-toxicity-fix.jsonl",
    "datasets/ml-v13-meta-instructional.jsonl",
    "datasets/ml-v13-attack-gaps.jsonl",
]

for src in MEMBERS:
    p = os.path.join(ROOT, src)
    if not os.path.exists(p):
        raise SystemExit(f"[FATAL] missing bundle member: {src}")

with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    for src in MEMBERS:
        z.write(os.path.join(ROOT, src), src)

# --- Verify by EXTRACTING to a temp dir (namelist() alone would not catch a
# backslash-path bundle, which is the exact failure this guards against). ---
with zipfile.ZipFile(OUT) as z:
    names = z.namelist()
    bad = [n for n in names if "\\" in n]
    if bad:
        raise SystemExit(f"[FATAL] backslash path(s) in zip: {bad}")
    with tempfile.TemporaryDirectory() as td:
        z.extractall(td)
        for arc in MEMBERS:
            landed = os.path.join(td, *arc.split("/"))
            if not os.path.isfile(landed):
                raise SystemExit(f"[FATAL] {arc} did not extract to a real path")

sha = hashlib.sha256(open(OUT, "rb").read()).hexdigest()
size = os.path.getsize(OUT)
print(f"[ok] {OUT}")
print(f"     {size / 1048576:.1f} MB, {len(MEMBERS)} members, sha256 {sha[:16]}...")
print("     Colab   : upload -> unzip -> soterllm-v14-gpu.ipynb")
print("     Kaggle  : upload as a private Dataset -> soterllm-v14-kaggle.ipynb")
print("     anywhere: upload -> python scripts/ml/colab/run_v14_anywhere.py")
