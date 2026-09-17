#!/usr/bin/env python3
r"""Build soterai-v15-train-bundle.zip -- the upload for the v15 Colab/Kaggle run.

Run on Windows:  python scripts/ml/colab/_build_v15_bundle.py

v15 = v14's trainer + v14's exact 8-dataset corpus + ONE 9th file
(datasets/ml-v15-threat-corpus.jsonl). This packages all of that plus the
augmentation module and the portable runner into a single upload.

Built with Python's zipfile, NOT PowerShell Compress-Archive, on purpose:
Compress-Archive writes member names with BACKSLASH separators, which Linux
(Colab/Kaggle) unzip treats as literal one-segment filenames -- the tree never
materialises and the run dies later with a baffling missing-dataset error. This
writer emits forward slashes and then PROVES it by extracting to a temp dir and
re-reading, rather than trusting namelist() (Windows' own extractall silently
repairs backslashes, so a namelist() check would pass on the very machine that
creates the bug -- verify by extraction only).
"""
from __future__ import annotations

import hashlib
import os
import tempfile
import zipfile

ROOT = r"C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard"
OUT = os.path.join(ROOT, "soterai-v15-train-bundle.zip")

# Order is documentation, not function: scripts first, then the corpus in the
# same load order the trainer will see. The first 8 datasets are v14's exact
# corpus (146,757 rows); ml-v15-threat-corpus.jsonl is the v15 increment.
MEMBERS = [
    "scripts/ml/train-soterllm-v14-fullft.py",   # v15 reuses the v14 trainer verbatim
    "scripts/ml/soter_augment.py",               # imported by the trainer; MUST ship beside it
    "scripts/ml/colab/run_v15_anywhere.py",      # no-notebook fallback runner
    "datasets/ml-augmented-v8-final.jsonl",
    "datasets/ml-v8-targeted-fix.jsonl",
    "datasets/ml-v10-advanced-attacks.jsonl",
    "datasets/ml-v10-targeted-fix.jsonl",
    "datasets/ml-v11-weak-fix.jsonl",
    "artifacts/ml-v2/v12-toxicity-fix.jsonl",
    "datasets/ml-v13-meta-instructional.jsonl",
    "datasets/ml-v13-attack-gaps.jsonl",
    "datasets/ml-v15-threat-corpus.jsonl",       # <- the ONLY new member vs the v14 bundle
]


def main() -> int:
    missing = [m for m in MEMBERS if not os.path.isfile(os.path.join(ROOT, m))]
    if missing:
        raise SystemExit("[FATAL] missing bundle members:\n  " + "\n  ".join(missing))

    if os.path.exists(OUT):
        os.remove(OUT)

    total_rows = 0
    print("packing:")
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for rel in MEMBERS:
            src = os.path.join(ROOT, rel)
            # arcname is the forward-slash relative path; z.write on Windows would
            # otherwise store the OS-native separator.
            arc = rel.replace(os.sep, "/")
            z.write(src, arc)
            mb = os.path.getsize(src) / 1048576
            note = ""
            if rel.endswith(".jsonl"):
                n = sum(1 for _ in open(src, encoding="utf-8"))
                total_rows += n
                note = f"  ({n:,} rows)"
            print(f"  {mb:7.2f} MB  {arc}{note}")

    size_mb = os.path.getsize(OUT) / 1048576
    sha = hashlib.sha256(open(OUT, "rb").read()).hexdigest()

    # --- verify by EXTRACTION, not namelist() (see module docstring) -----------
    with zipfile.ZipFile(OUT) as z:
        names = z.namelist()
        bad = [n for n in names if "\\" in n]
        if bad:
            raise SystemExit(f"[FATAL] backslash member names present: {bad[:3]}")
        with tempfile.TemporaryDirectory() as tmp:
            z.extractall(tmp)
            for rel in MEMBERS:
                p = os.path.join(tmp, *rel.split("/"))
                if not os.path.isfile(p):
                    raise SystemExit(f"[FATAL] did not extract to a real path: {rel}")
            # spot-check the v15 increment is intact end to end
            v15 = os.path.join(tmp, "datasets", "ml-v15-threat-corpus.jsonl")
            v15_rows = sum(1 for _ in open(v15, encoding="utf-8"))

    print("-" * 64)
    print(f"OUT     : {OUT}")
    print(f"size    : {size_mb:.2f} MB   ({len(names)} members, {total_rows:,} dataset rows)")
    print(f"v15 inc : {v15_rows:,} rows in datasets/ml-v15-threat-corpus.jsonl")
    print(f"sha256  : {sha}")
    print("verify  : extracted to temp + re-read OK, no backslash names -> Linux-safe")
    print("\nUpload this to Colab (Files pane) or `kaggle datasets`. The notebook's")
    print("unpack cell expects exactly this filename.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
