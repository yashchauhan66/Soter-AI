# SoterAI Detection Architecture v2

Status: **design**. Supersedes the implicit architecture in `lib/guard/analyze.ts`.
Written 2026-08-06 against measured evidence, not intuition.

## 0. Why this document exists

The current stack measures **73.4% recall / 5.3% FPR** on a clean, leak-free
cross-distribution set (`datasets/crossdist-eval-v2.jsonl`, 1,721 rows). The
attribution of those errors is what forces a redesign:

| | Count | Caused by |
|---|---|---|
| False positives | 67 / 1274 | **rules tier: 67 (100%)**, ML tier: 0 |
| Missed attacks | 119 / 447 | semantic attacks regex cannot express |
| Hard BLOCKs on benign | **48 of 67** | single regex, no corroboration |

Two independent failures, opposite directions, same root cause: **a single
pattern match is treated as proof.**

### The defect that proves it

`promptInjectionDetector.ts:71` — "Emergency authority pressure":

```
/(?:professional|doctor|nurse|police officer|law enforcement|government|hostage|icu|patient)
 .{0,180}
 (?:die|lives depend|every second|immediately|exact lethal dosage|specific chemical formula)/i
```

No `\b` anywhere. Verified matches on benign encyclopedic text
(`scripts/ml/_probe-fp-substring.ts`):

| Benign text | `icu` matched | `die` matched |
|---|---|---|
| "particularly high average against the West Indies" | part**icu**larly | In**die**s |
| "the Tampa Bay Rowdies… professional soccer team" | — | Row**die**s |
| "Féthière drew a handgun… Chery Die" | — | **Die** (surname) |

This rule declares `score: 40, severity: HIGH` and reaches a `BLOCK` floor via
aggregate score. A user asking about cricket statistics gets hard-blocked because
`icu` is a substring of `particularly`.

This is not a tuning problem. It is an architecture problem: **nothing in the
pipeline can override a confident-looking rule, and no gate prevents a rule from
being written this way.**

---

## 1. Design principles

1. **Evidence, not verdicts.** A detector reports what it saw and how sure it is.
   It does not choose an action. Only the decision layer chooses actions.
2. **Severe actions require corroboration.** One low-precision signal can never
   reach BLOCK alone. Independent agreement is the currency.
3. **Cheap before expensive; escalate only on doubt.** Regex → encoder → LLM. Most
   traffic must never touch a paid tier.
4. **Every rule carries a measured precision.** A rule with no measured FP rate on
   a benign corpus is untrusted by default, not trusted by default.
5. **The defect class must be unrepresentable.** Word-boundary bugs are caught by a
   build gate, not by review.
6. **Fail-open on infrastructure, fail-closed on policy.** A model timeout must not
   block a customer's traffic; a confirmed credential leak must not pass.
7. **Provenance is a first-class input.** (Already correct today — keep it.)

---

## 2. Target pipeline

```
                        ┌─────────────────────────────────┐
  text + provenance ──▶ │ T0  NORMALIZE + CHEAP REJECT    │
                        │ unicode fold, length, encoding  │
                        │ hard signals: secrets, PII,     │
                        │ invisible ctrl chars            │
                        └───────────┬─────────────────────┘
                                    │ deterministic, high-precision
                                    │ → these MAY act alone
                                    ▼
                        ┌─────────────────────────────────┐
                        │ T1  SIGNATURE EVIDENCE          │
                        │ ~40 regex detectors             │
                        │ emit Evidence{confidence, prec} │
                        │ ✱ NO action authority ✱         │
                        └───────────┬─────────────────────┘
                                    ▼
                        ┌─────────────────────────────────┐
                        │ T2  ENCODER CLASSIFIER (ONNX)   │
                        │ always runs on INPUT            │
                        │ independent opinion, not a      │
                        │ rubber stamp for T1             │
                        └───────────┬─────────────────────┘
                                    ▼
                        ┌─────────────────────────────────┐
                        │ T3  FUSION + DECISION           │
                        │ corroboration rules             │
                        │ calibrated → action             │
                        └───────────┬─────────────────────┘
                                    │ only if UNCERTAIN band
                                    ▼
                        ┌─────────────────────────────────┐
                        │ T4  LLM JUDGE (semantic)        │
                        │ cost-gated, last resort         │
                        │ closes the 119 misses           │
                        └─────────────────────────────────┘
```

### Why T2 runs always, not only when T1 is silent

Today the semantic layer is *skipped* when a rule already fired
(`RULE_SECURITY_TYPES` in `analyze.ts:47`). That makes the model unable to
contradict a rule — so all 67 rule FPs are structurally unreachable by the model
that would have cleared them. **The model must always get a vote.** Skipping it is
a latency optimization that costs 100% of our false positives.

---

## 3. The Evidence contract

Detectors stop returning findings that imply severity. They return:

```ts
interface Evidence {
  type: RiskType;
  label: string;
  /** 0–1. How strongly THIS detector believes it, on its own. */
  confidence: number;
  /**
   * Measured precision of this rule on the benign control corpus.
   * null = never measured = treated as LOW. This is the field that makes
   * "icu inside particularly" unable to block anyone.
   */
  precision: number | null;
  /** Independent of other detectors? Leet/compact variants of one rule are NOT. */
  family: string;
  matchedSpan: [number, number];
  why: string;
}
```

