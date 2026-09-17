import json, collections, re
from pathlib import Path

bat = {}
for l in re.split(r"\r?\n", Path("datasets/v17-multilingual-battery.jsonl").read_text(encoding="utf-8")):
    if l.strip():
        r = json.loads(l)
        bat[r["text"].strip()] = r

fps = {r["text"].strip() for r in (json.loads(l) for l in re.split(r"\r?\n", Path("artifacts/ml/v14-battery-fps.jsonl").read_text(encoding="utf-8")) if l.strip())}
fpml = {}
for l in re.split(r"\r?\n", Path("artifacts/ml/v14-battery-fps.jsonl").read_text(encoding="utf-8")):
    if l.strip():
        r = json.loads(l)
        fpml[r["text"].strip()] = bool(r.get("fromMl"))

UNAMBIGUOUS = ["everyday-request", "incident-postmortem", "security-education"]
ARGUABLE = ["legitimate-tool-use"]

print("=" * 74)
print("BENIGN ROWS, SPLIT BY WHETHER THE LABEL SURVIVES SCRUTINY")
print("=" * 74)
for group, cats in (("UNAMBIGUOUSLY BENIGN", UNAMBIGUOUS), ("ARGUABLE LABEL", ARGUABLE)):
    rows = [r for r in bat.values() if r["category"] in cats]
    blocked = [r for r in rows if r["text"].strip() in fps]
    ml = sum(1 for r in blocked if fpml[r["text"].strip()])
    print(f"\n{group}: {len(rows)} rows")
    print(f"  blocked: {len(blocked)}/{len(rows)} = {100*len(blocked)/len(rows):.1f}% FPR"
          f"   (ML tier {ml}, rules tier {len(blocked)-ml})")

print()
print("=" * 74)
print("ENGLISH vs NON-ENGLISH  (unambiguous categories only)")
print("=" * 74)
for scope, test in (("English", lambda L: L == "en"), ("non-English", lambda L: L != "en")):
    rows = [r for r in bat.values() if r["category"] in UNAMBIGUOUS and test(r["language"])]
    blocked = [r for r in rows if r["text"].strip() in fps]
    print(f"  {scope:<14} {len(blocked):>3}/{len(rows):<4} = {100*len(blocked)/len(rows):5.1f}% FPR")

rows = [r for r in bat.values() if r["category"] in UNAMBIGUOUS and r["language"] == "en"]
print("\n  English benign rows, individually:")
for r in rows:
    mark = "BLOCKED" if r["text"].strip() in fps else "allowed"
    src = ""
    if r["text"].strip() in fps:
        src = " (ML)" if fpml[r["text"].strip()] else " (rules)"
    print(f"    {mark:<8}{src:<9}{r['category']:<22}{r['text'][:56]}")

print()
print("=" * 74)
print("PER-CATEGORY, UNAMBIGUOUS ONLY -- which benign shape breaks, and in which tier")
print("=" * 74)
for c in UNAMBIGUOUS:
    rows = [r for r in bat.values() if r["category"] == c]
    blocked = [r for r in rows if r["text"].strip() in fps]
    ml = sum(1 for r in blocked if fpml[r["text"].strip()])
    langs = sorted(r["language"] for r in blocked)
    print(f"\n  {c}: {len(blocked)}/39 blocked (ML {ml} / rules {len(blocked)-ml})")
    print(f"    {' '.join(langs)}")
