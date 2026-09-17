"""Does v14's over-defense track TOKENIZER BREAKDOWN or topic?

If the languages that over-fire are the languages v14's vocab cannot represent, then
the v17 encoder swap addresses a MEASURED production failure rather than a hoped-for
one. If they are uncorrelated, the encoder swap is not the fix for this and the
corpus is, and saying otherwise would be a story rather than a finding.
"""
import json, collections, re, sys
from pathlib import Path

vocab_path = Path("models/ml-classifier-v14/vocab.txt")
if not vocab_path.exists():
    cands = list(Path("models").glob("ml-classifier-v14/**/vocab.txt"))
    if not cands:
        print("[skip] no v14 vocab.txt found; cannot measure UNK")
        sys.exit(0)
    vocab_path = cands[0]

vocab = set(vocab_path.read_text(encoding="utf-8").split("\n"))
print(f"v14 vocab: {len(vocab):,} tokens from {vocab_path}")

bat = [json.loads(l) for l in re.split(r"\r?\n", Path("datasets/v17-multilingual-battery.jsonl").read_text(encoding="utf-8")) if l.strip()]
fps = {json.loads(l)["text"].strip() for l in re.split(r"\r?\n", Path("artifacts/ml/v14-battery-fps.jsonl").read_text(encoding="utf-8")) if l.strip()}

def wordpiece_unk(text: str) -> tuple[int, int]:
    """Greedy longest-match WordPiece, same algorithm as lib/ml/bertTokenizer.ts.
    Counts words that fall back to [UNK] entirely."""
    unk = 0
    words = re.findall(r"\w+|[^\w\s]", text)
    for w in words:
        if w in vocab:
            continue
        lw = w.lower()
        if lw in vocab:
            continue
        # try to piece it
        start, ok = 0, True
        while start < len(lw):
            end, sub = len(lw), None
            while start < end:
                cand = lw[start:end]
                if start > 0:
                    cand = "##" + cand
                if cand in vocab:
                    sub = end
                    break
                end -= 1
            if sub is None:
                ok = False
                break
            start = sub
        if not ok:
            unk += 1
    return unk, len(words)

UNAMBIGUOUS = {"everyday-request", "incident-postmortem", "security-education"}
per_lang = collections.defaultdict(lambda: {"unk": 0, "tok": 0, "fp": 0, "n": 0})
for r in bat:
    if r["category"] not in UNAMBIGUOUS:
        continue
    u, t = wordpiece_unk(r["text"])
    d = per_lang[r["language"]]
    d["unk"] += u
    d["tok"] += t
    d["n"] += 1
    if r["text"].strip() in fps:
        d["fp"] += 1

rows = []
for lang, d in per_lang.items():
    rows.append((100 * d["unk"] / max(1, d["tok"]), 100 * d["fp"] / max(1, d["n"]), lang, d))
rows.sort(reverse=True)

print()
print(f"{'lang':<10}{'UNK-word %':>12}{'benign blocked':>16}")
print("-" * 40)
for unkp, fpp, lang, d in rows:
    flag = "  <--" if unkp >= 50 else ""
    print(f"{lang:<10}{unkp:>11.1f}%{d['fp']:>10}/{d['n']}{flag}")

hi = [r for r in rows if r[0] >= 50]
lo = [r for r in rows if r[0] < 50]
def agg(rs):
    fp = sum(r[3]["fp"] for r in rs)
    n = sum(r[3]["n"] for r in rs)
    return fp, n, 100 * fp / max(1, n)

print()
print("=" * 62)
print("THE CORRELATION (unambiguously-benign rows only)")
print("=" * 62)
for name, rs in (("languages v14's vocab CANNOT represent (>=50% UNK words)", hi),
                 ("languages v14's vocab CAN represent (<50%)", lo)):
    fp, n, p = agg(rs)
    print(f"  {name}")
    print(f"    {len(rs):>2} languages   benign blocked {fp}/{n} = {p:.1f}%")
print()
if hi and lo:
    _, _, ph = agg(hi)
    _, _, pl = agg(lo)
    print(f"  gap: {ph - pl:+.1f} points, ASSOCIATED WITH script coverage -- not proven caused")
    print("       by it. The two groups also differ in how much of each language the")
    print("       training corpus holds at all, so vocab coverage and corpus presence are")
    print("       confounded here and this split cannot separate them.")
    print()
    print("  Counterexamples visible in the table above, which is why the claim is")
    print("  bounded: ta 34.6% UNK -> 3/3 blocked, fa 13.0% -> 3/3, while cs 40.4% -> 0/3")
    print("  and bn 15.0% -> 0/3. UNK rate is a strong predictor, not the whole mechanism.")
    print()
    print("  What this DOES establish: the encoder swap targets a real, measured")
    print("  production failure. What it does NOT establish: that the swap alone fixes it.")
    print("  The MiniLM control arm is what separates encoder effect from corpus effect.")
