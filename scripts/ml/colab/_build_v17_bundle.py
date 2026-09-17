#!/usr/bin/env python3
r"""Build soterai-v17-train-bundle.zip -- the upload for the v17 Colab/Kaggle run.

Run on Windows:  python scripts/ml/colab/_build_v17_bundle.py

v17 = v14's trainer + the v16 corpus (v15's ten files) + ONE 11th file
(datasets/ml-v17-threat-corpus.jsonl), trained TWICE: once on the multilingual
cased encoder (the candidate) and once on minilm (the control), so a result is
attributable. The 11th file is the multilingual rebalance + 2026-attack
increment built by scripts/ml/_build_v17_corpus.py and leak-guarded by
scripts/ml/verify-v17-corpus.py.

WHAT CHANGED VS THE v16 BUNDLE
  * 11 dataset members, not 10 (adds datasets/ml-v17-threat-corpus.jsonl).
  * ships run_v17_anywhere.py, which runs both arms and holds the effective
    batch at 128 across a 22M and a 135M encoder.
  * HOLDOUTS gains datasets/v17-multilingual-battery.jsonl -- the 312-row,
    39-language instrument v17 is judged on. It is re-checked HERE at pack time,
    because a bundle is the last point at which a held-out row can be stopped
    from reaching a GPU.

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
import json
import os
import re
import sys
import tempfile
import zipfile

ROOT = r"C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard"
OUT = os.path.join(ROOT, "soterai-v17-train-bundle.zip")
INCREMENT = "datasets/ml-v17-threat-corpus.jsonl"
GUARD_REPORT = "artifacts/ml/v17-corpus-report.json"

# Order is documentation, not function: scripts first, then the corpus in the
# same load order the trainer will see. The first 10 are v16's exact corpus;
# ml-v17-threat-corpus.jsonl is the v17 increment.
MEMBERS = [
    "scripts/ml/train-soterllm-v14-fullft.py",   # v17 reuses the v14 trainer verbatim
    "scripts/ml/soter_augment.py",               # imported by the trainer; MUST ship beside it
    "scripts/ml/colab/run_v17_anywhere.py",      # no-notebook fallback runner (two arms)
    "datasets/ml-augmented-v8-final.jsonl",
    "datasets/ml-v8-targeted-fix.jsonl",
    "datasets/ml-v10-advanced-attacks.jsonl",
    "datasets/ml-v10-targeted-fix.jsonl",
    "datasets/ml-v11-weak-fix.jsonl",
    "artifacts/ml-v2/v12-toxicity-fix.jsonl",
    "datasets/ml-v13-meta-instructional.jsonl",
    "datasets/ml-v13-attack-gaps.jsonl",
    "datasets/ml-v15-threat-corpus.jsonl",
    "datasets/ml-v16-threat-corpus.jsonl",
    INCREMENT,                                   # <- the ONLY new member vs the v16 bundle
]

# Every held-out instrument v17 will be judged on. Re-checked HERE, at pack time,
# not just at generation time: the increment file can be regenerated, hand-edited
# or restored from a stale copy between those two moments.
HOLDOUTS = [
    "datasets/v16-probe-battery.jsonl",
    "datasets/v15-test-battery.jsonl",
    "datasets/crossdist-eval-v3.jsonl",
    "artifacts/ml/_v15-tranches-scoreset.jsonl",
    "datasets/v17-multilingual-battery.jsonl",   # <- v17's own instrument, added this round
]


def read_jsonl(path: str) -> list:
    r"""re.split(r"\r?\n"), not splitlines(): splitlines also breaks on U+2028,
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
    verify-v17-corpus.py, which does the real group-aware check."""
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
            "        Run: python scripts/ml/verify-v17-corpus.py\n"
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
            "        after it was verified. Re-run scripts/ml/verify-v17-corpus.py.")

    # The guard report is the record that the battery was checked; if the bundle's
    # HOLDOUTS list has grown past what the report checked, the report is stale for
    # this purpose even though its collision count is zero. Catch that explicitly.
    checked = set(report.get("holdouts_checked", {}))
    for rel in HOLDOUTS:
        if rel not in checked:
            raise SystemExit(
                f"[FATAL] {rel} is in this bundle's HOLDOUTS but the guard report did not\n"
                f"        check it. Re-run scripts/ml/verify-v17-corpus.py so the leak guard\n"
                "        and the bundle agree on what is held out.")

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
                "        Training on these would make the v14-vs-v17 re-score measure\n"
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
            # Spot-check the v17 increment survived the round trip byte-for-byte:
            # a truncated multilingual file is the failure this bundle would
            # otherwise carry all the way to a GPU.
            v17p = os.path.join(tmp, *INCREMENT.split("/"))
            v17_rows = read_jsonl(v17p)
            if len(v17_rows) != len(inc_rows):
                raise SystemExit(f"[FATAL] increment round-tripped as {len(v17_rows)} rows, "
                                 f"expected {len(inc_rows)}")
            nonascii = sum(1 for r in v17_rows if any(ord(c) > 127 for c in r.get("text", "")))

    after = report.get("after", {})
    print("-" * 68)
    print(f"OUT     : {OUT}")
    print(f"size    : {size_mb:.2f} MB   ({len(names)} members, {total_rows:,} dataset rows)")
    print(f"v17 inc : {len(v17_rows):,} rows in {INCREMENT}")
    print(f"          {nonascii:,} carry non-ASCII text and survived the zip round trip")
    print(f"corpus  : MULTI_TURN {after.get('multi_turn_share_pct')}%   "
          f"non-English {after.get('non_english_share_pct')}%   "
          f"({after.get('rows', 0):,} rows total, {after.get('distinct_languages')} languages)")
    print(f"sha256  : {sha}")
    print("verify  : extracted to temp + re-read OK, no backslash names -> Linux-safe")
    print(f"leak    : increment re-checked against all {len(HOLDOUTS)} held-out instruments -> clean")
    print("\nUpload this to Colab (Files pane) or `kaggle datasets`, then:")
    print("  python run_v17_anywhere.py --arm both")
    print("The control arm (minilm) is half the experiment, not an extra -- without it a")
    print("v17 win is not attributable to the encoder, and it is the English-safe fallback.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
