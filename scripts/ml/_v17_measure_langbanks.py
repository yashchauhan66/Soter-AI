#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""Measure the v17 language banks under BOTH encoders, on the REAL authored text.

WHY THIS EXISTS AND WHY THE EARLIER PROBE WAS NOT ENOUGH
    The encoder-swap decision was made on a 40-language PARALLEL PROBE: one short
    sentence per language, translated. That is the right instrument for "can this
    tokenizer see this script at all", and it answered clearly (Telugu 8/9 tokens
    UNK on the shipped encoder, 0/35 on the candidate).

    It is the WRONG instrument for "are the rows we are about to train on usable".
    The probe sentence is one sentence; the banks are 744 authored strings with
    security jargon, Latin-script product names embedded in non-Latin text
    ("React", "OWASP Top 10", "SEC-4471", "system prompt"), ticket IDs, and
    punctuation. Any of those can tokenize very differently from a clean probe
    sentence -- mixed-script runs are exactly where WordPiece fertility explodes.

    So this measures the text that will actually be trained on. Numbers printed
    here are the only ones that should be quoted about the v17 corpus.

WHAT IT REPORTS, PER LANGUAGE AND PER ENCODER
    tokens/str   mean WordPiece pieces per authored string (fertility, absolute)
    chars/token  mean characters per piece -- the scale-free fertility measure;
                 higher is better, ~4+ is healthy, ~1 means char-level shredding
    unk%         share of pieces that are [UNK]; every one is information DELETED
                 before the model ever sees it
    trunc@128    share of strings that would be CUT at the 128-token max_length
                 the production loader uses. This is the failure mode the parallel
                 probe structurally cannot show, because a probe sentence is short
                 and these rows are not: a row whose attack payload sits past
                 token 128 is a MISLABELLED row, and it teaches the wrong thing.

Run:
    PYTHONIOENCODING=utf-8 python scripts/ml/_v17_measure_langbanks.py
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

CURRENT = "sentence-transformers/all-MiniLM-L6-v2"   # shipped v14/v15/v16
CANDIDATE = "distilbert-base-multilingual-cased"      # v17 candidate
MAX_LEN = 128

BANK_KEYS = ("pretexts", "pressures", "openers", "asks", "secedu")


def collect() -> dict[str, list[str]]:
    """All authored strings per language, from both bank modules."""
    import _v17_langbanks_a as A
    import _v17_langbanks_b as B

    A.sanity()
    B.sanity()

    out: dict[str, list[str]] = {}
    for mod in (A, B):
        for lang, banks in mod.GENERIC.items():
            rows: list[str] = []
            for k in BANK_KEYS:
                rows.extend(banks[k])
            out[lang] = rows
    return out


def meta() -> dict[str, dict[str, str]]:
    import _v17_langbanks_a as A
    import _v17_langbanks_b as B
    m = {}
    m.update(A.LANG_META)
    m.update(B.LANG_META)
    return m


def measure(tok, rows: list[str]) -> dict[str, float]:
    total_tok = 0
    total_chars = 0
    total_unk = 0
    trunc = 0
    unk_id = tok.unk_token_id
    for r in rows:
        # add_special_tokens=False: [CLS]/[SEP] are constant overhead and would
        # flatter the fertility of short strings. Truncation is measured against
        # the real budget below, which DOES include the two specials.
        ids = tok(r, add_special_tokens=False, truncation=False)["input_ids"]
        total_tok += len(ids)
        total_chars += len(r)
        total_unk += sum(1 for i in ids if i == unk_id)
        if len(ids) + 2 > MAX_LEN:
            trunc += 1
    n = max(len(rows), 1)
    return {
        "tok_per_str": total_tok / n,
        "chars_per_token": (total_chars / total_tok) if total_tok else 0.0,
        "unk_pct": 100.0 * total_unk / total_tok if total_tok else 0.0,
        "trunc_pct": 100.0 * trunc / n,
        "n": n,
    }


def main() -> int:
    try:
        from transformers import AutoTokenizer
    except ImportError:
        print("transformers not installed; cannot measure", file=sys.stderr)
        return 2

    banks = collect()
    langmeta = meta()

    print(f"Loading tokenizers (local cache only)...")
    kw = dict(local_files_only=True)
    tok_cur = AutoTokenizer.from_pretrained(CURRENT, **kw)
    tok_new = AutoTokenizer.from_pretrained(CANDIDATE, **kw)
    print(f"  current   {CURRENT}  vocab {tok_cur.vocab_size}  lower={getattr(tok_cur, 'do_lower_case', '?')}")
    print(f"  candidate {CANDIDATE}  vocab {tok_new.vocab_size}  lower={getattr(tok_new, 'do_lower_case', '?')}")
    print()

    hdr = (
        f"{'lang':<5}{'script':<11}{'n':>4} | "
        f"{'cur tok':>8}{'cur c/t':>9}{'cur unk%':>10}{'cur >128':>9} | "
        f"{'new tok':>8}{'new c/t':>9}{'new unk%':>10}{'new >128':>9}"
    )
    print(hdr)
    print("-" * len(hdr))

    rows_out = []
    for lang in sorted(banks):
        rows = banks[lang]
        c = measure(tok_cur, rows)
        n = measure(tok_new, rows)
        rows_out.append((lang, c, n))
        script = langmeta.get(lang, {}).get("script", "?")
        print(
            f"{lang:<5}{script:<11}{c['n']:>4} | "
            f"{c['tok_per_str']:>8.1f}{c['chars_per_token']:>9.2f}{c['unk_pct']:>10.2f}{c['trunc_pct']:>9.1f} | "
            f"{n['tok_per_str']:>8.1f}{n['chars_per_token']:>9.2f}{n['unk_pct']:>10.2f}{n['trunc_pct']:>9.1f}"
        )

    # ── aggregate verdicts ────────────────────────────────────────────────────
    print()
    broken_cur = [l for l, c, _ in rows_out if c["unk_pct"] >= 5.0]
    broken_new = [l for l, _, n in rows_out if n["unk_pct"] >= 5.0]
    print(f"languages with >=5% UNK on the SHIPPED encoder   : {len(broken_cur)}/{len(rows_out)}"
          + (f"  {' '.join(broken_cur)}" if broken_cur else ""))
    print(f"languages with >=5% UNK on the v17 CANDIDATE     : {len(broken_new)}/{len(rows_out)}"
          + (f"  {' '.join(broken_new)}" if broken_new else ""))

    trunc_new = [(l, n["trunc_pct"]) for l, _, n in rows_out if n["trunc_pct"] > 0]
    if trunc_new:
        print(f"\nTRUNCATION RISK at max_length={MAX_LEN} on the candidate "
              f"(bare strings, before any pretext+core+pressure concatenation):")
        for l, p in sorted(trunc_new, key=lambda x: -x[1]):
            print(f"  {l}: {p:.1f}% of authored strings already exceed the budget")
        print("  NOTE these are SINGLE bank strings. The builder concatenates")
        print("  pretext + core + pressure, so the real row is ~3x longer. Budget")
        print("  headroom must be checked on BUILT rows, not here.")
    else:
        print(f"\nNo single authored string exceeds max_length={MAX_LEN} on the candidate.")

    worst = sorted(rows_out, key=lambda x: x[2]["chars_per_token"])[:5]
    print("\nLowest chars/token on the candidate (highest fertility = most budget burned):")
    for l, _, n in worst:
        print(f"  {l}: {n['chars_per_token']:.2f} chars/token, {n['tok_per_str']:.1f} tokens/string")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
