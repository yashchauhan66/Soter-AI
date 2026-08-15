#!/usr/bin/env python3
"""
Fail the build when a detector regex can match inside an unrelated word.

WHY THIS EXISTS
  promptInjectionDetector.ts:71 shipped this:

    (?:professional|doctor|...|icu|patient).{0,180}(?:die|lives depend|...)

  No \\b anywhere. On the benign cross-distribution corpus it matched:

    "particularly high average against the West Indies"
      -> `icu` inside partICUlarly, `die` inside InDIEs
    "the Tampa Bay Rowdies ... professional soccer team"
      -> `die` inside RowDIEs

  The rule declares HIGH/40 and reaches a BLOCK floor, so a cricket question got
  hard-blocked. Code review did not catch it and will not catch the next one: the
  pattern looks correct unless you specifically think about substring matching.

  So it becomes a gate. A short literal inside an alternation is only safe if it
  is boundary-anchored; anything else is a latent false positive waiting for the
  right benign sentence.

USAGE
  python scripts/ml/lint-detector-boundaries.py
  python scripts/ml/lint-detector-boundaries.py --max-len 7   # stricter

EXIT CODES
  0 clean, 1 violations found, 2 could not run
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# Literals at or below this length are the dangerous ones: `icu`, `die`, `ied`,
# `dan`, `vm`. Longer literals can still collide but the risk falls off sharply
# and the false-alarm rate of this lint would make it unusable.
DEFAULT_MAX_LEN = 5

# Words that are safe as substrings because they are not real English fragments,
# or are already unambiguous. Keep this list SHORT and justified — every entry is
# a permanent hole in the gate.
# Grammatical connectors. These appear in almost every rule as GLUE between the
# parts that carry the actual evidence ("dump (?:the|a|my) (?:database)"). They are
# short and unanchored, but they are not what makes a rule fire — the constrained
# tokens around them are. Flagging them produced 1,898 findings on first run,
# which is a lint nobody will read, and an ignored gate is not a gate.
#
# The failure this lint exists to catch is a CONTENT token — one carrying the
# rule's discriminating signal — matching inside an unrelated word.
CONNECTORS = {
    "a", "an", "the", "this", "that", "these", "those", "it", "its",
    "my", "me", "our", "us", "your", "you", "their", "them", "his", "her",
    "of", "in", "at", "on", "by", "to", "for", "from", "with", "per", "as",
    "is", "are", "was", "were", "be", "been", "am", "do", "does", "did",
    "has", "have", "had", "can", "could", "may", "might", "will", "would",
    "shall", "should", "must", "if", "or", "and", "not", "no", "any", "all",
    "each", "every", "some", "one", "two", "o", "s", "q", "b", "a\\s+friend",
    "0", "1", "2", "zero", "null", "none", "false", "true", "else",
}

ALLOWLIST = {
    "http", "www", "src", "eval", "\\n",
}

# Only lint the alternation groups, not whole patterns: `.{0,180}` and character
# classes are not the failure mode.
ALTERNATION = re.compile(r"\(\?:([^()]{2,400}?)\)")


def literals_in_group(group: str) -> list[str]:
    """Split an alternation body into its plain-literal alternatives.

    Alternatives containing regex metacharacters are skipped: `\\d+`, `[a-z]{2}`
    and friends are not substring hazards in the same way, and reasoning about
    them here would produce noise instead of findings.
    """
    out = []
    for alt in group.split("|"):
        alt = alt.strip()
        if not alt or len(alt) > 40:
            continue
        # Skip anything with metacharacters, including an already-present \b.
        if re.search(r"[\\\[\]{}()*+?^$.]", alt):
            continue
        if alt.lower() in ALLOWLIST or alt.lower() in CONNECTORS:
            continue
        # ASCII-only. Devanagari/CJK have no \b semantics in JS regex, so the
        # word-boundary advice would be wrong for them; they need a different fix.
        if not alt.isascii():
            continue
        out.append(alt)
    return out


def group_is_anchored(pattern: str, start: int, end: int) -> bool:
    """True when the group is boundary-anchored just outside its parentheses.

    Covers the two idiomatic safe forms: `\\b(?:a|b)\\b` and `(?:^|\\s)(?:a|b)`.
    An anchor on only ONE side still lets the other side match mid-word, so both
    sides are required.
    """
    before = pattern[max(0, start - 12) : start]
    after = pattern[end : end + 12]
    left_ok = before.endswith("\\b") or before.endswith("(?:^|\\s)") or before.endswith("\\s")
    right_ok = after.startswith("\\b") or after.startswith("\\s") or after.startswith("(?=")
    return left_ok and right_ok


def safe(s: str) -> str:
    """Windows consoles default to cp1252, and these patterns contain Devanagari.

    A lint that crashes on the text it is linting is worse than no lint, so
    unencodable characters are replaced rather than raised on.
    """
    enc = sys.stdout.encoding or "utf-8"
    return s.encode(enc, errors="replace").decode(enc, errors="replace")


def load_benign_vocab(path: Path) -> set[str]:
    """Every distinct word in the benign corpus.

    WHY MEASURE INSTEAD OF GUESS
      The first version of this lint ranked literals by length and reported 1,461
      violations — unreadable, so it would have been ignored. Length is a proxy
      for the real question, which is empirical: does this literal actually occur
      inside a real word that real users type?

      `icu` does (partICUlarly). `die` does (InDIEs, RowDIEs). `tatp` does not.
      The benign corpus answers that directly, so the lint reports only collisions
      it can demonstrate, each with the word that proves it.
    """
    if not path.exists():
        return set()
    vocab: set[str] = set()
    with path.open(encoding="utf-8") as f:
        for line in f:
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if row.get("label") != "SAFE":
                continue
            vocab.update(w for w in re.findall(r"[a-z]{2,}", str(row.get("text", "")).lower()))
    return vocab


def collisions(literal: str, vocab: set[str], limit: int = 3) -> list[str]:
    """Benign words where this literal appears as an INFIX — not as a prefix.

    THE DISCRIMINATOR
      Proving a substring collision still reported 1,218 groups, because most are
      harmless morphology: 'poem' inside 'poems', 'dump' inside 'dumped', 'data'
      inside 'datasets'. The literal is a PREFIX there, the stem is the same word,
      and the rule's intent survives the match.

      The real defect looks different — the literal lands in the MIDDLE of a word
      that means something else entirely:

        'icu' inside agrICUlture, connectICUt
        'die' inside auDIEnces, meloDIEs
        'log' inside anaLOGy, mycoLOGy
        'etc' inside streETCar

      Same mechanism, opposite consequence. Requiring an infix separates the two
      and is what makes this lint's output small enough to act on.
    """
    lit = literal.lower()
    if not lit.isalpha():
        return []
    found = []
    for word in vocab:
        if word == lit or lit not in word:
            continue
        if word.startswith(lit):
            continue  # inflection, not a collision
        found.append(word)
        if len(found) >= limit:
            break
    return found


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", default="lib/guard/detectors")
    ap.add_argument("--max-len", type=int, default=DEFAULT_MAX_LEN)
    ap.add_argument(
        "--corpus",
        default="datasets/crossdist-eval-v2.jsonl",
        help="benign corpus used to PROVE a collision is real",
    )
    ap.add_argument("--show", type=int, default=40, help="how many findings to print")
    ap.add_argument(
        "--baseline",
        type=int,
        default=None,
        help="allow up to N known violations (for staged adoption); fails if the count RISES",
    )
    args = ap.parse_args()

    root = Path(args.dir)
    if not root.exists():
        print(f"[ERROR] {root} not found (run from repo root)", file=sys.stderr)
        return 2

    vocab = load_benign_vocab(Path(args.corpus))
    if not vocab:
        print(f"[ERROR] no benign vocabulary from {args.corpus}.", file=sys.stderr)
        print("        This lint proves collisions against real text; without a", file=sys.stderr)
        print("        corpus it would be guessing. Build the eval set first.", file=sys.stderr)
        return 2
    print(f"[corpus] {len(vocab)} distinct benign words from {args.corpus}")

    # (path, line, group, [(literal, [colliding words])])
    violations: list[tuple[str, int, str, list[tuple[str, list[str]]]]] = []
    files = sorted(root.rglob("*.ts"))

    for path in files:
        text = path.read_text(encoding="utf-8", errors="replace")
        for m in ALTERNATION.finditer(text):
            body = m.group(1)
            if "|" not in body:
                continue
            if group_is_anchored(text, m.start(), m.end()):
                continue
            proven: list[tuple[str, list[str]]] = []
            for lit in literals_in_group(body):
                if len(lit) > args.max_len:
                    continue
                hits = collisions(lit, vocab)
                if hits:
                    proven.append((lit, hits))
            if not proven:
                continue
            line = text.count("\n", 0, m.start()) + 1
            violations.append((str(path).replace("\\", "/"), line, body[:60], proven))

    if not violations:
        print(f"[OK] scanned {len(files)} detector files, 0 PROVEN substring collisions")
        return 0

    total_lits = sum(len(v[3]) for v in violations)
    print(f"\n[FAIL] {len(violations)} unanchored group(s), {total_lits} proven collision(s)\n")

    # Rank by how many benign words each group can collide with: that is blast
    # radius measured, not estimated.
    ranked = sorted(violations, key=lambda v: -len(v[3]))

    for path, line, body, proven in ranked[: args.show]:
        print(f"  {path}:{line}")
        print(safe(f"    group   (?:{body}...)"))
        for lit, hits in proven[:4]:
            print(safe(f"    '{lit}' matches inside: {', '.join(hits)}"))
        print()

    if len(ranked) > args.show:
        print(f"  ... and {len(ranked) - args.show} more (--show N for all)\n")

    print(
        "Each literal above was PROVEN to occur inside an ordinary benign word.\n"
        "Fix by anchoring the group:  \\b(?:doctor|nurse|icu)\\b\n"
        "or drop the literal if it carries no signal alone.\n"
    )

    if args.baseline is not None and len(violations) <= args.baseline:
        print(f"[BASELINE] {len(violations)} <= allowed {args.baseline}; not failing the build.")
        print("Lower --baseline as these are fixed so the count can never rise again.")
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
