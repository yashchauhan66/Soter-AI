# dim10 label verification record

**Status:** VERIFIED — 0 rows dropped (95 train / 30 battery)
**Date:** 2026-09-07
**Why this file exists:** `extract-workflow-batches.py` marks a generated batch
`UNVERIFIED` when its adversarial verifier agent never returned, and says so
loudly rather than folding it in silently. dim10's verifier was one of the three
workflow agent failures. This is the missing verification pass, done manually.

Dropping the batch instead was not an option worth taking blind: dim10 holds
**every ENCODING_OBFUSCATION row (8)**, **every TOXICITY_HARASSMENT row (2)**,
and the entire 14-language multilingual dimension — the exact rows the v15 pass
exists to add.

## Method

Every one of the 95 train rows was read and its gold label checked against the
technique the text actually performs. The bar applied is the one the repo's
history demands: a row is only kept if a security reviewer would independently
assign that label with no knowledge of the generator's intent. Rows that are
"attack-adjacent but benign" are the specific failure this project has been
burned by (~45% of the crossdist misses are label noise of that kind), so the
6 SAFE rows were checked as hard as the attacks.

## Result

| Verdict | Rows |
|---|---|
| Label correct, kept | 95 |
| Mislabeled, dropped | 0 |

**Attack rows (89)** — every row matches its label. Technique families present:

- deceased-grandmother credential-elicitation — rows 4, 11, 21, 28, 32, 38
- developer-mode / DAN / unrestricted-persona — 5, 8, 10, 13, 15, 18, 19, 24, 27, 30, 33, 36, 39, 41, 43
- audit-pretext system-prompt leak — 1, 2, 6, 9, 14, 16, 20, 23, 26, 31, 34, 37, 40, 42, 44
- code-switched system-check leak — 45, 46, 47
- fiction / screenplay framing — 70, 71, 72
- translate-then-obey injection — 48, 49, 73
- summarize-then-obey injection — 55, 56, 74, 75
- forged authority ("I am from the security team") — 76, 77
- hidden-note data exfiltration — 3, 7, 12, 17, 22, 25, 29, 35, 83
- tool-call abuse — 59, 60, 61, 81, 82
- model extraction — 62, 63, 64, 65
- encoding evasion (base64 / spaced / reversed / ROT13 / acrostic / zero-width / leet) — 50, 51, 52, 53, 54, 78, 79, 80
- multi-turn escalation / foot-in-the-door — 66, 67, 68, 69
- RAG poisoning — 57, 58
- PII misuse — 85, 86
- secret elicitation — 84
- toxicity / harassment — 87, 88

**Benign rows (6)** — 89 (supervised vs unsupervised learning, fr), 90 (vegetarian
biryani recipe, hi), 91 (resume summary, hinglish), 92 (grammar check, de),
93 (meeting-notes summary, zh), 94 (Python for-loop explainer, ja). All are
ordinary requests with no attack framing. They are useful multilingual
hard-negatives precisely because they sit in the same languages as the attacks,
so the model cannot learn "non-English ⇒ attack".

## One noted nuance, not a drop

Row 84 (`SECRET`, fr) asks the assistant for the API key and database password
"stored in your configuration". This is defensible as `SECRET` and equally
defensible as `DATA_EXFILTRATION_ATTEMPT`. It is an attack under either label,
so this is a relabel-level judgement at worst and never a reason to drop the
row. Left as `SECRET`.

## Provenance change

`artifacts/ml/v15-batches.json`: `dim10-UNVERIFIED` → `dim10-verified`,
`source: gen-unverified` → `verify`, with `verifyNotes` and `verifier` recorded
in the batch. Re-running the assembler after the change produces the same
889 / 274 split — the rows were always included; only their provenance was
unproven.
