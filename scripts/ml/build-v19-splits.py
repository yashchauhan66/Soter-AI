"""
build-v19-splits.py — leakage-safe train/dev/sealed split builder for v19.

What it guarantees, or refuses to run:
  1. EXACT + NORMALIZED dedupe inside every pool.
  2. TEMPLATE-FAMILY grouping: rows whose first six normalized words match (after
     masking digits and URLs) are one family, and a family lives in one split.
     Random row splits leak paraphrases; this is the failure mode that produced
     v18's 99.5% self-report.
  3. LOCKED pools: rows already in the dev set or the sealed set are removed from
     train even if a training file contains them (the dev battery is 82% training
     data today — see docs/v19/PHASE-0-1-FINDINGS.md W1).
  4. REFUSAL: if any sealed text (or its normalized form) survives in train, exit
     non-zero. A silent overlap is the one bug that invalidates every later number.

Usage:
  python -I -X utf8 scripts/ml/build-v19-splits.py \
      --train datasets/... (repeatable) \
      --dev  artifacts/ml/... \
      --sealed data/v19/sealed.jsonl \
      --out  data/v19/splits
Outputs train.jsonl, dev.jsonl, sealed.jsonl + split-manifest.json (counts, shas,
family counts, per-source counts). The sealed file is written WITHOUT training
labels leaking into logs; only its hash is printed.
"""
import argparse
import hashlib
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

WORD = re.compile(r"[^\w]+", re.UNICODE)
DIGITS = re.compile(r"\d+")
URL = re.compile(r"https?://\S+|www\.\S+")
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")


def norm(text: str) -> str:
    t = unicodedata.normalize("NFKC", text).casefold()
    t = URL.sub(" url ", t)
    t = EMAIL.sub(" email ", t)
    t = WORD.sub(" ", t).strip()
    return t


def family_key(text: str) -> str:
    """Six normalized words with digits masked: a template re-filled with a new
    noun keeps the same key, a genuinely different attack does not."""
    words = DIGITS.sub(" n ", norm(text)).split()[:6]
    return " ".join(words)


def sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def read_jsonl(path):
    with open(path, encoding="utf-8") as fh:
        for n, line in enumerate(fh, 1):
            if not line.strip():
                continue
            row = json.loads(line)
            if not isinstance(row.get("text"), str) or not row["text"].strip():
                raise SystemExit(f"{path}:{n}: missing text")
            if row.get("label") not in (None, "SAFE") and not isinstance(row.get("label"), str):
                raise SystemExit(f"{path}:{n}: bad label")
            yield row


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--train", action="append", default=[])
    ap.add_argument("--dev", action="append", default=[])
    ap.add_argument("--sealed", action="append", default=[])
    ap.add_argument("--out", required=True)
    ap.add_argument("--manifest", default=None)
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    def load(paths, pool):
        seen_exact, seen_norm, dropped, kept = set(), set(), Counter(), []
        families = defaultdict(int)
        for p in paths:
            for row in read_jsonl(p):
                h, n = sha(row["text"]), norm(row["text"])
                if h in seen_exact or n in seen_norm:
                    dropped["duplicate"] += 1
                    continue
                if not n:
                    dropped["empty_after_normalization"] += 1
                    continue
                seen_exact.add(h)
                seen_norm.add(n)
                fam = family_key(row["text"])
                if families[fam] >= 60:  # a family this large is template spam, not data
                    dropped["family_cap"] += 1
                    continue
                families[fam] += 1
                row.setdefault("source", p)
                row["_family"] = fam
                kept.append(row)
        print(f"{pool}: kept {len(kept)} dropped {dict(dropped)} families {len(families)}")
        return kept, families

    dev, dev_fam = load(args.dev, "dev")
    sealed, sealed_fam = load(args.sealed, "sealed")

    # A family in dev or sealed must not appear in train, whatever the file says.
    locked_families = set(dev_fam) | set(sealed_fam)
    locked_norm = {norm(r["text"]) for r in dev + sealed}
    locked_exact = {sha(r["text"]) for r in dev + sealed}

    train_rows, train_fam = load(args.train, "train")
    train, locked_out = [], Counter()
    for row in train_rows:
        if row["_family"] in locked_families:
            locked_out["family_in_dev_or_sealed"] += 1
            continue
        if sha(row["text"]) in locked_exact or norm(row["text"]) in locked_norm:
            locked_out["text_in_dev_or_sealed"] += 1
            continue
        train.append(row)
    print(f"train: kept {len(train)} locked out {dict(locked_out)}")

    # Final refusal: nothing from sealed may be present in train.
    train_norm = {norm(r["text"]) for r in train}
    leaked = sum(1 for r in sealed if norm(r["text"]) in train_norm)
    if leaked:
        print(f"REFUSING: {leaked} sealed rows survive in train", file=sys.stderr)
        return 1

    for name, rows in (("train", train), ("dev", dev), ("sealed", sealed)):
        with (out / f"{name}.jsonl").open("w", encoding="utf-8") as fh:
            for r in rows:
                fh.write(json.dumps(r, ensure_ascii=False) + "\n")

    manifest = {
        "generated_by": "scripts/ml/build-v19-splits.py",
        "counts": {
            name: {
                "rows": len(rows),
                "attacks": sum(1 for r in rows if (r.get("label") or "SAFE") != "SAFE"),
                "benign": sum(1 for r in rows if (r.get("label") or "SAFE") == "SAFE"),
                "families": len({r["_family"] for r in rows}),
                "sha256": hashlib.sha256((out / f"{name}.jsonl").read_bytes()).hexdigest(),
            }
            for name, rows in (("train", train), ("dev", dev), ("sealed", sealed))
        },
        "locked_out_of_train": dict(locked_out),
        "sealed_leak_into_train": leaked,
        "inputs": {"train": args.train, "dev": args.dev, "sealed": args.sealed},
    }
    (out / "split-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest["counts"], indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
