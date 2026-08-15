# ── Where did the checkpoint go? Read-only diagnosis, writes nothing ─────────
# Paste into a new Colab cell and run. The decisive question is whether
# calibration.json is still present: the trainer wrote it to the SAME directory
# as pytorch_model.bin, so
#   both gone      -> the runtime was recycled, the disk was wiped, re-train
#   only .bin gone -> wrong working directory, or a partial-write; recoverable
import os, subprocess

OUT = "models/ml-classifier-v7"
print("cwd:", os.getcwd())
print()

print(f"--- {OUT} ---")
if os.path.isdir(OUT):
    entries = sorted(os.listdir(OUT))
    if entries:
        for n in entries:
            p = os.path.join(OUT, n)
            kind = "dir " if os.path.isdir(p) else f"{os.path.getsize(p)/1e6:7.2f} MB"
            print(f"  {n:28} {kind}")
    else:
        print("  (directory exists but is EMPTY)")
else:
    print("  directory does NOT exist")
print()

# The survival test.
cal = os.path.join(OUT, "calibration.json")
print("calibration.json present:", os.path.exists(cal))
print("pytorch_model.bin present:", os.path.exists(os.path.join(OUT, "pytorch_model.bin")))
print()

print("--- did the training inputs survive? ---")
for p in (
    "scripts/ml/train-soterllm-v4.py",
    "datasets/ml-augmented-v7.jsonl",
    "datasets/crossdist-eval-v3.jsonl",
    "soterai-train-bundle.zip",
):
    print(f"  {'yes' if os.path.exists(p) else 'NO '}  {p}")
print()

# The Drive mirror outlives a recycled runtime, so it decides whether a wiped
# /content means "re-train" or just "restore".
print("--- Drive mirror (survives a runtime recycle) ---")
MIRROR = "/content/drive/MyDrive/soterai-v7-artifacts"
if os.path.isdir(MIRROR):
    found = sorted(n for n in os.listdir(MIRROR) if os.path.isfile(os.path.join(MIRROR, n)))
    if found:
        for n in found:
            print(f"  {n:28} {os.path.getsize(os.path.join(MIRROR, n))/1e6:7.2f} MB")
        if os.path.exists(os.path.join(MIRROR, "pytorch_model.bin")):
            print("\n  -> checkpoint IS mirrored: run the 4b recovery cell, do NOT re-train")
    else:
        print("  mirror directory exists but is empty")
elif os.path.isdir("/content/drive"):
    print(f"  no {MIRROR} (training ran before mirroring was added)")
else:
    print("  Drive not mounted in this runtime — mount it to check the mirror")
print()

print("--- /content top level ---")
for n in sorted(os.listdir("/content")):
    p = os.path.join("/content", n)
    print(f"  {n}{'/' if os.path.isdir(p) else ''}")
print()

# Search the whole disk: a stray checkpoint under another output dir is still usable.
print("--- any checkpoint / model file anywhere ---")
hits = subprocess.run(
    [
        "find", "/content", "/root", "/tmp", "-maxdepth", "6",
        "(", "-name", "*.bin", "-o", "-name", "*.onnx", "-o", "-name", "*.pt",
        "-o", "-name", "*.safetensors", ")", "-size", "+1M",
    ],
    capture_output=True, text=True,
).stdout.strip()
if hits:
    for line in hits.split("\n"):
        try:
            print(f"  {os.path.getsize(line)/1e6:8.1f} MB  {line}")
        except OSError:
            print(f"  {'?':>8}     {line}")
else:
    print("  none found (HF cache weights would be the base model, not your training)")
print()

print("--- GPU / session age ---")
print(subprocess.run(["nvidia-smi", "--query-gpu=name,memory.used", "--format=csv"],
                     capture_output=True, text=True).stdout or "no nvidia-smi")
print(subprocess.run(["uptime"], capture_output=True, text=True).stdout)
