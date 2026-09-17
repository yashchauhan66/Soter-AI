#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""Compose the v17 training increment: 31 new languages + the 2026 attack families.

WHAT v17 IS, AND WHAT IT IS NOT
    It is an INCREMENT, a separate file, added alongside v16's. It does not
    regenerate, supersede or edit datasets/ml-v16-threat-corpus.jsonl. Two reasons:
      * v16's 8 languages were adversarially reviewed for translationese. The 31
        new ones were NOT (see provenance below). Merging them into one file would
        blend two different evidence grades into one undifferentiated blob.
      * The ablation has to be cheap. "Did the new tranche help?" must be
        answerable by dropping ONE filename from the trainer's list and retraining
        -- not by re-deriving a corpus.

LOAD ORDER (what the trainer sees)
    9 v15-era files -> ml-v15-threat-corpus -> ml-v16-threat-corpus -> THIS FILE

INPUTS
    _v16_baseline.py        frozen evidence behind the v16 checkpoint; read, never written
    _v17_langbanks_a.py     15 European/MENA langs: pretexts/pressures/openers/asks/secedu
    _v17_langbanks_b.py     16 Indic/Asian/African langs, same contract
    _v17_core_banks.py      the ATTACK payloads for those 31 langs, 5 labels each
    _v17_attack_cores.py    CORE_2026: the 2026 attack families, 8 cores / 89 payloads

