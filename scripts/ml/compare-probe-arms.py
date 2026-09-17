#!/usr/bin/env python3
r"""Compare two score-battery.ts arms on the SAME probe battery, row by row.

WHY THIS EXISTS
    "v16 scores 94%" is not evidence that v16 fixed anything. On a 70-row battery
    (56 attacks / 14 benign) a model can gain three attacks and lose three others
    and land on the same headline. What matters is the PAIRED movement: which
    specific rows flipped, in which direction, in which label and language cell.

    v16's increment was written against a measurement -- v15's per-label and
    per-language failures on datasets/v16-probe-battery.jsonl. This script checks
    each of those targeted cells individually and, critically, reports REGRESSIONS
    with the same prominence as fixes. A retrain that trades ja for ru is not a
    win; without a paired view it looks like one.

    Every number here is printed as x/y. The denominators are small by design --
    this is a diagnostic instrument, never a headline metric, and it must be
    impossible to quote a percentage off it without the count beside it.

USAGE
    # after running score-battery.ts twice with .env pointed at each model
    python scripts/ml/compare-probe-arms.py \
        --a artifacts/ml/v16-probe-v15.json --a-name v15 \
        --b artifacts/ml/v16-probe-v16.json --b-name v16
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def ascii_safe(value: str) -> str:
    """Windows consoles are cp1252 and this report prints Cyrillic/CJK/Arabic
    rows by design. Without this the report crashes on the first ru miss --
    which is exactly the row you opened it to read."""
    return repr(value).encode("ascii", "backslashreplace").decode("ascii")


def read_jsonl(path: Path) -> list[dict]:
    """re.split(r"\r?\n"), not splitlines(): splitlines also breaks on U+2028,
    U+2029, U+0085 and \x0b-\x1e -- the exact characters the Unicode-smuggling
    probe rows contain."""
    if not path.exists():
        return []
    out = []
    for line in re.split(r"\r?\n", path.read_text(encoding="utf-8")):
        line = line.strip()
        if line:
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return out


def sidecar(arm_path: Path, kind: str) -> list[dict]:
    """score-battery.ts writes <out>-misses.jsonl and <out>-fps.jsonl beside its
    JSON. They carry the actual rows, which is what makes a row-level diff
    possible at all."""
    return read_jsonl(arm_path.with_name(arm_path.stem + f"-{kind}.jsonl"))


def cell(d: dict, key: str) -> tuple[int, int] | None:
    """(numerator, denominator) for an attack cell, or None if the cell is benign
    or absent."""
    c = d.get(key)
    if not isinstance(c, dict) or "attacks" not in c:
        return None
    return int(c.get("caught", 0)), int(c.get("attacks", 0))


def fp_cell(d: dict, key: str) -> tuple[int, int] | None:
    c = d.get(key)
    if not isinstance(c, dict) or "benign" not in c:
        return None
    return int(c.get("fp", 0)), int(c.get("benign", 0))


def bar(delta: int) -> str:
    if delta > 0:
        return f"  FIXED +{delta}"
    if delta < 0:
        return f"  REGRESSED {delta}"
    return ""


def section(title: str) -> None:
    print("\n" + "=" * 78)
    print(title)
    print("=" * 78)


def compare_group(a: dict, b: dict, group: str, a_name: str, b_name: str,
                  targets: set[str]) -> list[str]:
    """Print one grouping (byLabel / byLanguage / byCategory). Returns regressions."""
    ga, gb = a.get(group, {}), b.get(group, {})
    keys = sorted(set(ga) | set(gb))
    regressions: list[str] = []

    print(f"\n{group}  --  attack recall (caught/attacks)")
    print(f"  {'cell':<32}{a_name:>12}{b_name:>12}{'delta':>10}")
    for k in keys:
        ca, cb = cell(ga, k), cell(gb, k)
        if ca is None and cb is None:
            continue
        ca = ca or (0, 0)
        cb = cb or (0, 0)
        if cb[1] != ca[1] and ca[1] and cb[1]:
            print(f"  [!] {k}: denominators differ ({ca[1]} vs {cb[1]}) -- not the same rows")
        d = cb[0] - ca[0]
        mark = bar(d)
        star = " *" if k in targets else "  "
        print(f" {star}{k:<32}{f'{ca[0]}/{ca[1]}':>12}{f'{cb[0]}/{cb[1]}':>12}{d:>+10}{mark}")
        if d < 0:
            regressions.append(f"{group}/{k}: {ca[0]}/{ca[1]} -> {cb[0]}/{cb[1]}")

    print(f"\n{group}  --  benign false positives (fp/benign)")
    printed = False
    for k in keys:
        fa, fb = fp_cell(ga, k), fp_cell(gb, k)
        if fa is None and fb is None:
            continue
        fa = fa or (0, 0)
        fb = fb or (0, 0)
        if fa[0] == 0 and fb[0] == 0:
            continue
        printed = True
        d = fb[0] - fa[0]
        mark = "  FIXED" if d < 0 else ("  NEW FP" if d > 0 else "")
        print(f"   {k:<32}{f'{fa[0]}/{fa[1]}':>12}{f'{fb[0]}/{fb[1]}':>12}{d:>+10}{mark}")
        if d > 0:
            regressions.append(f"{group}/{k} FPs: {fa[0]}/{fa[1]} -> {fb[0]}/{fb[1]}")
    if not printed:
        print("   (no false positives in either arm)")
    return regressions


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--a", default="artifacts/ml/v16-probe-v15.json", help="baseline arm JSON")
    ap.add_argument("--b", default="artifacts/ml/v16-probe-v16.json", help="candidate arm JSON")
    ap.add_argument("--a-name", default="v15")
    ap.add_argument("--b-name", default="v16")
    ap.add_argument("--out", default="artifacts/ml/v16-probe-delta.json")
    args = ap.parse_args()

    pa, pb = ROOT / args.a, ROOT / args.b
    for p, which in ((pa, "--a"), (pb, "--b")):
        if not p.exists():
            print(f"[FATAL] {which} not found: {p}")
            print("        Run score-battery.ts for that arm first, with .env's ML_ONNX_*")
            print("        pointed at the model you want to measure.")
            return 2
    a, b = json.loads(pa.read_text(encoding="utf-8")), json.loads(pb.read_text(encoding="utf-8"))

    if a.get("file") != b.get("file"):
        print(f"[FATAL] the two arms scored DIFFERENT files:\n"
              f"        {args.a_name}: {a.get('file')}\n"
              f"        {args.b_name}: {b.get('file')}\n"
              "        A paired comparison across different row sets is meaningless.")
        return 2
    if a.get("rows") != b.get("rows"):
        print(f"[FATAL] row counts differ ({a.get('rows')} vs {b.get('rows')}); not paired.")
        return 2

    oa, ob = a["overall"], b["overall"]
    section(f"PROBE BATTERY  {a.get('file')}   ({a.get('rows')} rows)")
    # Built as plain strings first: nested same-type quotes inside f-strings only
    # parse on 3.12+, and this file has to stay readable on whatever runs it.
    rec_a = "{}/{}".format(oa["caught"], oa["attacks"])
    rec_b = "{}/{}".format(ob["caught"], ob["attacks"])
    fps_a = "{}/{}".format(oa["fp"], oa["benign"])
    fps_b = "{}/{}".format(ob["fp"], ob["benign"])
    print(f"{'':<22}{args.a_name:>14}{args.b_name:>14}{'delta':>12}")
    print(f"{'attack recall':<22}{rec_a:>14}{rec_b:>14}{ob['caught'] - oa['caught']:>+12}")
    print(f"{'':<22}{str(oa['recall']) + '%':>14}{str(ob['recall']) + '%':>14}"
          f"{round(ob['recall'] - oa['recall'], 2):>+12}")
    print(f"{'benign FPs':<22}{fps_a:>14}{fps_b:>14}{ob['fp'] - oa['fp']:>+12}")
    print(f"{'':<22}{str(oa['fpr']) + '%':>14}{str(ob['fpr']) + '%':>14}"
          f"{round(ob['fpr'] - oa['fpr'], 2):>+12}")

    ra, rb = a.get("rulesOnly", {}), b.get("rulesOnly", {})
    if ra and rb:
        print("\nrules-only arm (should be identical in both -- the rules tier is not retrained):")
        print(f"  {args.a_name} recall {ra.get('recall')}% / FPR {ra.get('fpr')}%   "
              f"{args.b_name} recall {rb.get('recall')}% / FPR {rb.get('fpr')}%")
        if ra.get("recall") != rb.get("recall"):
            print("  [!] rules-only recall MOVED. The rules tier was edited between the two")
            print("      runs, so this is no longer a clean model-vs-model comparison.")

    # The cells v16's increment was explicitly built to move. Starred in the
    # tables and re-checked individually below so a miss cannot hide in a list.
    TARGET_LABELS = {"MULTI_TURN_ESCALATION", "DATA_EXFILTRATION_ATTEMPT",
                     "TOOL_CALL_ABUSE", "JAILBREAK"}
    TARGET_LANGS = {"ja", "ru", "hinglish", "hi", "zh", "ar", "es"}

    section("TARGETED CELLS  (* = a cell the v16 increment was written against)")
    regressions: list[str] = []
    regressions += compare_group(a, b, "byLabel", args.a_name, args.b_name, TARGET_LABELS)
    regressions += compare_group(a, b, "byLanguage", args.a_name, args.b_name, TARGET_LANGS)

    # ── row-level diff ────────────────────────────────────────────────────────
    miss_a = {r.get("text", ""): r for r in sidecar(pa, "misses")}
    miss_b = {r.get("text", ""): r for r in sidecar(pb, "misses")}
    fp_a = {r.get("text", ""): r for r in sidecar(pa, "fps")}
    fp_b = {r.get("text", ""): r for r in sidecar(pb, "fps")}

    if miss_a or miss_b:
        section("ROW-LEVEL DIFF  (from the -misses.jsonl / -fps.jsonl sidecars)")

        fixed = [r for t, r in miss_a.items() if t not in miss_b]
        broke = [r for t, r in miss_b.items() if t not in miss_a]
        still = [r for t, r in miss_a.items() if t in miss_b]

        print(f"\nattacks {args.a_name} MISSED that {args.b_name} now catches: {len(fixed)}")
        for r in fixed:
            print(f"  + [{r.get('label','?')}/{r.get('language','?')}] "
                  f"{ascii_safe(r.get('text', '')[:96])}")

        print(f"\nattacks {args.b_name} MISSES that {args.a_name} caught: {len(broke)}"
              + ("   <-- REGRESSION" if broke else ""))
        for r in broke:
            print(f"  - [{r.get('label','?')}/{r.get('language','?')}] "
                  f"{ascii_safe(r.get('text', '')[:96])}")

        print(f"\nattacks BOTH miss (still open): {len(still)}")
        for r in still:
            print(f"    [{r.get('label','?')}/{r.get('language','?')}] "
                  f"{ascii_safe(r.get('text', '')[:96])}")

        fp_fixed = [r for t, r in fp_a.items() if t not in fp_b]
        fp_new = [r for t, r in fp_b.items() if t not in fp_a]
        fp_still = [r for t, r in fp_a.items() if t in fp_b]
        print(f"\nbenign rows {args.a_name} blocked that {args.b_name} allows: {len(fp_fixed)}")
        for r in fp_fixed:
            print(f"  + [{r.get('category','?')}/{r.get('language','?')}] "
                  f"{ascii_safe(r.get('text', '')[:96])}")
        print(f"\nbenign rows {args.b_name} blocks that {args.a_name} allowed: {len(fp_new)}"
              + ("   <-- NEW OVER-DEFENSE" if fp_new else ""))
        for r in fp_new:
            print(f"  - [{r.get('category','?')}/{r.get('language','?')}] "
                  f"{ascii_safe(r.get('text', '')[:96])}")
        if fp_still:
            print(f"\nbenign rows BOTH block (still over-defended): {len(fp_still)}")
            for r in fp_still:
                print(f"    [{r.get('category','?')}/{r.get('language','?')}] "
                      f"{ascii_safe(r.get('text', '')[:96])}")

        # McNemar's exact test on the paired attack rows. b = a-caught/b-missed,
        # c = a-missed/b-caught. With counts this small the exact binomial is the
        # only honest option -- the chi-square approximation is invalid below ~25.
        nb, nc = len(broke), len(fixed)
        if nb + nc:
            from math import comb
            n = nb + nc
            k = min(nb, nc)
            p = sum(comb(n, i) for i in range(0, k + 1)) / (2 ** n) * 2
            p = min(1.0, p)
            print(f"\nMcNemar exact (attacks): b={nb} ({args.b_name} lost), "
                  f"c={nc} ({args.b_name} gained), p={p:.4f}")
            if p > 0.05:
                print(f"  p > 0.05: the attack-side movement is NOT distinguishable from")
                print(f"  chance on {n} discordant rows. Do not report it as an improvement.")
            elif nc > nb:
                print(f"  p <= 0.05 and {args.b_name} gained more than it lost: a real move.")
            else:
                print(f"  p <= 0.05 and {args.b_name} LOST more than it gained: a real REGRESSION.")
        else:
            print("\nMcNemar: 0 discordant attack rows -- the two arms catch exactly the "
                  "same attacks. Whatever else changed, it did not change this battery.")
    else:
        print("\n[warn] no -misses.jsonl sidecars found beside the arm JSONs, so the")
        print("       row-level diff and McNemar test are unavailable. Only the cell")
        print("       tables above are usable.")

    section("VERDICT")
    if regressions:
        print(f"{len(regressions)} cell-level regression(s) -- these are NOT acceptable")
        print("collateral just because the headline moved:")
        for r in regressions:
            print(f"  - {r}")
    else:
        print("No cell-level regression in any label or language cell.")
    print(f"\nEvery figure above is x/y on a {a.get('rows')}-row battery "
          f"({oa['attacks']} attacks / {oa['benign']} benign). This is a DIAGNOSTIC")
    print("that says whether the targeted cells moved. It is not a deploy metric and")
    print("must never be quoted without its denominator. The deploy gate is the")
    print("crossdist McNemar plus the 5.6% ordinary-traffic FPR ceiling.")

    out = ROOT / args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({
        "a": {"name": args.a_name, "file": args.a, "overall": oa},
        "b": {"name": args.b_name, "file": args.b, "overall": ob},
        "regressions": regressions,
        "attacks_fixed": len([1 for t in miss_a if t not in miss_b]),
        "attacks_broken": len([1 for t in miss_b if t not in miss_a]),
        "fps_fixed": len([1 for t in fp_a if t not in fp_b]),
        "fps_new": len([1 for t in fp_b if t not in fp_a]),
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[write] {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
