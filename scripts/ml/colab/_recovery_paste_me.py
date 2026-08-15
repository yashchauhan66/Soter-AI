# ── SoterLLM v7 recovery: re-export WITHOUT retraining ───────────────────────
# Paste into a NEW cell of your CURRENT Colab session (the one whose training
# finished) and run it. It loads the saved checkpoint and re-runs only the
# export + artifact stages — ~2 minutes instead of a 45-minute re-train.
#
# Do NOT re-upload the notebook: that spawns a fresh runtime and wipes the
# trained weights. Edit this session in place; the updated file is just for
# next time. After this cell, run the notebook's LAST cell ("5/5") to download
# ml-classifier-v7.zip.
import json, os, shutil, subprocess, sys, time
import torch

OUT = "models/ml-classifier-v7"
BIN = os.path.join(OUT, "pytorch_model.bin")

# Fall back to the Drive mirror: /content is wiped when the runtime is recycled,
# but the mirror written during training survives that.
if not os.path.exists(BIN):
    MIRROR = "/content/drive/MyDrive/soterai-v7-artifacts"
    if not os.path.isdir(MIRROR):
        try:
            from google.colab import drive

            drive.mount("/content/drive")
        except Exception as e:  # not on Colab, or user declined the mount
            print("could not mount Drive:", e)
    mirrored = os.path.join(MIRROR, "pytorch_model.bin")
    if os.path.exists(mirrored):
        print(f"restoring from Drive mirror: {MIRROR}")
        os.makedirs(OUT, exist_ok=True)
        # shutil, not rsync: rsync may not exist on the image, and a restore that
        # silently copies nothing looks exactly like genuinely lost weights.
        for _n in sorted(os.listdir(MIRROR)):
            _s = os.path.join(MIRROR, _n)
            if os.path.isfile(_s) and not _n.endswith(".part"):
                shutil.copy2(_s, os.path.join(OUT, _n))
                print(f"  restored {_n:28} {os.path.getsize(_s)/1e6:7.2f} MB")

assert os.path.exists(BIN), (
    f"no checkpoint at {BIN}, and no Drive mirror to restore from.\n"
    "The runtime was recycled and /content was wiped, so the trained weights are "
    "gone — a full re-train is the only path. Run the diagnostic "
    "(_diagnose_paste_me.py) to confirm before spending another 45 GPU-minutes."
)

print("installing onnxscript (needed by torch.onnx.export on torch 2.9)...")
subprocess.run([sys.executable, "-m", "pip", "install", "-q", "onnxscript"], check=True)
import transformers

# Load the trainer by file path: "train-soterllm-v4.py" has hyphens, so a plain
# `import` can't name it. This does NOT retrain — spec_from_file_location sets
# __name__ to "soterllm_trainer", so the `if __name__ == "__main__"` tail is dead.
import importlib.util

spec = importlib.util.spec_from_file_location(
    "soterllm_trainer", "scripts/ml/train-soterllm-v4.py"
)
T = importlib.util.module_from_spec(spec)
spec.loader.exec_module(T)

# ── Load checkpoint into the exact same architecture (dropout=0.15, default) ──
t0 = time.time()
model = T.SoterLLMv4(num_labels=len(T.ALL_LABELS), dropout=0.15)
model.load_state_dict(torch.load(BIN, map_location="cpu"))
model.eval()
print(f"checkpoint loaded ({time.time() - t0:.1f}s)")

# ── Rebuild tokenizer, then recompute val metrics on the loaded checkpoint ──
# Recomputed rather than transcribed from the crashed run's stdout: a number
# copied out of a log is a claim, one produced here is evidence.
tokenizer = transformers.AutoTokenizer.from_pretrained(T.MODEL_NAME)
cal = json.load(open(os.path.join(OUT, "calibration.json"), encoding="utf-8"))
temperature = float(cal["temperature"])
print(f"temperature from calibration.json: {temperature}")

print("recomputing group-aware val metrics...")
t0 = time.time()
from torch.utils.data import DataLoader, Subset

full = T.AdversarialDataset(
    ["datasets/ml-augmented-v7.jsonl"], {n: i for i, n in enumerate(T.ALL_LABELS)}
)
# Same seed/fractions as the training run -> identical split, no leak.
_, _, val_idx = T.group_aware_three_way_split(full.groups, 0.12, 0.08, 42)
val_loader = DataLoader(
    Subset(full, val_idx),
    batch_size=64,
    shuffle=False,
    collate_fn=lambda b: T.collate_fn(b, tokenizer, 256),
)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)
final = T.evaluate(model, val_loader, device, T.ALL_LABELS, temperature=temperature)
print(
    f"val eval done ({time.time() - t0:.1f}s)  n={len(val_idx)}  "
    f"acc={final['accuracy']:.4f}  atk_rec={final['attack_recall']:.4f}"
)

# ── Re-run the export stage (the part that crashed) ──
model.cpu()
onnx_path = T.export_to_onnx(model, tokenizer, OUT, temperature=temperature)
print(f"[OK] {onnx_path}")

labels_path = os.path.join(OUT, "labels.json")
with open(labels_path, "w", encoding="utf-8") as f:
    json.dump({str(i): n for i, n in enumerate(T.ALL_LABELS)}, f, indent=2)
print(f"[OK] {labels_path}")

T.save_tokenizer(OUT, tokenizer)

report = final["classification_report"]
with open(os.path.join(OUT, "training_stats.json"), "w", encoding="utf-8") as f:
    json.dump(
        {
            "product_name": T.PRODUCT_NAME,
            "product_version": T.PRODUCT_VERSION,
            "base_model": T.MODEL_NAME,
            "num_labels": len(T.ALL_LABELS),
            "labels": T.ALL_LABELS,
            "recovered_export": True,
            "recovery_note": (
                "Training finished; export crashed on missing onnxscript. This run "
                "re-exported from the best checkpoint (pytorch_model.bin) and "
                "recomputed val metrics on the same seed-42 group-aware split. "
                "Per-epoch history was not persisted by the crashed run."
            ),
            "calibration": cal,
            "final_metrics": {
                "accuracy": final["accuracy"],
                "f1_macro": final["f1_macro"],
                "f1_weighted": final["f1_weighted"],
                "attack_recall": final["attack_recall"],
                "attack_precision": final["attack_precision"],
                "split": "group_aware_validation",
            },
            "per_label_metrics": {n: report[n] for n in T.ALL_LABELS if n in report},
        },
        f,
        indent=2,
    )
print("[OK] training_stats.json")

print("\nartifacts in", OUT)
for name in sorted(os.listdir(OUT)):
    p = os.path.join(OUT, name)
    if os.path.isfile(p):
        print(f"  {name:26} {os.path.getsize(p) / 1e6:7.2f} MB")
print("\n-> now run the notebook's LAST cell ('5/5') to package and download")