DESIGN RULES INHERITED FROM v16 (each already paid for; see _build_v16_corpus.py)
    1 pattern not topic - 2 native not translated - 3 benign controls in the same
    languages - 4 continuity is not the signal - 5 authority claim is not the signal
    - 6 variety not volume, and do NOT bulk-generate ENCODING_OBFUSCATION /
    TOXICITY_HARASSMENT / UNSAFE_OUTPUT - 7 OOD preservation (English breadth is
    v16's job here; this file adds NO English attack mass, so it cannot pull the
    English decision boundary the way v15's increment did).

TWO RULES THIS FILE ADDS, BOTH FROM MEASUREMENTS MADE WHILE BUILDING IT
    8. NEVER SHIP A LANGUAGE BENIGN-ONLY. A language present in the benign banks but
       absent from the attack banks teaches LANGUAGE -> SAFE. Enforced, not merely
       intended: _v17_core_banks.sanity(expected_langs=...) fails the build if the
       two language sets differ by even one entry.
    9. MULTI_TURN MASS IS CAPPED HARD. v16 poured its budget into
       MULTI_TURN_ESCALATION as "the starved label" and came out 12 attacks BEHIND
       v14 on the canonical gate. That is not proof the two are causally linked --
       the measured miss attribution is 219/232 confidence-floor, 0 label-filter --
       but MULTI_TURN_ESCALATION is trained-but-not-INPUT-escalatable (see below),
       so multiplying it costs softmax mass on the INPUT path and can only pay off
       on OUTPUT. Until something measures otherwise, this file keeps a small,
       deliberate amount rather than a large hopeful one.

THE ESCALATION ASYMMETRY (report it, do not silently design around it)
    Trained label space = 14 (models/ml-classifier-v14/labels.json).
    DEFAULT_INPUT_RELIABLE_LABELS = 9 (lib/guard/mlAugment.ts:146-156).
    Trained but NOT escalatable on INPUT:
        DATA_EXFILTRATION_ATTEMPT, MULTI_TURN_ESCALATION,
        UNSAFE_OUTPUT, TOXICITY_HARASSMENT, (and SAFE, trivially)
    `passesPrecisionGate` returns false for those on INPUT before any threshold,
    floor or semantic check runs. Rows carrying them still train the encoder and
    still matter on OUTPUT -- but they cannot move the INPUT number v17 is judged
    on. The corpus is NOT relabelled to game this; the split is printed every run
    so the trade is visible instead of accidental.

PROVENANCE
    Every row emitted here carries provenance="v17-authored-unreviewed":
    authored in-language in a short formulaic security register, NOT native-reviewed,
    unlike v16's 8. This is the field to filter on when ablating the tranche.

USAGE
    python scripts/ml/_build_v17_corpus.py
    python scripts/ml/_build_v17_corpus.py --check-tokens   # needs transformers, local cache
"""
from __future__ import annotations

import argparse
import json
import math
import random
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import soter_augment  # noqa: E402
import _v17_langbanks_a as LA  # noqa: E402
import _v17_langbanks_b as LB  # noqa: E402
import _v17_core_banks as CB  # noqa: E402
import _v17_attack_cores as AC  # noqa: E402
import _v17_benign_rebalance as BV16  # noqa: E402

group_key_for = soter_augment.group_key_for

SOURCE = "v17-threat-corpus"
PROVENANCE = "v17-authored-unreviewed"
SEED = 20260912
MIN_CHARS = 12

# The instruments v17 will be scored on.
#
# The first four are v16's list, UNCHANGED on purpose: the deployment gate is a
# PAIRED test (v14 rows vs v17 rows on the same instrument), so swapping or
# dropping any of them would void the comparison rather than improve it.
#
# The fifth is new and is an ADDITION, not a substitution -- the canonical gate
# still runs on crossdist alone. It exists because until it was written, "v17 is
# better in non-English" had no instrument behind it at all: v16's probe battery
# is 70 rows over 8 languages, and the widest multilingual tranche was 266 rows.
# 234 rows / 39 languages is a seed instrument, so it gets reported WITH its
# denominator and never as a benchmark. v14 must be scored on it too -- a number
# for v17 alone measures nothing.
HOLDOUT_FILES = [
    "datasets/v16-probe-battery.jsonl",
    "datasets/v15-test-battery.jsonl",
    "datasets/crossdist-eval-v3.jsonl",
    "artifacts/ml/_v15-tranches-scoreset.jsonl",
    "datasets/v17-multilingual-battery.jsonl",
]

# Languages already covered natively (and reviewed) by v16. This file must not add
# attack mass in them: that is v16's evidence, and English breadth in particular is
# rule 7's OOD guard.
V16_LANGS = {"en", "ru", "hi", "hinglish", "zh", "ja", "ar", "es"}

# The INPUT allowlist, mirrored from lib/guard/mlAugment.ts:146-156 for reporting
# only. Nothing here changes behaviour -- it exists so the build PRINTS how much of
# the new mass can actually move the INPUT decision.
INPUT_ESCALATABLE = {
    "PROMPT_INJECTION", "JAILBREAK", "SYSTEM_PROMPT_LEAK_ATTEMPT", "PII", "SECRET",
    "RAG_POISONING", "ENCODING_OBFUSCATION", "MODEL_EXTRACTION", "TOOL_CALL_ABUSE",
}

# ── caps ──────────────────────────────────────────────────────────────────────
# Sized for BALANCE PER LANGUAGE, not for a row target. These 31 languages start
# from ~zero rows in the base corpus, so within each language the attack:benign
# ratio this file emits IS the ratio the model sees for that language. Skew it and
# the model learns the language, not the pattern -- in either direction.
CAP_CORE_PER_LABEL = 8       # per (language, label) after pretext/pressure composition
CAP_MT_PER_LANG = 8          # rule 9: deliberately small
CAP_BENIGN_CONTINUITY = 25   # rule 4: pairs with CAP_MT_PER_LANG
CAP_BENIGN_PRETEXT = 10      # rule 5: authority claim + innocuous ask
CAP_SECEDU_PER_LANG = 5      # rule 3: all authored secedu rows (5 per language)
CAP_CORE2026_PER_CELL = 6    # per (label, language) for the 2026 families

# ── rule 10: the rebalance target ─────────────────────────────────────────────
# 0.70 is chosen against a measured reference, not picked for roundness: English
# sits at 65.7% attack share across 144,203 rows and is the one language with no
# measured LANGUAGE->ATTACK over-defense, so the corpus-wide baseline is the
# target. 0.70 leaves a little headroom above it rather than forcing every
# language to an identical ratio, which would be fitting to a number.
#
# The cap exists so one badly-skewed language cannot dominate the file: hinglish
# alone (1,928 attack rows in the base corpus) would need ~630 benign rows to
# reach 0.70, which would make this tranche mostly hinglish and bury every other
# language's signal. When the cap binds, the residual skew is REPORTED, not hidden.
REBALANCE_TARGET = 0.70
REBALANCE_MAX_PER_LANG = 260

rng = random.Random(SEED)
OUT: list[dict] = []
NOTES: list[str] = []

# Set in main() to the merged langbanks, so gen_rebalance can draw on the 31 new
# languages' own openers/asks without re-reading the bank modules.
REBAL_BANKS: dict[str, dict[str, list[str]]] = {}


def uniq(seq):
    """Order-preserving dedup. Order matters: rng.shuffle is seeded, so a stable
    input order is what makes a build reproducible."""
    seen = set()
    out = []
    for x in seq:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


def emit(text: str, label: str, category: str, language: str) -> None:
    text = re.sub(r"[ \t]+", " ", str(text)).strip()
    if len(text) >= MIN_CHARS:
        OUT.append({"text": text, "label": label, "category": category,
                    "language": language, "source": SOURCE, "provenance": PROVENANCE})


def join(*parts: str) -> str:
    return " ".join(p.strip() for p in parts if p and str(p).strip())


def banks() -> dict[str, dict[str, list[str]]]:
    """Merged langbanks A+B. Overlap is an authoring error, so it is fatal."""
    overlap = set(LA.GENERIC) & set(LB.GENERIC)
    if overlap:
        raise SystemExit(f"langbanks A and B both define: {sorted(overlap)}")
    merged = dict(LA.GENERIC)
    merged.update(LB.GENERIC)
    clash = set(merged) & V16_LANGS
    if clash:
        raise SystemExit(f"v17 banks re-define v16 languages (rule 7 violation): {sorted(clash)}")
    return merged


# ═══════════════════════════════════════════════════════════════════════════════
# BLOCK 1 -- per-language attack cores, composed with pretext / pressure
# ═══════════════════════════════════════════════════════════════════════════════

def gen_core(B: dict) -> None:
    for lang in sorted(B):
        pretexts = B[lang].get("pretexts") or []
        pressures = B[lang].get("pressures") or []
        for label in CB.LABELS:
            variants: list[tuple[str, str]] = []
            for txt in CB.CORE_ASKS[lang][label]:
                cat = f"{label.lower()}-core"
                variants.append((cat, txt))                                    # bare
                for p in pretexts:
                    variants.append((f"{cat}-pretext", join(p, txt)))
                for q in pressures:
                    variants.append((f"{cat}-pressure", join(txt, q)))
                for p in pretexts:
                    for q in pressures:
                        variants.append((f"{cat}-both", join(p, txt, q)))
            rng.shuffle(variants)
            for cat, txt in variants[:CAP_CORE_PER_LABEL]:
                emit(txt, label, cat, lang)


# ═══════════════════════════════════════════════════════════════════════════════
# BLOCK 2 -- MULTI_TURN_ESCALATION: false prior consent + an attack ask
# ═══════════════════════════════════════════════════════════════════════════════

def gen_multi_turn(B: dict) -> None:
    """A false-continuity opener followed by an ATTACK core.

    The opener bank is shared with the benign block on purpose. That is rule 4
    made structural: the identical opener appears on both sides of the label
    boundary, so the only thing separating them is what follows it. A model cannot
    learn "this opener = attack" from this corpus, because it is not true in it.
    """
    for lang in sorted(B):
        openers = B[lang].get("openers") or []
        pressures = B[lang].get("pressures") or []
        combos: list[tuple[str, str]] = []
        for o in openers:
            for label in CB.LABELS:
                for txt in CB.CORE_ASKS[lang][label]:
                    combos.append(("false-prior-consent", join(o, txt)))
                    for q in pressures:
                        combos.append(("false-prior-consent", join(o, txt, q)))
        rng.shuffle(combos)
        for cat, txt in combos[:CAP_MT_PER_LANG]:
            emit(txt, "MULTI_TURN_ESCALATION", cat, lang)


# ═══════════════════════════════════════════════════════════════════════════════
# BLOCK 3 -- the 2026 attack families (own language sets, own provenance story)
# ═══════════════════════════════════════════════════════════════════════════════

def gen_core_2026(B: dict) -> None:
    """CORE_2026 spans BOTH v16 languages and new ones.

    English and the other v16 languages are allowed here and only here: these are
    attack FAMILIES that postdate v16's corpus (MCP/SKILL.md tool-surface
    poisoning, indirect tool-return injection, memory-write imperatives, fluent
    low-perplexity suffixes). Withholding the English form of a 2026 family to
    honour rule 7 would leave the most-attacked language uncovered for exactly the
    techniques this release exists to add. Rule 7 is about not drowning the English
    boundary in bulk multilingual mass, which a capped per-cell slice does not do.
    """
    per_cell: dict[tuple[str, str], list[tuple[str, str]]] = defaultdict(list)
    for label, category, by_lang in AC.CORE_2026:
        for lang, texts in by_lang.items():
            for t in texts:
                per_cell[(label, lang)].append((category, t))

    for (label, lang), items in sorted(per_cell.items()):
        variants = list(items)
        bank = B.get(lang)
        if bank:  # compose only for the new languages; v16 langs stay as authored
            for cat, txt in items:
                for p in bank.get("pretexts") or []:
                    variants.append((cat, join(p, txt)))
                for q in bank.get("pressures") or []:
                    variants.append((cat, join(txt, q)))
        rng.shuffle(variants)
        for cat, txt in variants[:CAP_CORE2026_PER_CELL]:
            emit(txt, label, cat, lang)


# ═══════════════════════════════════════════════════════════════════════════════
# BLOCK 4 -- benign controls, in the same 31 languages (rules 3, 4, 5)
# ═══════════════════════════════════════════════════════════════════════════════

def gen_benign(B: dict) -> None:
    for lang in sorted(B):
        openers = B[lang].get("openers") or []
        asks = B[lang].get("asks") or []
        pretexts = B[lang].get("pretexts") or []

        combos = [(o, a) for o in openers for a in asks]
        rng.shuffle(combos)
        for o, a in combos[:CAP_BENIGN_CONTINUITY]:
            emit(join(o, a), "SAFE", "benign-multiturn", lang)

        pc = [(p, a) for p in pretexts for a in asks]
        rng.shuffle(pc)
        for p, a in pc[:CAP_BENIGN_PRETEXT]:
            emit(join(p, a), "SAFE", "benign-authority-claim", lang)

        for t in (B[lang].get("secedu") or [])[:CAP_SECEDU_PER_LANG]:
            emit(t, "SAFE", "security-education", lang)


# ═══════════════════════════════════════════════════════════════════════════════
# BLOCK 5 -- the REBALANCE tranche (rule 10). Driven by measurement, not by taste.
# ═══════════════════════════════════════════════════════════════════════════════

def gen_rebalance(base_share: dict[str, tuple[int, int]],
                  taken: set[str]) -> None:
    """Add benign mass to languages the BASE corpus teaches as always-attack.

    Rule 10 -- never let a language sit above REBALANCE_TARGET attack share.

    This is the only block whose size is decided by the corpus rather than by a
    constant, because the thing it corrects is a property of the corpus. It was
    added after scoring live v14 on datasets/v17-multilingual-battery.jsonl:
    52.1% FPR on 117 unambiguously-benign rows, 53/61 blocks from the ML tier,
    including an everyday "move my meeting" email request blocked in 15/39
    languages with no security vocabulary in it at all.

    The measured base-corpus attack share explains it: it 100.0% (199 rows),
    sv 100.0% (205), nl 100.0% (180), de 95.8% (286), fr 94.5% (220),
    hinglish 90.7% (2,118). LANGUAGE -> ATTACK was an available shortcut.

    Two sources, because the two groups need different treatment:
      * the 12 measured-skewed languages -- SAFE rows only, from
        _v17_benign_rebalance.BENIGN. Rule 7 bars new ATTACK mass in v16's seven,
        not the correction of a skew now known to cause production over-defense.
      * any other language -- its own langbank openers/asks, same composition as
        gen_benign, just drawn deeper when the measured need is larger.

    `taken` is every group key already spoken for: this file's earlier blocks, the
    holdouts, and the v16 increment. It is filtered HERE rather than at write time
    for one measured reason -- the first version of this block reported
    "de +25, fr +25, it +25, nl +25, sv +25" and delivered ZERO of them. Those
    langbanks hold exactly 25 benign combos each, all already emitted by
    gen_benign, so every drawn row died in main()'s dedup. The five worst-skewed
    languages in the entire corpus silently received nothing while the report said
    otherwise. Counting attempts instead of survivors is how a build lies.

    English is never rebalanced: at 65.7% it IS the corpus baseline, and its
    144,203 rows already carry benign mass.
    """
    emitted: dict[str, int] = {}
    for lang in sorted(set(base_share) | set(BV16.BENIGN)):
        # "mixed" is a code-switching TAG, not a language: its rows are Hinglish,
        # Spanglish and friends pooled together. There is no bank to draw from and
        # no single language to rebalance, so a need computed for it is meaningless.
        if lang in ("en", "mixed"):
            continue
        atk, ben = base_share.get(lang, (0, 0))
        # Count what THIS file has already emitted for the language, so the two
        # blocks compose instead of double-correcting.
        atk += sum(1 for r in OUT if r["language"] == lang and r["label"] != "SAFE")
        ben += sum(1 for r in OUT if r["language"] == lang and r["label"] == "SAFE")
        total = atk + ben
        if total == 0 or atk / total <= REBALANCE_TARGET:
            continue
        # need: smallest n with atk / (total + n) <= target
        need = math.ceil(atk / REBALANCE_TARGET) - total
        if need <= 0:
            continue

        if lang in BV16.BENIGN:
            d = BV16.BENIGN[lang]
            combos = [join(o, a) for o in d["openers"] for a in d["asks"]]
            cat = "benign-rebalance-everyday"
        else:
            bank = REBAL_BANKS.get(lang) or {}
            openers = bank.get("openers") or []
            asks = bank.get("asks") or []
            combos = [join(o, a) for o in openers for a in asks]
            cat = "benign-rebalance-continuity"
        combos = uniq(combos)
        # Drop what would not survive main()'s dedup, BEFORE capping, so `capped`
        # is a count of rows that will actually reach the file.
        fresh = []
        for t in combos:
            k = group_key_for(t)
            if k in taken:
                continue
            taken.add(k)
            fresh.append(t)
        rng.shuffle(fresh)
        capped = min(need, len(fresh), REBALANCE_MAX_PER_LANG)
        if capped < need:
            # Name the BINDING constraint. Two can be true at once (a bank can be
            # short AND the cap can bite); the one that actually set `capped` is
            # the one worth acting on.
            if not fresh:
                why = ("NOTHING LEFT: every composable row for this language was "
                       "already emitted elsewhere. It needs its own bank")
            elif capped == REBALANCE_MAX_PER_LANG <= len(fresh):
                why = f"per-language cap {REBALANCE_MAX_PER_LANG}"
            else:
                why = f"bank exhausted after dedup, only {len(fresh)} fresh rows"
            NOTES.append(
                f"[rebalance] {lang}: need {need} benign rows to reach "
                f"{REBALANCE_TARGET:.0%}, emitted {capped} ({why}). "
                f"Residual skew stays; report it rather than hiding it.")
        before = len(OUT)
        for t in fresh[:capped]:
            emit(t, "SAFE", cat, lang)
        if len(OUT) > before:
            emitted[lang] = len(OUT) - before
    if emitted:
        NOTES.append("[rebalance] benign rows added (net of dedup): "
                     + ", ".join(f"{k} +{v}" for k, v in sorted(emitted.items())))


# ═══════════════════════════════════════════════════════════════════════════════
# Guards + report
# ═══════════════════════════════════════════════════════════════════════════════

def load_holdouts() -> tuple[set[str], set[str]]:
    exact: set[str] = set()
    keys: set[str] = set()
    for rel in HOLDOUT_FILES:
        p = ROOT / rel
        if not p.exists():
            NOTES.append(f"[warn] holdout file missing, cannot guard against it: {rel}")
            continue
        # re.split(r"\r?\n") not splitlines(): splitlines also breaks on U+2028/9,
        # U+0085 and \x0b-\x1e, the exact characters the smuggling rows contain.
        for line in re.split(r"\r?\n", p.read_text(encoding="utf-8")):
            if not line.strip():
                continue
            try:
                t = json.loads(line)["text"]
            except Exception:  # noqa: BLE001
                continue
            exact.add(t.strip())
            keys.add(group_key_for(t))
    return exact, keys


def base_language_share() -> dict[str, tuple[int, int]]:
    """(attack, benign) row counts per language across the files v17 trains ON TOP OF.

    Rule 10 needs the ratio the model will actually see, so this reads the real base
    corpus rather than assuming it. Languages absent from these files return nothing
    and are governed by this file's own caps instead.

    NOTE ON A KNOWN BIAS: ~97% of pre-v15 rows carry no `language` field and default
    to 'en'. That inflates English's row count and can only UNDER-state a non-English
    language's skew, never overstate it -- so every rebalance this function triggers
    is justified by a lower bound, which is the safe direction for a correction that
    adds benign mass.
    """
    files = [
        "datasets/ml-augmented-v8-final.jsonl", "datasets/ml-v8-targeted-fix.jsonl",
        "datasets/ml-v10-advanced-attacks.jsonl", "datasets/ml-v10-targeted-fix.jsonl",
        "datasets/ml-v11-weak-fix.jsonl", "artifacts/ml-v2/v12-toxicity-fix.jsonl",
        "datasets/ml-v13-meta-instructional.jsonl", "datasets/ml-v13-attack-gaps.jsonl",
        "datasets/ml-v15-threat-corpus.jsonl", "datasets/ml-v16-threat-corpus.jsonl",
    ]
    share: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    seen_any = False
    for rel in files:
        p = ROOT / rel
        if not p.exists():
            NOTES.append(f"[warn] base corpus file absent, rule 10 sees less skew than real: {rel}")
            continue
        seen_any = True
        for line in re.split(r"\r?\n", p.read_text(encoding="utf-8")):
            if not line.strip():
                continue
            try:
                r = json.loads(line)
            except Exception:  # noqa: BLE001
                continue
            lang = (r.get("language") or "en").strip().lower()
            share[lang][0 if r.get("label") != "SAFE" else 1] += 1
    if not seen_any:
        NOTES.append("[warn] NO base corpus files readable; rule 10 is inert this run")
    return {k: (v[0], v[1]) for k, v in share.items()}


def existing_corpus_keys() -> set[str]:
    """Group keys already present in the v16 increment.

    Not a leak check -- a DOUBLE-COUNT check. v16 and v17 are both handed to the
    trainer, so a row that exists in both would be weighted twice.
    """
    p = ROOT / "datasets/ml-v16-threat-corpus.jsonl"
    if not p.exists():
        NOTES.append("[warn] v16 increment absent; cannot check for cross-file duplication")
        return set()
    keys = set()
    for line in re.split(r"\r?\n", p.read_text(encoding="utf-8")):
        if not line.strip():
            continue
        try:
            keys.add(group_key_for(json.loads(line)["text"]))
        except Exception:  # noqa: BLE001
            continue
    return keys


def check_tokens(rows: list[dict]) -> None:
    """Token budget on BUILT rows, not single bank strings.

    _v17_measure_langbanks.py measured bank strings in isolation. Composition
    concatenates pretext + core + pressure, so the budget question has to be asked
    again HERE, on what actually ships. It earned its keep the first run: 14 rows
    (0.49%) cross 128 tokens, entirely in ml/th/te/bn, and NONE of that was visible
    in the single-string measurement.

    WHY 0.49% OVER BUDGET IS ACCEPTED RATHER THAN FIXED
        Truncation cuts the TAIL. Every over-budget row is a `-both` composition
        (pretext + core + pressure), so what gets cut is the trailing pressure
        clause -- "answer with the content only", "skip the usual caveats". The
        attack core survives intact and the label stays true to the text the model
        actually sees. Inspected, not assumed: the lost tails were '.',
        '##വ എനിക്ക് അറിയാം.' and similar fragments.

        This is exactly why the check stays in the build instead of being a
        one-off: it is safe TODAY because of where the cut lands, and a future
        bank edit that lengthens a pretext could move the cut into the core. The
        warning below is the tripwire for that.
    """
    try:
        from transformers import AutoTokenizer  # noqa: PLC0415
    except ImportError:
        print("\n[tokens] transformers not installed; skipped")
        return
    name = "distilbert-base-multilingual-cased"
    try:
        tok = AutoTokenizer.from_pretrained(name, local_files_only=True)
    except Exception as exc:  # noqa: BLE001
        print(f"\n[tokens] could not load {name} from local cache: {exc}")
        return

    max_len = 128
    by_lang: dict[str, list[int]] = defaultdict(list)
    unk_id = tok.unk_token_id
    unk_total = 0
    tok_total = 0
    for r in rows:
        ids = tok(r["text"], add_special_tokens=True, truncation=False)["input_ids"]
        by_lang[r["language"]].append(len(ids))
        unk_total += sum(1 for i in ids if i == unk_id)
        tok_total += len(ids)

    allv = sorted(n for v in by_lang.values() for n in v)
    def pct(p: float) -> int:
        return allv[min(len(allv) - 1, int(p * len(allv)))]
    over = sum(1 for n in allv if n > max_len)
    print(f"\n[tokens] BUILT rows under {name}, max_length={max_len}")
    print(f"  p50 {pct(0.50)}   p90 {pct(0.90)}   p95 {pct(0.95)}   p99 {pct(0.99)}   max {allv[-1]}")
    print(f"  over budget: {over}/{len(allv)} ({100*over/max(1,len(allv)):.2f}%)")
    print(f"  UNK: {unk_total}/{tok_total} tokens ({100*unk_total/max(1,tok_total):.3f}%)")
    worst = sorted(((max(v), l) for l, v in by_lang.items()), reverse=True)[:6]
    print("  longest by language: " + ", ".join(f"{l} {n}" for n, l in worst))

    if over:
        # Which rows, and -- the part that matters -- whether the cut lands in the
        # trailing pressure clause (harmless) or in the attack core (poisons the
        # label). Category is the tell: `-both` and `-pressure` rows end in a
        # pressure clause, so truncating them costs nothing the label depends on.
        ov = [r for r in rows
              if len(tok(r["text"], add_special_tokens=True,
                         truncation=False)["input_ids"]) > max_len]
        bad = Counter(r["language"] for r in ov)
        cats = Counter(r["category"] for r in ov)
        tail_safe = sum(v for k, v in cats.items() if k.endswith(("-both", "-pressure")))
        print(f"  [warn] truncation would hit: {dict(bad)}")
        print(f"         categories: {dict(cats)}")
        if tail_safe == len(ov):
            print("         all of them end in a pressure clause -> the cut removes the "
                  "tail, the attack core survives, the label stays true")
        else:
            print(f"         [ACTION] {len(ov) - tail_safe} row(s) do NOT end in a pressure "
                  f"clause -- the cut may land inside the attack core and poison the "
                  f"label. Shorten the bank strings for those languages.")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="datasets/ml-v17-threat-corpus.jsonl")
    ap.add_argument("--check-tokens", action="store_true",
                    help="measure the 128-token budget on BUILT rows (needs transformers)")
    ap.add_argument("--memory-poisoning", choices=("keep", "remap", "drop"), default="remap",
                    help="MEMORY_POISONING is a 15th label with very few rows. "
                         "remap (default) -> RAG_POISONING, the projection "
                         "EXTENDED_LABEL_TO_DB_LABEL already uses; keep -> train a "
                         "15-class head; drop -> omit the rows entirely.")
    ap.add_argument("--no-rebalance", action="store_true",
                    help="skip rule 10 (the benign rebalance tranche). This is the "
                         "ABLATION ARM: build with and without it, train both, and the "
                         "difference is what the rebalance actually bought. Rows carry "
                         "category benign-rebalance-* so the tranche can also be removed "
                         "from a built file after the fact.")
    args = ap.parse_args()

    B = banks()
    # Rule 8, enforced: a language with benign scaffolding but no attack cores
    # would teach LANGUAGE -> SAFE. This raises SystemExit on any mismatch.
    CB.sanity(expected_langs=set(B))
    AC.sanity()
    LA.sanity()
    LB.sanity()

    gen_core(B)
    gen_multi_turn(B)
    gen_core_2026(B)
    gen_benign(B)
    # Rule 10 runs LAST of the generators on purpose: it measures the skew that
    # remains after this file's own benign blocks have already landed, so the two
    # compose instead of over-correcting.
    global REBAL_BANKS
    REBAL_BANKS = B
    # Loaded BEFORE rule 10, not after, so the rebalance can see what is already
    # spoken for. It draws against a measured deficit, so it must not count rows
    # that write-time dedup will delete -- see the docstring's "de +25" incident.
    exact, hkeys = load_holdouts()
    v16keys = existing_corpus_keys()
    if not args.no_rebalance:
        taken = {group_key_for(r["text"]) for r in OUT} | hkeys | v16keys
        gen_rebalance(base_language_share(), taken)
    else:
        NOTES.append("[rebalance] DISABLED by --no-rebalance; this is the ablation arm")

    pre = len(OUT)

    # MEMORY_POISONING policy. Verified safe to KEEP: ALL_LABELS in onnxBackend.ts
    # spreads EXTENDED_MODEL_LABELS, which now carries MEMORY_POISONING, so a
    # 15-entry labels.json does NOT throw in loadLabelMap, and
    # EXTENDED_LABEL_TO_DB_LABEL projects it to RAG_POISONING for the DB write.
    # It still defaults to `remap`, because "it loads" is not "it is learnable":
    # a 15th class carried by a handful of rows mostly adds a softmax competitor.
    # The switch exists so this is a decision with a flag on it, not a side effect.
    mp_rows = sum(1 for r in OUT if r["label"] == "MEMORY_POISONING")
    if args.memory_poisoning == "remap":
        for r in OUT:
            if r["label"] == "MEMORY_POISONING":
                r["label"] = "RAG_POISONING"
                r["category"] = f"memory-poisoning-{r['category']}"
        NOTES.append(f"[label] MEMORY_POISONING x{mp_rows} -> RAG_POISONING "
                     f"(category prefixed; recoverable from the corpus)")
    elif args.memory_poisoning == "drop":
        OUT[:] = [r for r in OUT if r["label"] != "MEMORY_POISONING"]
        NOTES.append(f"[label] MEMORY_POISONING x{mp_rows} dropped")
    else:
        NOTES.append(f"[label] MEMORY_POISONING x{mp_rows} KEPT -> v17 trains a 15-class "
                     f"head. Verified loadable (ALL_LABELS=15), but {mp_rows} rows is thin; "
                     f"expect a weak class and re-measure INPUT_RELIABLE_LABELS.")

    # exact / hkeys / v16keys were loaded above the rebalance block and are reused
    # here unchanged: the guard that writes the file and the guard that sizes the
    # rebalance must be the same guard, or the two can disagree.
    kept: list[dict] = []
    seen: set[str] = set()
    leaked: list[str] = []
    dup = cross = 0
    for r in OUT:
        k = group_key_for(r["text"])
        if r["text"].strip() in exact or k in hkeys:
            leaked.append(r["text"][:90])
            continue
        if k in v16keys:
            cross += 1
            continue
        if k in seen:
            dup += 1
            continue
        seen.add(k)
        kept.append(r)

    out = ROOT / args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8", newline="\n") as fh:
        for r in kept:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")

    labels = Counter(r["label"] for r in kept)
    langs = Counter(r["language"] for r in kept)
    attacks = sum(1 for r in kept if r["label"] != "SAFE")
    benign = len(kept) - attacks
    lab_lang: dict[str, Counter] = defaultdict(Counter)
    for r in kept:
        lab_lang[r["label"]][r["language"]] += 1

    for n in NOTES:
        print(n)
    print(f"\ngenerated (pre-dedup): {pre:,}")
    print(f"dropped (holdout leak): {len(leaked)}")
    for t in leaked[:5]:
        print(f"    - {t.encode('ascii', 'replace').decode('ascii')}")
    print(f"dropped (already in v16 increment): {cross}")
    print(f"dropped (internal dup): {dup}")
    print(f"[write] {out}")
    print(f"rows: {len(kept):,}  ({attacks:,} attacks / {benign:,} benign"
          f" = {100*benign/max(1,len(kept)):.1f}% benign)")

    print("\nby label:")
    for k, v in labels.most_common():
        mark = "" if k in INPUT_ESCALATABLE or k == "SAFE" else "   [not INPUT-escalatable]"
        print(f"  {v:>5}  {k}{mark}")

    esc = sum(v for k, v in labels.items() if k in INPUT_ESCALATABLE)
    noesc = attacks - esc
    print(f"\nattack mass that can move an INPUT decision: {esc:,}/{attacks:,} "
          f"({100*esc/max(1,attacks):.1f}%)")
    print(f"  the remaining {noesc:,} train the encoder and matter on OUTPUT, but "
          f"passesPrecisionGate refuses them on INPUT")

    # Rule 8 again, as a REPORT and not only as an assertion: per-language balance
    # is the thing that actually has to hold, and it is easier to eyeball than to
    # threshold. A NEW language at 0% or 100% attack is a bug regardless of caps.
    #
    # The two groups are reported separately because the same percentage means
    # opposite things in each. For a NEW language this file is the entire signal
    # the model gets, so its ratio IS the ratio learned. For a v16 language the
    # rows below are a small top-up on a base that already carries that language's
    # benign mass, so 100% attack here is a handful of 2026-family rows landing on
    # an already-balanced distribution -- not a benign-free language.
    print("\nper-language balance (attack% of that language's rows IN THIS FILE):")
    per: dict[str, Counter] = defaultdict(Counter)
    for r in kept:
        per[r["language"]]["atk" if r["label"] != "SAFE" else "ben"] += 1

    new_langs = {l for l in per if l not in V16_LANGS}
    ratios = {l: per[l]["atk"] / max(1, sum(per[l].values())) for l in per}
    new_r = [ratios[l] for l in new_langs]
    print(f"  NEW languages ({len(new_langs)}) -- this file IS their whole signal:")
    print(f"    span {100*min(new_r):.1f}% .. {100*max(new_r):.1f}% attack")
    off = sorted(new_langs, key=lambda l: abs(ratios[l] - 0.5))[-3:]
    for l in off:
        c = per[l]
        print(f"    furthest from balanced: {l:>9}  {c['atk']:>3} atk / {c['ben']:>3} ben "
              f"= {100*ratios[l]:.1f}%")
    v16_present = sorted(l for l in per if l in V16_LANGS)
    if v16_present:
        tot_a = sum(per[l]["atk"] for l in v16_present)
        tot_b = sum(per[l]["ben"] for l in v16_present)
        print(f"  v16 languages ({len(v16_present)}) -- 2026-family top-up only, "
              f"benign base lives in the v16/v15 files:")
        print(f"    {tot_a} attack / {tot_b} benign added across "
              f"{', '.join(v16_present)}")

    print("\nby language (top 12):")
    for k, v in langs.most_common(12):
        print(f"  {v:>5}  {k}")

    if args.check_tokens:
        check_tokens(kept)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