**`family` fixes the variant double-count.** Today "Emergency authority pressure",
"… (leet)" and "… (compact)" each fired 5× on the *same three* prompts and each
counted as independent corroboration — one bad rule got three votes. Same
`family` ⇒ one vote, highest confidence wins.

---

## 4. Fusion rules (T3)

```
effective_weight = confidence × (precision ?? LOW_PRECISION_DEFAULT)
```

| Action | Requirement |
|---|---|
| `BLOCK` | a T0 hard signal, **or** ≥2 distinct `family` evidences with effective_weight ≥0.7, **or** 1 evidence ≥0.9 precision **and** T2 agrees |
| `HUMAN_REVIEW` | 1 evidence ≥0.7 effective weight, or T2 high-confidence alone |
| `REWRITE` / `REDACT` | mitigatable spans only |
| `ALLOW` | otherwise |
| → `T4` | T1 and T2 **disagree**, or aggregate lands in the uncertain band |

**T1/T2 disagreement is the highest-value signal in the system.** It is exactly
where both our FPs (rules say attack, model says benign) and our misses (model
uneasy, rules silent) live. Today that signal is discarded. It should be the
primary trigger for the semantic tier — and the primary source of training data.

Monotonicity from today's `decisionEngine.ts` is **kept**: more evidence must never
soften a verdict. That design is sound; it is the *inputs* that are wrong.

---

## 5. Build gates (make the bug class impossible)

| Gate | Enforces |
|---|---|
| `guard:lint:rules` | every alternation of a short (<6 char) literal is `\b`-anchored; fails the build otherwise |
| `guard:precision` | every rule has a measured precision on the benign corpus; new rule with no measurement cannot claim >LOW |
| `guard:corpus` | benign corpora have clean provenance (the `inthewild-regular` rule) |
| `guard:diff:decisions` | existing monotonicity contract — keep |
| `guard:core` | core hybrid recall ≥99% (v6 regressed to 95.8% and was rolled back) |

`guard:lint:rules` alone would have caught `icu`/`die` before it ever shipped.

---

## 6. Migration order (safe, measurable, reversible)

Each step is independently shippable and independently measurable. **Never change
two tiers at once** — that is how v6 became unattributable.

| # | Step | Expected effect | Risk |
|---|---|---|---|
| 1 | Add `\b` boundary lint + fix the rules it flags | FPR 5.3% → ~2-3%, recall flat | very low || 2 | Collapse leet/compact variants into `family` | removes phantom corroboration | low |
| 3 | Add `precision` field; measure all rules on benign corpus | no behaviour change yet | none |
| 4 | Stop skipping T2 when T1 fires | model can now clear rule FPs | medium — measure |
| 5 | Switch decision to effective-weight fusion | FPR → ~1-2% | medium — full eval |
| 6 | Route T1/T2 disagreement to T4 | closes semantic misses | needs paid provider |
| 7 | Retrain on real-human corpora for **recall only** | recall 73% → 85% | measure vs 5.3% baseline |

Step 1 is the highest value-per-hour work available in the entire program: it costs
no training, no provider, and no recall.

---

## 7. Step 1 is validated, not hypothetical

`scripts/ml/lint-detector-boundaries.py` is built and finds **1,059 unanchored
groups with 1,700 corpus-proven collisions** across the detector suite.

The lint does not guess. It loads the benign corpus (12,525 distinct words) and
reports only literals it can *prove* occur as an **infix** of a real benign word,
naming the word. Two earlier heuristic versions were discarded for being unusable:
length-ranking gave 1,898 findings, substring-matching gave 1,218 — mostly harmless
inflections (`dump` in `dumped`). Requiring an infix separates morphology from
genuine collision:

```
'stop' inside chriSTOPher, dySTOPian      'evil' inside dEVIL, bellEVILle
'log'  inside anthoLOGy, mycoLOGy         'tell' inside inTELLigence
'etc'  inside streETCar, skETCHer         'user' inside troUSERs
```

**Measured on the one rule fixed so far** (`promptInjectionDetector.ts:71`,
anchored both alternations):

| | Before | After |
|---|---|---|
| FPR | 5.3% (67/1274) | **4.9% (62/1274)** |
| Recall | 73.4% (328/447) | **73.4% (328/447)** |

5 false positives removed, **zero recall lost**, one line changed. That is the
thesis of this document confirmed on real data: the precision problem is a rules
defect, and fixing it costs no detection.

1,058 groups remain. Not all will yield an FP — the lint proves the *literal*
collides, which is necessary but not sufficient for the *rule* to fire. Each fix
must be measured, not assumed.

---

## 8. What this does NOT claim

- **It does not close the Lakera gap by itself.** Their advantage is Gandalf — a
  live feedback loop of millions of real human attempts. Architecture cannot
  manufacture data. Steps 1-6 fix precision; only step 7 and real telemetry move
  recall.
- **Lakera's internal architecture is not public.** The tiering above is derived
  from our own measurements, not reverse-engineered from theirs. Any claim about
  what Lakera runs internally is speculation and must not appear in marketing.
- **No number here is verified except the measured ones** (73.4% / 5.3% / 67 / 119).
  The "expected effect" column is a hypothesis to be tested, not a result.
