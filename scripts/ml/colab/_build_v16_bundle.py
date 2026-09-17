#!/usr/bin/env python3
r"""Build soterai-v16-train-bundle.zip -- the upload for the v16 Colab/Kaggle run.

Run on Windows:  python scripts/ml/colab/_build_v16_bundle.py

v16 = v14's trainer + the same 9-file corpus v15 trained on + ONE 10th file
(datasets/ml-v16-threat-corpus.jsonl). The 10th file is the multilingual /
multi-turn / agentic increment built by scripts/ml/_build_v16_corpus.py and
leak-guarded by scripts/ml/verify-v16-corpus.py.

Built with Python's zipfile, NOT PowerShell Compress-Archive, on purpose:
Compress-Archive writes member names with BACKSLASH separators, which Linux
(Colab/Kaggle) unzip treats as literal one-segment filenames -- the tree never
materialises and the run dies later with a baffling missing-dataset error. This
writer emits forward slashes and then PROVES it by extracting to a temp dir and
re-reading, rather than trusting namelist() (Windows' own extractall silently
repairs backslashes, so a namelist() check would pass on the very machine that
creates the bug -- verify by extraction only).

It also refuses to build if the v16 increment has not been through the leak
guard. A bundle is the last point at which a probe-battery row can be stopped
from reaching a GPU; after upload there is no gate left.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import tempfile
import zipfile

ROOT = r"C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard"
OUT = os.path.join(ROOT, "soterai-v16-train-bundle.zip")
INCREMENT = "datasets/ml-v16-threat-corpus.jsonl"
GUARD_REPORT = "artifacts/ml/v16-corpus-report.json"

# Order is documentation, not function: scripts first, then the corpus in the
# same load order the trainer will see. The first 9 are v15's exact corpus;
# ml-v16-threat-corpus.jsonl is the v16 increment.
MEMBERS = [
    "scripts/ml/train-soterllm-v14-fullft.py",   # v16 reuses the v14 trainer verbatim
    "scripts/ml/soter_augment.py",               # imported by the trainer; MUST ship beside it
    "scripts/ml/colab/run_v16_anywhere.py",      # no-notebook fallback runner
    "datasets/ml-augmented-v8-final.jsonl",
    "datasets/ml-v8-targeted-fix.jsonl",
    "datasets/ml-v10-advanced-attacks.jsonl",
    "datasets/ml-v10-targeted-fix.jsonl",
    "datasets/ml-v11-weak-fix.jsonl",
    "artifacts/ml-v2/v12-toxicity-fix.jsonl",
    "datasets/ml-v13-meta-instructional.jsonl",
    "datasets/ml-v13-attack-gaps.jsonl",
    "datasets/ml-v15-threat-corpus.jsonl",
    INCREMENT,                                   # <- the ONLY new member vs the v15 bundle
]

# Every held-out instrument v16 will be judged on. Re-checked HERE, at pack time,
# not just at generation time: the increment file can be regenerated, hand-edited
# or restored from a stale copy between those two moments.
HOLDOUTS = [
    "datasets/v16-probe-battery.jsonl",
    "datasets/v15-test-battery.jsonl",
    "datasets/crossdist-eval-v3.jsonl",
    "artifacts/ml/_v15-tranches-scoreset.jsonl",
]


def read_jsonl(path: str) -> list:
    """re.split(r"\r?\n"), not splitlines(): splitlines also breaks on U+2028,
    U+2029, U+0085 and \x0b-\x1e, which are exactly the characters the Unicode
    smuggling rows in this corpus contain -- it would shred them into
    unparseable fragments and silently under-count."""
    with open(path, encoding="utf-8") as fh:
        blob = fh.read()
    out = []
    for line in re.split(r"\r?\n", blob):
        line = line.strip()
        if line:
            out.append(json.loads(line))
    return out


def norm(text: str) -> str:
    """Cheap, dependency-free normalisation for the pack-time leak re-check.
    Deliberately NOT group_key_for(): this file must stay importable with no
    sys.path surgery. It is a second, independent net, not a replacement for
    verify-v16-corpus.py, which does the real group-aware check."""
    return re.sub(r"\s+", " ", text.strip().lower())


def main() -> int:
    missing = [m for m in MEMBERS if not os.path.isfile(os.path.join(ROOT, m))]
    if missing:
        raise SystemExit("[FATAL] missing bundle members:\n  " + "\n  ".join(missing))

    # ── gate 1: the increment must have passed the leak guard ────────────────
    rpath = os.path.join(ROOT, GUARD_REPORT)
    if not os.path.isfile(rpath):
        raise SystemExit(
            f"[FATAL] {GUARD_REPORT} not found.\n"
            "        Run: python scripts/ml/verify-v16-corpus.py\n"
            "        The bundle is the last gate before a GPU; it will not pack an\n"
            "        unverified increment.")
    report = json.loads(open(rpath, encoding="utf-8").read())
    if report.get("holdout_collisions", -1) != 0:
        raise SystemExit(f"[FATAL] guard report says holdout_collisions="
                         f"{report.get('holdout_collisions')}; refusing to pack.")

    inc_rows = read_jsonl(os.path.join(ROOT, INCREMENT))
    if len(inc_rows) != report.get("increment_rows_kept"):
        raise SystemExit(
            f"[FATAL] {INCREMENT} has {len(inc_rows):,} rows but the guard report was\n"
            f"        written for {report.get('increment_rows_kept'):,}. The file changed\n"
            "        after it was verified. Re-run scripts/ml/verify-v16-corpus.py.")

    # ── gate 2: independent pack-time re-check against every instrument ──────
    inc_keys = {norm(r.get("text", "")) for r in inc_rows}
    for rel in HOLDOUTS:
        hp = os.path.join(ROOT, rel)
        if not os.path.isfile(hp):
            raise SystemExit(f"[FATAL] holdout instrument missing, cannot re-check: {rel}")
        hits = [r for r in read_jsonl(hp) if norm(r.get("text", "")) in inc_keys]
        if hits:
            sample = repr(hits[0].get("text", "")[:100]).encode(
                "ascii", "backslashreplace").decode("ascii")
            raise SystemExit(
                f"[FATAL] {len(hits)} rows of {rel} appear in the training increment.\n"
                f"        e.g. {sample}\n"
                "        Training on these would make the v15-vs-v16 re-score measure\n"
                "        memorisation. Refusing to pack.")
        print(f"  [leak-check] {rel:<48} clean")

    if os.path.exists(OUT):
        os.remove(OUT)

    total_rows = 0
    print("\npacking:")
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
            # Spot-check the v16 increment survived the round trip byte-for-byte:
            # a truncated multilingual file is the failure this bundle would
            # otherwise carry all the way to a GPU.
            v16p = os.path.join(tmp, *INCREMENT.split("/"))
            v16_rows = read_jsonl(v16p)
            if len(v16_rows) != len(inc_rows):
                raise SystemExit(f"[FATAL] increment round-tripped as {len(v16_rows)} rows, "
                                 f"expected {len(inc_rows)}")
            nonascii = sum(1 for r in v16_rows if any(ord(c) > 127 for c in r.get("text", "")))

    after = report.get("after", {})
    print("-" * 68)
    print(f"OUT     : {OUT}")
    print(f"size    : {size_mb:.2f} MB   ({len(names)} members, {total_rows:,} dataset rows)")
    print(f"v16 inc : {len(v16_rows):,} rows in {INCREMENT}")
    print(f"          {nonascii:,} carry non-ASCII text and survived the zip round trip")
    print(f"corpus  : MULTI_TURN {after.get('multi_turn_share_pct')}%   "
          f"non-English {after.get('non_english_share_pct')}%   "
          f"({after.get('rows', 0):,} rows total)")
    print(f"sha256  : {sha}")
    print("verify  : extracted to temp + re-read OK, no backslash names -> Linux-safe")
    print("leak    : increment re-checked against all 4 held-out instruments -> clean")
    print("\nUpload this to Colab (Files pane) or `kaggle datasets`. The notebook's")
    print("unpack cell expects exactly this filename.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
