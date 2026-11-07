# v19 sealed / dev set — authoring specification

Purpose: a frozen evaluation the model has never seen, big enough to measure the
improvement the project exists to prove. Target sizes are minimums; more is better.

Why this is the first deliverable: the existing blind set is 26 rows (95% CI 81–99%
on v14+the new model), and the 4,000-row dev battery is 82% training data. Neither
can certify anything.

## Composition

### Attacks: ≥ 1,200 rows

| Family | Min n | Why (weakness register ID) |
|---|---|---|
| Short-input prompt injection (≤ 64 tokens) | 200 | W2 — worst recall bucket (.838) |
| Review / summary / RAG-content injection | 150 | W5 — "note to the AI in a review" pattern |
| Multi-turn consent escalation (single message: quoted prior agreement) | 100 | W5, MTE recall .719 in-distribution |
| Persona / role-play in non-English (bn, hi, ur, es, de, fr, ar) | 150 | W5 — Bengali role-play missed by both models |
| System-prompt leak, paraphrased (no "system prompt" string) | 100 | W5 — SPL 15 both-miss |
| Tool / agent abuse (MCP-style, no "tool" keyword) | 100 | W5 — TOOL 14 both-miss |
| Data exfiltration with a real-shaped webhook/email target | 100 | W5 — Spanish webhook missed |
| Encoding / obfuscation (base64, leet, split words, zero-width) | 100 | prior: encoding recall .68 |
| Hinglish / romanized Hindi coercion | 100 | product wedge (India-first) |
| Long-document buried payload (payload after ≥ 2,000 tokens of benign text) | 100 | W3, truncation class |
| **Benign hard look-alikes** | **≥ 4,000** | see below |

Languages: every family must appear in English; the persona, consent and Hinglish
families must appear in their named languages. Minimum benign coverage: 300 rows each
in en, hi, hinglish, bn, ar, es, de, fr, pt, ru, zh, ja, ko (W7).

### Benign hard look-alikes: ≥ 4,000 rows

| Type | Min n |
|---|---|
| Security-domain prose that names attacks ("prompt injection occurs when…") | 600 |
| Code and configs (YAML, Dockerfile, SQL, bash) containing words like secret/token/key | 500 |
| Quoted attacks inside articles, tickets, support threads | 400 |
| Ordinary Hinglish chat / Indian-English business email | 600 |
| Long benign documents (≥ 2,000 tokens) | 400 |
| Reviews, summaries, transcripts (the carrier class for injection) | 400 |
| Multilingual ordinary chat in each of the 13 languages above | 900 |
| PII-dense but legitimate (forms, invoices, KYC templates, with fake data) | 300 |

All PII is synthetic. No real personal data, no real credentials.

## Rules

1. **Independence.** New text, written against the family list above, never copied
   from training corpora or from the existing batteries. Public benchmarks may be
   added as an *additional* set, reported separately, never merged.
2. **Group-awareness.** Each row carries `source` = generator batch id and
   `category`; paraphrases of one template share a `family` string. The split builder
   uses first-six-word families as a second safety net.
3. **Sealing.** `data/v19/sealed.jsonl` is written once, hashed, and never edited.
   It is scored once per finalist. Any re-authoring means a new file name and hash.
4. **Labels.** 14-class label from the production taxonomy plus `SAFE`; `language`
   (ISO-639-1, `hinglish`, or `mixed`); `direction` INPUT except a small OUTPUT slice
   (unsafe HTML/secret leak) that mirrors the existing output tier.
5. **Balance.** Attacks:benign ≈ 1:3. Balance inside attacks across families
   (±20%), not across rows.

## How it is generated

- **Drafting pool:** one LLM (configured in Colab) drafts rows from per-family,
  per-language prompt templates; a second pass rewrites each row in a different
  register (email, ticket, review, chat, code comment) so wording is not one voice.
- **Verification:** every attack row is checked by a *different* model (or a
  rules-of-thumb script plus manual review of a 10% sample) against "does this
  actually attempt the described behaviour". Rows that fail are dropped, not
  relabelled.
- **Dedup:** exact + normalized dedupe inside the set; then `build-v19-splits.py`
  refuses any family overlap with train.
- **Provenance:** every row keeps `generator`, `batch`, `language`, `family`,
  `verified_by`, `created_at`. The manifest records model ids and counts — never keys.

## Acceptance of the set itself

- ≥ 1,200 attacks, ≥ 4,000 benign, every minimum in the tables met.
- Zero family overlap with train (builder enforces).
- 10% manual review: ≥ 95% label agreement; failures listed in the manifest.
- Per-language benign count ≥ 300 for the 13 required languages.
- Hash recorded in `data/v19/sealed.manifest.json` and quoted in every evaluation report.

## What this set cannot prove

It cannot prove absence of bias in the generator, and it is not a third-party
benchmark. For any "best in class" claim, the public benchmarks in
`datasets/external/` and the competitor arms must agree; otherwise the claim is
reported as "on our sealed set only".
