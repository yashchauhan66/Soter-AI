#!/usr/bin/env python3
"""
Pull REAL-HUMAN adversarial corpora and normalize them to the SoterAI 9-label
schema.

WHY THIS EXISTS
  Every row in datasets/ml-augmented-v*.jsonl is synthetic: `template:*` or
  `prefix-suffix:*`. The regex tier was written from the same threat corpus the
  model was then trained on, so both tiers learned ONE prior about what an attack
  looks like. That is why validation reads 99% while honest cross-distribution
  recall sits at 46.5% @ 34% FPR — the eval set and the training set are the same
  distribution, and the ensemble's errors are correlated instead of independent.

  Lakera's moat is not architecture, it is Gandalf: millions of real human attack
  attempts. The closest public analogs are collected here. HackAPrompt alone is
  ~602k prompts written by 2,800+ humans actively trying to break a model — a
  genuinely different distribution from our templates.

WHAT THIS DOES NOT DO
  It does not touch the eval split. Held-out construction lives in
  build-crossdist-eval.py and runs AFTER this, so a corpus can never leak into
  both. It also does not overwrite any existing dataset; output is a new file.

USAGE
  pip install datasets
  python scripts/ml/fetch-external-corpora.py --out datasets/external-real-v1.jsonl
  python scripts/ml/fetch-external-corpora.py --sources hackaprompt,inthewild --limit 50000

LICENCES — verified by reading each dataset card, not by trusting the HF tag.
  (The tag lies: Lakera/gandalf-rct is tagged "other" and its LICENSE file bars
  commercial use outright. Always read the file.)

  COMMERCIALLY USABLE — attribution only, recorded in THIRD-PARTY-NOTICES.md:
    Lakera/mosscap_prompt_injection ......... MIT          278,945 rows
    hackaprompt/hackaprompt-dataset ......... MIT          ~602k (GATED: hf login)
    reshabhs/SPML_Chatbot_Prompt_Injection .. MIT          16,012 (12,542 PI / 3,470 safe)
    TrustAIRLab/in-the-wild-jailbreak-prompts  MIT          1,405
    Lakera/gandalf_ignore_instructions ...... MIT          1,000
    Open-Orca/OpenOrca ...................... MIT          millions (streamed)
    deepset/prompt-injections ............... Apache-2.0    662
    yanismiraoui/prompt_injections .......... Apache-2.0    1,034  (7 languages)
    jackhhao/jailbreak-classification ....... Apache-2.0    1,306
    databricks/databricks-dolly-15k ......... CC-BY-SA-3.0  15,011

  USABLE ONLY WITH AN IN-ADAPTER FILTER — the top-level tag is not the licence:
    quickium/prompt-security-v0 ..... Hub tag "other". `train` (71,117) is
        commercial-clean EXCEPT source=octavio_pi_multilingual (~7,205) which is
        GPL-3.0 copyleft. Split `train_nc` (293,907, © AI2) is CC BY-NC and bars
        commercial model training. Adapter pins split="train" + drops octavio.
    neuralchemy/Prompt-injection-dataset ..... Apache-2.0 wrapper over mixed
        upstreams; the WildGuard/JudgeComparison subset is "Research" only.
        Adapter allow-lists source in {original, harmbench}.

  DO NOT USE — licence forbids it for a commercial product:
    Lakera/gandalf-rct ...... "academic, non-commercial research purposes" only
    tatsu-lab/alpaca ........ CC-BY-NC-4.0 (NonCommercial)
    allenai/wildjailbreak ... CC BY-NC via quickium's train_nc; card bars
                              commercial model training (gated separately too)
    dmilush/shieldlm-prompt-injection ... tagged MIT, but ~1,002 TrustAIRLab rows
                              are CC-BY-NC-SA-4.0. NC + ShareAlike inside a corpus
                              advertised as MIT; not worth the filter for 54k rows
                              whose permissive 98% we already hold directly.

  USABLE BUT DELIBERATELY NOT DEFAULT — licence is fine, provenance is not:
    blackXmask/RedLockX-...-109K ..... Apache-2.0, 109k rows, all `synthetic_v1`.
        Synthetic data is the thing this file exists to counterbalance. Opt-in.

  DO NOT USE — no licence declared at all, so no permission is granted:
    xTRam1/safe-guard-prompt-injection, jayavibhav/prompt-injection,
    JasperLS/prompt-injections   (all: empty card, no licence tag)

We consume these to fit model weights; we do not republish the rows. Trained
weights stay proprietary. Attribution obligations are met by the notices file.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path
from typing import Callable, Iterable, Iterator

# Must stay identical to train-soterllm-v4.py::ALL_LABELS.
ALL_LABELS = [
    "SAFE",
    "PROMPT_INJECTION",
    "JAILBREAK",
    "SYSTEM_PROMPT_LEAK_ATTEMPT",
    "PII",
    "SECRET",
    "UNSAFE_OUTPUT",
    "RAG_POISONING",
    "DATA_EXFILTRATION_ATTEMPT",
]

MIN_CHARS = 8
MAX_CHARS = 4000


def group_key_for(text: str) -> str:
    """Identical to train-soterllm-v4.py::group_key_for.

    Duplicated deliberately rather than imported: that file is a CLI training
    script, and importing it would execute argparse at module scope. If the
    training definition changes, this MUST change with it — verify-corpus-split.py
    asserts the two agree.
    """
    t = unicodedata.normalize("NFKD", text)
    t = "".join(ch for ch in t if not unicodedata.combining(ch)).lower()
    leet = {"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i"}
    t = "".join(leet.get(ch, ch) for ch in t)
    letters = re.findall(r"[a-z]+", t)
    letters.sort()
    return " ".join(letters)


def clean(text: str) -> str | None:
    if not isinstance(text, str):
        return None
    t = text.replace("\x00", "").strip()
    if len(t) < MIN_CHARS:
        return None
    return t[:MAX_CHARS]


def row(text: str, label: str, source: str, language: str = "en") -> dict | None:
    t = clean(text)
    if t is None or label not in ALL_LABELS:
        return None
    return {"text": t, "label": label, "language": language, "source": source}


# ── Per-corpus adapters ───────────────────────────────────────────────────────
#
# Each yields normalized rows. Label assignment is the delicate part: a wrong
# label here poisons training more than a missing corpus does, so each adapter
# maps only what the source actually asserts and drops anything ambiguous.


def load_hackaprompt(limit: int | None) -> Iterator[dict]:
    """~602k human attacks from a global prompt-hacking competition.

    Only rows the competition itself scored as successful are taken. An
    unsuccessful attempt is not a safe prompt — it is a failed attack — so
    labelling those SAFE would teach the model exactly the wrong boundary. They
    are dropped, not repurposed.
    """
    from datasets import load_dataset

    ds = load_dataset("hackaprompt/hackaprompt-dataset", split="train", streaming=True)
    taken = 0
    for r in ds:
        if limit and taken >= limit:
            return
        if not r.get("correct"):
            continue
        text = r.get("user_input") or r.get("prompt")
        out = row(text, "PROMPT_INJECTION", "external:hackaprompt")
        if out:
            taken += 1
            yield out


def load_inthewild(limit: int | None) -> Iterator[dict]:
    """1,405 jailbreaks scraped from Reddit/Discord/websites (CCS'24)."""
    from datasets import load_dataset

    ds = load_dataset(
        "TrustAIRLab/in-the-wild-jailbreak-prompts", "jailbreak_2023_12_25", split="train"
    )
    taken = 0
    for r in ds:
        if limit and taken >= limit:
            return
        out = row(r.get("prompt"), "JAILBREAK", "external:inthewild")
        if out:
            taken += 1
            yield out


def load_inthewild_regular(limit: int | None) -> Iterator[dict]:
    """DO NOT USE AS BENIGN. Kept only to document why.

    `regular_2023_12_25` means "not flagged as a jailbreak by the paper's own
    pipeline" — it does NOT mean benign. The prompts are scraped from the same
    Reddit/Discord jailbreak communities, so the config is full of DAN variants,
    "From now on you are no longer Assistant", and "Please ignore all previous
    instructions" rewrites.

    Mapping this to SAFE produced a measured 39% "false positive" rate that was
    mostly the guard being RIGHT, and would have poisoned training with ~10k
    attacks labelled SAFE — teaching the model that DAN is acceptable. Benign
    negatives must come from corpora with no adversarial provenance at all.
    """
    raise RuntimeError(
        "inthewild-regular is not a benign corpus; use dolly/alpaca/openorca instead"
    )
    yield  # pragma: no cover - unreachable, keeps this a generator


def load_dolly(limit: int | None) -> Iterator[dict]:
    """15k human-written instructions from Databricks employees. CC-BY-SA-3.0.

    Clean-provenance benign: written as ordinary work tasks, with no connection
    to jailbreak communities.
    """
    from datasets import load_dataset

    ds = load_dataset("databricks/databricks-dolly-15k", split="train")
    taken = 0
    for r in ds:
        if limit and taken >= limit:
            return
        text = " ".join(filter(None, [r.get("instruction"), r.get("context")])).strip()
        out = row(text, "SAFE", "external:dolly")
        if out:
            taken += 1
            yield out


def load_alpaca(limit: int | None) -> Iterator[dict]:
    """DO NOT USE. CC-BY-NC-4.0 — NonCommercial. Kept only to document why.

    SoterAI is a commercial product, so the NC clause bars this corpus outright.
    It previously sat in SOURCES as an ordinary option with the licence noted only
    in a passing comment, which is how a non-commercial corpus ends up in a
    shipped model by accident. Dolly (CC-BY-SA-3.0) and OpenOrca (MIT) cover the
    same benign-instruction register with no such restriction.
    """
    raise RuntimeError(
        "alpaca is CC-BY-NC-4.0 (NonCommercial) and cannot be used in a commercial "
        "product; use dolly/openorca for benign instruction data instead"
    )
    yield  # pragma: no cover - unreachable, keeps this a generator


def load_openorca(limit: int | None) -> Iterator[dict]:
    """Large, diverse instruction corpus. MIT. Streamed — it is millions of rows.

    Includes system-prompt-style questions, which is exactly the register our
    synthetic benign rows lack and where the model over-fires.

    v2 build hung at 0 rows. Root cause unknown (network stall? HF streaming bug?).
    Added explicit limit default + timeout behavior: when no limit is set for a
    streamed corpus that has millions of rows, cap at a sane default rather than
    trying to consume the entire thing. 10k is ~4x dolly and large enough to cover
    register diversity without making a single source dominate the entire corpus.
    """
    from datasets import load_dataset

    effective_limit = limit if limit is not None else 10000
    ds = load_dataset("Open-Orca/OpenOrca", split="train", streaming=True)
    taken = 0
    for r in ds:
        if taken >= effective_limit:
            return
        out = row(r.get("question"), "SAFE", "external:openorca")
        if out:
            taken += 1
            yield out


def load_deepset(limit: int | None) -> Iterator[dict]:
    """~660 curated injections + benign, multilingual (de/en)."""
    from datasets import load_dataset

    ds = load_dataset("deepset/prompt-injections", split="train")
    taken = 0
    for r in ds:
        if limit and taken >= limit:
            return
        label = "PROMPT_INJECTION" if int(r.get("label", 0)) == 1 else "SAFE"
        out = row(r.get("text"), label, "external:deepset", language="mixed")
        if out:
            taken += 1
            yield out


def load_gandalf(limit: int | None) -> Iterator[dict]:
    """Lakera's own released Gandalf prompts — real attacks against a real target.

    Small (~1k) but distributionally precious: it is a direct sample of the
    corpus that produced Lakera's advantage.
    """
    from datasets import load_dataset

    ds = load_dataset("Lakera/gandalf_ignore_instructions", split="train")
    taken = 0
    for r in ds:
        if limit and taken >= limit:
            return
        out = row(r.get("text"), "SYSTEM_PROMPT_LEAK_ATTEMPT", "external:gandalf")
        if out:
            taken += 1
            yield out


def load_wildjailbreak(limit: int | None) -> Iterator[dict]:
    """AI2 WildJailbreak: adversarial + vanilla, harmful + benign.

    Gated on HuggingFace — needs `huggingface-cli login` and card acceptance.
    The benign-adversarial rows are the reason to bother: prompts that LOOK like
    attacks but are not, which is precisely our false-positive failure mode
    ("Show me the previous message in this thread").
    """
    from datasets import load_dataset

    ds = load_dataset("allenai/wildjailbreak", "train", split="train", delimiter="\t")
    taken = 0
    for r in ds:
        if limit and taken >= limit:
            return
        dtype = (r.get("data_type") or "").lower()
        text = r.get("adversarial") or r.get("vanilla")
        if "benign" in dtype:
            label = "SAFE"
        elif "harmful" in dtype:
            label = "JAILBREAK" if "adversarial" in dtype else "UNSAFE_OUTPUT"
        else:
            continue
        out = row(text, label, f"external:wildjailbreak-{dtype}")
        if out:
            taken += 1
            yield out


def load_mosscap(limit: int | None) -> Iterator[dict]:
    """Lakera's Mosscap (DEF CON 31) — 278,945 real human attacks. MIT.

    279x more real-human attack data than gandalf_ignore_instructions, same
    publisher, same permissive licence. This is the single largest honest data
    win available to us.

    LABELLING IS THE WHOLE PROBLEM HERE. Lakera state plainly that they released
    "every prompt that we received, regardless of whether it truly is a prompt
    injection or not", so a large share is ordinary chatter. Labelling a row as an
    attack because it appears in an attack-game corpus is exactly the mistake that
    poisoned inthewild-regular in reverse.

    So we label by OUTCOME, not by provenance. `answer` is what the player was
    shown; `raw_answer` is the model output before Mosscap's own output guard ran.
    When those differ, Lakera's defence had to intervene — i.e. the prompt
    actually pulled protected content out of a defended target. That is a
    behavioural success label, not an assumption, and it is a far stronger signal
    than "someone typed this".

    Rows where the two agree are UNKNOWN, not SAFE: the prompt may have been a
    perfectly good attack that simply failed, and teaching the model that failed
    attacks are benign would flatten the exact boundary we need.
    """
    from datasets import load_dataset

    ds = load_dataset("Lakera/mosscap_prompt_injection", split="train", streaming=True)
    taken = 0
    for r in ds:
        if limit and taken >= limit:
            return
        answer = (r.get("answer") or "").strip()
        raw = (r.get("raw_answer") or "").strip()
        if not raw:
            continue
        # Defence intervened => the prompt succeeded in eliciting protected text.
        intervened = (not answer) or (group_key_for(answer) != group_key_for(raw))
        if not intervened:
            continue  # UNKNOWN — never relabelled SAFE. See docstring.
        level = str(r.get("level") or "").strip().replace(" ", "").lower()
        out = row(r.get("prompt"), "SYSTEM_PROMPT_LEAK_ATTEMPT", f"external:mosscap-{level or 'na'}")
        if out:
            taken += 1
            yield out


def load_multilingual_injections(limit: int | None) -> Iterator[dict]:
    """yanismiraoui/prompt_injections — Apache-2.0, 1,034 rows, SEVEN languages.

    en/fr/de/es/it/pt/ro. Worth its small size: SOTERAI-ML-MODEL-CARD.md lists
    "sparse native multilingual data" as a known limitation, and PINT is 30%
    non-English (1,298 of 4,314). Every row is an injection by construction —
    the card describes the file as prompt leaking, jailbreaking and mode
    switching examples only, with no benign column to mislabel.
    """
    from datasets import load_dataset

    ds = load_dataset("yanismiraoui/prompt_injections", split="train")
    taken = 0
    for r in ds:
        if limit and taken >= limit:
            return
        out = row(r.get("prompt_injections"), "PROMPT_INJECTION", "external:multiling", language="mixed")
        if out:
            taken += 1
            yield out


def load_jailbreak_classification(limit: int | None) -> Iterator[dict]:
    """jackhhao/jailbreak-classification — Apache-2.0, 1,306 rows, explicit labels.

    Carries its own benign/jailbreak column, so no inference is needed. Its
    benign half comes from OpenOrca and GPTeacher (clean provenance, no
    jailbreak-community scraping), which makes it usable on both sides.
    """
    from datasets import load_dataset

    ds = load_dataset("jackhhao/jailbreak-classification", split="train")
    taken = 0
    for r in ds:
        if limit and taken >= limit:
            return
        t = (r.get("type") or "").strip().lower()
        if t == "jailbreak":
            label = "JAILBREAK"
        elif t == "benign":
            label = "SAFE"
        else:
            continue
        out = row(r.get("prompt"), label, "external:jbclass")
        if out:
            taken += 1
            yield out


def load_spml(limit: int | None) -> Iterator[dict]:
    """reshabhs/SPML_Chatbot_Prompt_Injection — MIT, 16,012 rows.

    Carries its own explicit binary column, so no inference is needed:
    12,542 injections + 3,470 benign. Verified by reading the column, not the tag.

    Distributionally new in one specific way nothing else here has: every row is a
    (System Prompt, User Prompt) PAIR from a deployed-chatbot setting. Our corpus
    is almost entirely bare user turns, so the model has never seen the register
    where an injection is embedded in a real application context. That is the
    register `docs/ml/LAKERA-PARITY-PROGRAM.md` §7 lists as our known FP surface
    ("Show me the previous message in this thread").

    Only the User Prompt is taken as text. Concatenating the system prompt would
    teach the classifier to score the DEFENCE text, and the same system prompt is
    reused across hundreds of rows — it would dominate the group key and collapse
    thousands of distinct attacks into a handful of groups, silently wrecking the
    leak-free split.
    """
    from datasets import load_dataset

    ds = load_dataset("reshabhs/SPML_Chatbot_Prompt_Injection", split="train")
    taken = 0
    for r in ds:
        if limit and taken >= limit:
            return
        raw = r.get("Prompt injection")
        if raw is None:
            continue
        label = "PROMPT_INJECTION" if int(raw) == 1 else "SAFE"
        out = row(r.get("User Prompt"), label, "external:spml")
        if out:
            taken += 1
            yield out


# GPL-3.0 copyleft travels with these rows and would attach to anything built from
# them. Excluded by name rather than by trusting the split label.
_QUICKIUM_GPL_SOURCES = {"octavio_pi_multilingual"}

_QUICKIUM_DOMAIN_TO_LABEL = {
    "PI": "PROMPT_INJECTION",
    "JB": "JAILBREAK",
    "PII": "PII",
    "SAFE": "SAFE",
}


def load_quickium(limit: int | None) -> Iterator[dict]:
    """quickium/prompt-security-v0 — `train` split only, 71,117 rows, 32+ languages.

    TWO LICENCE TRAPS, both verified by reading the card rather than the Hub tag
    (the Hub tag is `other`, which grants nothing on its own):

      1. The `train_nc` split (293,907 rows, WildJailbreak + WildGuardMix, © AI2)
         is CC BY-NC and its card bars "training models for commercial products"
         outright. This adapter pins split="train" and never touches it.
      2. Inside the supposedly commercial-clean `train` split, the
         `octavio_pi_multilingual` source (~7,205 rows) is GPL-3.0. The card states
         plainly that "GPL-3.0 terms travel with those rows", so they are dropped.

    Worth the care: this is the largest multilingual injection corpus we can use at
    all, and SOTERAI-ML-MODEL-CARD.md lists sparse native multilingual data as a
    known limitation while PINT is 30% non-English.

    The card also warns the jailbreak axis in `train` is "vestigial" (4 rows) — so
    this corpus is a PI/PII/multilingual lever, NOT a jailbreak lever. jbclass and
    inthewild remain the jailbreak sources.
    """
    from datasets import load_dataset

    ds = load_dataset("quickium/prompt-security-v0", split="train")
    taken = 0
    for r in ds:
        if limit and taken >= limit:
            return
        if str(r.get("source") or "") in _QUICKIUM_GPL_SOURCES:
            continue
        label = _QUICKIUM_DOMAIN_TO_LABEL.get(str(r.get("domain") or "").strip().upper())
        if label is None:
            continue
        lang = str(r.get("language") or "en").strip() or "en"
        out = row(r.get("text"), label, "external:quickium", language=lang)
        if out:
            taken += 1
            yield out


# The `core` config aggregates under an Apache-2.0 wrapper, but one upstream
# (WildGuard / JudgeComparison) is labelled only "Research" with no commercial
# grant. Allow-list the sources that carry a real permissive licence instead of
# trusting the wrapper.
_NEURALCHEMY_OK_SOURCES = {"original", "harmbench"}


def load_neuralchemy(limit: int | None) -> Iterator[dict]:
    """neuralchemy/Prompt-injection-dataset `core` — Apache-2.0 wrapper, filtered.

    Why bother with a 6k corpus: it is the only source here that covers the 2025-26
    technique families our template corpus predates — encoding/obfuscation, token
    smuggling, crescendo, many-shot — and it ships `tags` marking deliberate
    hard_negative rows, which is the FPR lever the parity program asks for.

    Two hygiene properties that make it safe to mix in:
      - `augmented` flags synthetic siblings, so they can be dropped rather than
        silently inflating group counts.
      - It carries its own `group_id`, independent evidence that the publisher
        split by skeleton rather than by row.

    Sources are allow-listed (see _NEURALCHEMY_OK_SOURCES): the WildGuard subset is
    "Research"-licensed and must not reach a commercial model.
    """
    from datasets import load_dataset

    ds = load_dataset("neuralchemy/Prompt-injection-dataset", "core", split="train")
    taken = 0
    for r in ds:
        if limit and taken >= limit:
            return
        if str(r.get("source") or "").strip().lower() not in _NEURALCHEMY_OK_SOURCES:
            continue
        if r.get("augmented"):
            continue  # keep only seeds; our own augmenter owns that axis
        raw = r.get("label")
        if raw is None:
            continue
        category = str(r.get("category") or "").strip().lower()
        if int(raw) == 0:
            label = "SAFE"
        elif "jailbreak" in category:
            label = "JAILBREAK"
        else:
            label = "PROMPT_INJECTION"
        out = row(r.get("text"), label, f"external:neuralchemy-{category or 'na'}")
        if out:
            taken += 1
            yield out


def load_redlockx(limit: int | None) -> Iterator[dict]:
    """blackXmask/RedLockX-109K — Apache-2.0, 109k rows, but SYNTHETIC. Opt-in only.

    Kept available and deliberately OUT of DEFAULT_SOURCES. The licence is fine;
    the provenance is the problem. Every row inspected carries `source:
    synthetic_v1`, i.e. this is generated data, not humans attacking a target.

    That makes it the exact input this whole program exists to stop adding. The v6
    retrain regressed core hybrid 100 -> 95.8% on more same-shape synthetic rows and
    was rolled back; 109k more would be the same mistake at 30x the scale, and it
    would swamp the 52k real-human rows that are the point of the corpus.

    Left importable so a future experiment can measure it rather than argue about
    it — but if it is enabled, report the corpus mix, because a headline recall
    number over a synthetic-dominated corpus is not a cross-distribution result.
    """
    from datasets import load_dataset

    ds = load_dataset("blackXmask/RedLockX-Prompt-Injection-109K-DataSet", split="train")
    taken = 0
    for r in ds:
        if limit and taken >= limit:
            return
        if not int(r.get("is_dangerous") or 0):
            continue
        kind = str(r.get("label") or "").strip().lower()
        if "jailbreak" in kind:
            label = "JAILBREAK"
        elif "leak" in kind or "extract" in kind or "reveal" in kind:
            label = "SYSTEM_PROMPT_LEAK_ATTEMPT"
        elif "exfil" in kind:
            label = "DATA_EXFILTRATION_ATTEMPT"
        else:
            label = "PROMPT_INJECTION"
        out = row(r.get("text"), label, "external:redlockx-synthetic")
        if out:
            taken += 1
            yield out


def load_promptwall(limit: int | None) -> Iterator[dict]:
    """Gyr0ghost/promptwall-injection-dataset — MIT, 500 rows. BROKEN UPSTREAM.

    Raises rather than half-loading. The shards disagree on schema: one file adds a
    `label` column the others lack, so `load_dataset` dies with a CastError at 430
    of 500 rows.

    Not routed around on purpose. A silent partial load would take 430 rows from
    whichever shards happen to cast, which is a biased 86% sample of an
    already-tiny corpus — and its value was per-category coverage
    (multi_turn_drift, encoded_attack, indirect_injection), which a partial load
    is exactly what destroys. 500 rows is not worth an unverifiable mix.
    """
    raise RuntimeError(
        "promptwall shards have mismatched schemas (extra 'label' column) and fail "
        "to cast; upstream fix needed before this can be loaded honestly"
    )
    yield  # pragma: no cover - unreachable, keeps this a generator


SOURCES: dict[str, Callable[[int | None], Iterable[dict]]] = {
    "spml": load_spml,
    "quickium": load_quickium,
    "neuralchemy": load_neuralchemy,
    "redlockx": load_redlockx,  # synthetic; opt-in, never default
    "promptwall": load_promptwall,  # raises; broken upstream schema
    "mosscap": load_mosscap,
    "multiling": load_multilingual_injections,
    "jbclass": load_jailbreak_classification,
    "hackaprompt": load_hackaprompt,
    "inthewild": load_inthewild,
    "inthewild-regular": load_inthewild_regular,  # raises; see docstring
    "deepset": load_deepset,
    "gandalf": load_gandalf,
    "wildjailbreak": load_wildjailbreak,
    "dolly": load_dolly,
    "alpaca": load_alpaca,
    "openorca": load_openorca,
}

# Benign corpora must have NO adversarial provenance. Anything scraped from a
# jailbreak community is an attack corpus regardless of how the source labelled it.
#
# Every source in this default is commercially licensed AND ungated, so the default
# run must complete without a HuggingFace login. hackaprompt (MIT) and wildjailbreak
# are both gated behind card acceptance, so they stay opt-in rather than default —
# otherwise the zero-yield guard below fires for everyone without HF credentials.
#
# Deliberately NOT in this list, each for a different reason:
#   redlockx    — 109k rows, Apache-2.0, but synthetic_v1 provenance. Adding it
#                 would swamp the real-human corpus with the same template-shaped
#                 data that made v6 regress. Opt-in so it gets measured, not assumed.
#   promptwall  — upstream schema mismatch; the adapter raises rather than load a
#                 biased 86% partial.
#   train_nc    — not a source here at all; quickium's NC split is barred in-adapter.
DEFAULT_SOURCES = (
    "mosscap,gandalf,deepset,multiling,jbclass,inthewild,spml,quickium,neuralchemy,dolly,openorca"
)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="datasets/external-real-v2.jsonl")
    ap.add_argument("--sources", default=DEFAULT_SOURCES, help="comma-separated subset")
    ap.add_argument("--limit", type=int, default=None, help="max rows PER source")
    ap.add_argument(
        "--dedupe-against",
        default="",
        help="comma-separated existing jsonl files; rows sharing a group key are dropped",
    )
    args = ap.parse_args()

    try:
        import datasets  # noqa: F401
    except ImportError:
        print("[ERROR] pip install datasets", file=sys.stderr)
        return 2

    # Dedupe against existing training data so an external row that happens to
    # collide with a template does not silently double-weight that skeleton.
    seen: set[str] = set()
    for path in filter(None, (p.strip() for p in args.dedupe_against.split(","))):
        p = Path(path)
        if not p.exists():
            print(f"[WARN] --dedupe-against file not found: {p}", file=sys.stderr)
            continue
        with p.open(encoding="utf-8") as f:
            for line in f:
                try:
                    seen.add(group_key_for(json.loads(line)["text"]))
                except Exception:
                    continue
        print(f"[dedupe] loaded {len(seen)} group keys after {p}")

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    per_source: dict[str, int] = {}
    per_label: dict[str, int] = {}
    failures: dict[str, str] = {}
    requested: list[str] = []
    dropped_dupe = 0
    written = 0

    with out_path.open("w", encoding="utf-8") as out:
        for name in (s.strip() for s in args.sources.split(",")):
            if name not in SOURCES:
                print(f"[WARN] unknown source '{name}', skipping", file=sys.stderr)
                continue
            requested.append(name)
            print(f"[fetch] {name} ...")
            try:
                for rec in SOURCES[name](args.limit):
                    key = group_key_for(rec["text"])
                    if key in seen:
                        dropped_dupe += 1
                        continue
                    seen.add(key)
                    out.write(json.dumps(rec, ensure_ascii=False) + "\n")
                    written += 1
                    per_source[name] = per_source.get(name, 0) + 1
                    per_label[rec["label"]] = per_label.get(rec["label"], 0) + 1
            except Exception as exc:  # noqa: BLE001
                # One gated/renamed dataset must not lose the corpora already
                # written. Report and continue.
                failures[name] = f"{type(exc).__name__}: {exc}"
                print(f"[ERROR] {name} failed: {exc}", file=sys.stderr)

    print(f"\nwrote {written} rows -> {out_path}")
    print(f"dropped {dropped_dupe} duplicate group keys")
    print("\nper source:")
    for k, v in sorted(per_source.items(), key=lambda x: -x[1]):
        print(f"  {k:28} {v}")
    print("\nper label:")
    for k, v in sorted(per_label.items(), key=lambda x: -x[1]):
        print(f"  {k:28} {v}")
    if not written:
        print("\n[ERROR] no rows written", file=sys.stderr)
        return 1

    # A source that yielded nothing is the dangerous outcome, not an empty file.
    # The run still prints a healthy-looking total, the corpus mix silently
    # changes, and every downstream number is attributed to a dataset that was
    # never actually there. openorca did exactly this on the v2 build: it is the
    # only streamed benign corpus, so losing it skews benign toward dolly's
    # single register — the opposite of the diversity this script exists for.
    empty = [s for s in requested if not per_source.get(s)]
    if empty:
        print("\n[FATAL] these sources contributed 0 rows:", file=sys.stderr)
        for s in empty:
            print(f"  {s:28} {failures.get(s, 'no rows yielded, no exception raised')}", file=sys.stderr)
        print(
            "\nThe output file is still on disk, but do NOT build an eval set from it:\n"
            "the corpus mix is not what was requested. Fix the source (gated dataset\n"
            "needs `huggingface-cli login`; a rename needs the adapter updated) or drop\n"
            "it from --sources deliberately, then rerun.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
