"""
audit-readme-corpora-contamination.py — how much of the README eval corpora
appears in a model's training files?

Reads every eval text from the TS dataset modules (via a tiny tsx export,
scripts/ml/_dump-readme-corpora.ts) and matches it against each training file
listed in a model's dataset_manifest.json, at three strengths:

  exact       byte-identical text
  normalized  NFKC, casefold, collapse non-alphanumerics to one space
  near        Jaccard >= 0.8 on word 5-gram shingles (catches a template
              re-filled with a different noun) — only scored against training
              rows that share at least one shingle, so it stays linear-ish

Run:
  npx tsx scripts/ml/_dump-readme-corpora.ts > .tmp/readme-corpora.jsonl
  python -I scripts/ml/audit-readme-corpora-contamination.py \
      --corpora .tmp/readme-corpora.jsonl --manifest models/ml-classifier-v14/dataset_manifest.json
"""
import argparse
import collections
import hashlib
import json
import re
import sys
import unicodedata

WORD = re.compile(r"[^\w]+", re.UNICODE)


def norm(text: str) -> str:
    return WORD.sub(" ", unicodedata.normalize("NFKC", text).casefold()).strip()


def shingles(text: str, k: int = 5) -> set:
    toks = norm(text).split()
    if len(toks) < k:
        return {" ".join(toks)} if toks else set()
    return {" ".join(toks[i : i + k]) for i in range(len(toks) - k + 1)}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpora", required=True)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--near", type=float, default=0.8)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    evals = [json.loads(l) for l in open(args.corpora, encoding="utf-8") if l.strip()]
    manifest = json.load(open(args.manifest, encoding="utf-8"))

    exact, normed, index = {}, {}, collections.defaultdict(list)
    train_shingles = []
    for path in manifest["datasets"]:
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                if not line.strip():
                    continue
                text = json.loads(line).get("text", "")
                h = hashlib.sha256(text.encode("utf-8")).hexdigest()
                exact.setdefault(h, path)
                normed.setdefault(norm(text), path)
                sh = shingles(text)
                idx = len(train_shingles)
                train_shingles.append(sh)
                for s in sh:
                    # Full posting lists. Capping them silently dropped the true
                    # source row on this template-heavy corpus: the positive
                    # control (one-word-swapped training rows) scored 0/20.
                    index[s].append(idx)

    by_set = collections.OrderedDict()
    examples = collections.defaultdict(list)
    for row in evals:
        text = row["text"]
        stats = by_set.setdefault(row["set"], {"n": 0, "exact": 0, "normalized": 0, "near": 0, "any": 0})
        stats["n"] += 1
        e = hashlib.sha256(text.encode("utf-8")).hexdigest() in exact
        n = norm(text) in normed
        near = False
        if not n:
            sh = shingles(text)
            # Candidates come from the row's RAREST shingles: a near-copy shares
            # them with its source, while common template shingles would flood
            # the candidate set with thousands of unrelated rows.
            rare = sorted((s for s in sh if s in index), key=lambda s: len(index[s]))[:8]
            cands = set()
            for s in rare:
                cands.update(index[s][:5000])
            for i in cands:
                other = train_shingles[i]
                inter = len(sh & other)
                if inter and inter / len(sh | other) >= args.near:
                    near = True
                    break
        stats["exact"] += e
        stats["normalized"] += n
        stats["near"] += near and not n
        stats["any"] += e or n or near
        if (n or near) and len(examples[row["set"]]) < 3:
            examples[row["set"]].append(text[:140])

    result = {"manifest": args.manifest, "near_jaccard": args.near, "sets": by_set, "examples": examples}
    print(json.dumps(by_set, indent=2))
    if args.out:
        json.dump(result, open(args.out, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
