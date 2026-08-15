# Review — SELF-IMPROVING-ML-ARCHITECTURE-RESEARCH.md, against measurement

**Date:** 2026-08-08
**Reviews:** `docs/research/SELF-IMPROVING-ML-ARCHITECTURE-RESEARCH.md`
**Status of that doc:** unmodified. This is a companion review, not an edit.

The design in that doc is sound and its ten citations are real. This file records
the places where a **measurement taken after it was written** contradicts it, plus
one security issue. Everything below cites an artifact or a source line.

---

## Finding 1 — the premise is no longer the bottleneck (biggest one)

§1 says: *"root cause: static model ek fixed snapshot hai"* — i.e. recall is low
because the model has not seen new attacks, so continuous retraining is the fix.

Measured on `datasets/crossdist-eval-v3.jsonl`, 3,987 stratified rows, production
path (`analyzeText` → `augmentWithMl`, `mlTierRan 3987`, `mlErrors 0`):

| config | recall | FPR | misses |
|---|---|---|---|
| semantic margin **0** (shipped) | 77.39% | 5.23% | 694 |
| semantic margin **−0.10** | **96.71%** | 5.45% | **101** |

`artifacts/ml/margin-sweep/full-m010.json`. Of the 694 misses at margin 0, **603
were the semantic-benign veto** — the model had already predicted the attack and a
**threshold** threw the prediction away. Attribution of the 101 that remain:

```
abstention       52
safe-label       39   <- the ONLY true model failures
semantic-benign  10
```

**39 of 3,069 attacks = 1.27% are "the model did not know".** That is the entire
ceiling a retraining loop can reach on this corpus. The threshold change delivered
**+19.32 points for 2 extra false positives in 918 benign rows.**

This does not make the flywheel wrong. It re-orders it: **fix what the gates
discard before building a machine to teach the model things it already knows.**
The doc's own Phase 0 (ship the eval gate) survives this unchanged and is still
the correct first step.

---

## Finding 2 — §4A's abstention-floor advice cannot fire

§4A: *"jahan max-probability < threshold (e.g. abstention floor 0.55)"* → route to
the uncertain queue.

`lib/ml/calibration.ts:175`:

```ts
const decisionConfidence = Math.max(pAttack, 1 - pAttack);
```

`max(p, 1−p)` is **≥ 0.5 for every possible p**. So a floor at or below 0.50 is
inert, and v7's shipped 0.55 (`models/ml-classifier-v7/calibration.json:24`) fires
only in the two-point band 0.50–0.55. An active-learning queue keyed on that floor
would be nearly empty and would look like "no drift" when nothing was being
sampled.

What actually abstains is the entropy budget on the next line:
`binary_entropy_p95 = 0.20287663` (`calibration.json:23`), which requires
**pAttack ≥ 0.9683** to pass. That is the knob to sweep. The comment at
`calibration.ts:170-174` already states this; §4A predates it.

### Swept, 2026-08-08 — the bound was right and the lever is small

The budget had no override, so it could not be swept without editing a shipped
model artifact. `SOTERAI_ML_ABSTAIN_ENTROPY` / `SOTERAI_ML_ABSTAIN_FLOOR`
(`calibration.ts`) now mirror `SOTERAI_ML_SEMANTIC_MARGIN`: read per call, inert
unless set, and falling back to the fitted value on empty or unparseable input
rather than failing open. Four runs at margin −0.10 on the frozen 3,987 rows,
rules-only baseline byte-identical at `42.07 / 4.79` in all four, so the rows are
provably the same:

| entropy budget | recall | FPR | Δrecall | ΔFPR | abstention misses |
|---|---|---|---|---|---|
| 0.2029 (fitted, shipped) | 96.71% | 5.45% | — | — | 52 |
| 0.30 | 96.90% | 5.56% | +0.19 | +0.11 | 46 |
| **0.40** | **97.10%** | **5.56%** | **+0.39** | **+0.11** | 40 |
| 0.6932 (disabled) | 97.52% | 6.21% | +0.81 | +0.76 | 25 |

`artifacts/ml/abstain-sweep/`. Reading:

- **0.40 is the operating point.** Half the available recall for one-seventh of
  the FPR cost, inside `promotionGate`'s +0.5 budget.
- **0.30 is dominated** — same 7 false positives as 0.40, less recall.
- **Disabling it entirely fails the gate.** The last 15 attacks cost 6 extra
  false positives; +0.76 FPR exceeds +0.5.
- The predicted ≤1.7 pt ceiling held: the real ceiling is **+0.81**, and the
  deployable part is **+0.39**.

### Confirmed on rows 0.40 was NOT selected on

The four runs above all scored the same 3,987 rows the budget was chosen on, so
they cannot tell selection from signal. Re-run on the **18,694-row complement**
of `crossdist-eval-v3.jsonl` (disjoint by NFKC fingerprint from every sweep row),
stratified to 4,250, rules-only baseline identical at `40.28 / 6.35` in both:

| entropy budget | recall | FPR | abstention misses |
|---|---|---|---|
| 0.2029 (shipped) | 96.38% | 7.26% | 53 |
| **0.40** | **97.14%** | 7.62% | 28 |

**It holds, and the two errors point in opposite directions.** The recall gain
*doubles* on held-out rows (+0.76 vs +0.39), so the selection figure understated
it. The FPR cost *triples* (+0.36 vs +0.11) — still inside the +0.5 budget, but
with a thinner margin than the selection rows implied. In counts: **+24 attacks
for +4 false positives**, a 6:1 trade against 12:1 on the selection half.

Report the held-out pair, not the selection pair. And note the complement rows
are genuinely harder — rules-only recall 40.28% vs 42.07% at a higher 6.35% FPR —
so this is a distribution shift, not merely a resample.

So §4A's queue is worth building on the entropy signal, but the *detection* value
of retuning this gate is roughly one fiftieth of the semantic-margin fix. Order
accordingly.

---

## Finding 3 — the "what you already have" table (§6) omits the biggest asset

§6 lists `lib/threatintel/` (actual paths: `lib/threat-intel/index.ts` and
`lib/security/threatIntel.ts`), calibration, the black-box test, and the freeze
script. It misses the one component that makes minute-scale learning feasible:

**`lib/guard/semanticClassifier.ts` is already a frozen encoder + kNN retrieval
layer running synchronously in the guard hot path.**

- `embed()` (:119) — 512-dim, FNV-1a feature hashing over word uni/bigrams plus
  char 3–5-grams, L2-normalized. Deterministic, synchronous, dependency-free.
- `maxSimilarityPacked()` (:216) — nearest-prototype cosine over 1,085 prototypes.

The prototypes are hand-written seeds (`lib/guard/semanticSeeds.ts`, 16 families,
915 attack + 170 benign). Making that memory **learned instead of hand-written**
looked like the smallest change in §7 needing no GPU.

**Measured 2026-08-08: do not do it.** See Findings 6 and 7 — the gate those
prototypes feed is guarding 6 benign rows, and a trained linear head over the same
`embed()` space already bounds what any prototype scheme there can reach. What
survives from this finding is the *retrieval* argument, not the detection one:
`embed()` remains a fast, deterministic index, which is a different job than
scoring requests.

---

## Finding 4 — LoRA + EWC (§4E, Phase 2) is the wrong tool for "har minute"

Not wrong in general — wrong for the stated clock. EWC is a **soft quadratic
penalty**; it makes forgetting expensive, not impossible. The doc concedes this
("forgetting almost zero"). At minute cadence there is no validation window in
which to discover that "almost" mattered, and this repo has the receipt for
what that costs: **v4 was newer than v3 and measured worse** — 51.29% vs 57.93%
recall on identical rows, 529 misses to abstention alone.

The line the doc misses is **Analytic Continual Learning**: freeze the backbone,
update a linear head by **recursive least squares**. Closed-form, gradient-free,
exemplar-free, and *provably identical* to ridge regression retrained jointly on
all data seen — the forgetting term is algebraically absent, not penalized.

- Zhuang et al., **ACIL: Analytic Class-Incremental Learning** (NeurIPS 2022)
- follow-ups: REAL, DS-AL, GACL, Analytic Subspace Routing

Implemented and proven here: `lib/ml/continuousLearning/analyticHead.ts`.
`tests/ml/analytic-head.test.ts` asserts equality with a **dense Gauss-Jordan
solve to 1e-9**, plus order-independence and an explicit non-forgetting stress
test (teach a class, then 200 updates of a different class, old class still wins).
Measured cost **2.887 ms/sample at d=512** on CPU, in-process, over a real
109,054-row pass — about **20,800 samples/minute**, so "every minute" is real at
this tier.

**The throughput claim survives. The detection claim does not.** Measured
2026-08-08, `artifacts/ml/analytic-head-eval.json` and
`...-margin0.json` (`scripts/ml/eval-analytic-head.ts`), head trained on all
109,054 rows, 0 dropped as eval leak, scored through the real production path
(`mlTierRan 3987`, `mlErrors 0`), threshold selected on even rows and reported on
odd:

| held-out half | recall | FPR | rescued : new FPs |
|---|---|---|---|
| production @ margin 0 | 76.53% | 5.66% | — |
| **+ head** | **80.38%** | 6.32% | **59 : 3** |
| production @ margin −0.10 | 96.54% | 6.10% | — |
| **+ head** | 96.74% | 6.75% | **3 : 3** |

Read those two rows together, because either alone misleads. The head **does**
carry real signal: at the shipped margin it rescues 59 misses for 3 false
positives, roughly a 20:1 trade. But **50 of those 59 are
`SYSTEM_PROMPT_LEAK_ATTEMPT`** — the same rows the semantic-benign veto
discards. The margin change reaches those rows too, recovers far more of them
(**+19.32 pts vs +3.85**), and costs less FPR to do it (**+0.22 vs +0.66**).

**So the head is not useless; it is dominated.** It competes with a cheaper fix
for the same rows and loses on both axes, and once that fix is applied it has
almost nothing left to rescue (3 rows). `promotionGate` returns **REJECT** on
`fpr-regression` at both margins (+0.66 and +0.65 against a +0.5 budget) —
a harder failure than the expected shadow-evidence HOLD. The head alone is
14.7% recall / 0.65% FPR at its selected threshold and 88.86% / 29.08% at
threshold 0: real signal, nowhere near precise enough to sit over the stack.

It is not a tier. LoRA+EWC remains the right tool for the *slow* tier, on the
weekly clock the doc gives it.

---

## Finding 5 — §5's poisoning row is backwards (security issue)

§5 mitigates poisoning with: *"uncertain queue only from low-conf (**not
attacker-controlled**)"*.

Low confidence is exactly the region an attacker **can** steer into. Crafting
input that lands in the uncertain band is cheaper than crafting a working attack:
you are optimizing toward a decision boundary, not past it. So uncertainty
sampling does not reduce attacker control of the queue — it **concentrates** it.

Correct framing: the queue is untrusted **by construction**; safety comes from
the labelling policy, not from where rows came from. Implemented in
`lib/ml/continuousLearning/harvest.ts`:

- `SOURCE_TRUST` (types.ts:44) — `customer-traffic` and `public-feed` are
  `untrusted` regardless of confidence.
- `decideLabel()` — an untrusted source may **never** auto-assign `benign`. The
  two errors are not symmetric: a wrong `attack` label costs precision, which
  every FPR gate already measures; a wrong `benign` label **silently deletes a
  detection class** and no eval set notices if the shape is novel.
- An untrusted `attack` label requires **corroboration** from two independent
  detectors, so one spoofable signal cannot inject rows either.

---

## Finding 6 — the semantic-benign veto guards a population that is 99.8% attacks

Finding 1 showed the veto costs 21.74 recall points and framed the fix as moving
the margin. That was right about the remedy and wrong about the reason. Measured
2026-08-08 on the frozen 3,987 rows through the real production path
(`scripts/ml/measure-veto-operating-auc.ts`, `mlTierRan 3987`, `mlErrors 0`),
with the margin forced to −10 so the veto never fires and the rows that would
have reached it can be counted:

```
population reaching the veto:  2912 attacks,  6 benign
```

The veto is the LAST gate in `passesPrecisionGate` (`mlAugment.ts:163`). By the
time it runs, the label allowlist, the abstention check and the confidence floor
have already removed **912 of 918 benign rows**. It is a precision gate positioned
where there is almost no precision left to win.

What it does to the rows it judges:

| margin | attacks vetoed | benign vetoed |
|---|---|---|
| 0.00 (shipped) | **945 (32.5%)** | **2 (33.3%)** |
| −0.02 | 318 (10.9%) | 0 |
| −0.05 | 103 (3.5%) | 0 |
| −0.10 | 11 (0.4%) | 0 |

**At the shipped margin it discards 945 true positives to block 2 false ones.**
It vetoes attacks and benign at the same *rate* (32.5% vs 33.3%) — it is not
selecting, it is decimating.

This independently corroborates Finding 1 from a second instrument: removing the
veto was measured to cost +0.22 FPR, which is exactly 2 rows in 918. The two
measurements agree on the same 2 rows.

### What this is NOT evidence for

- The AUC on that population is **0.4727**, but it is computed against **6 benign
  rows** and is statistically meaningless at that sample size. Do not cite it. The
  population composition and the 945:2 trade carry this finding; the AUC does not.
- Over *all* 3,987 rows the decision variable scores **AUC 0.5187** (attack mean
  0.007 vs benign 0.004, `artifacts/ml/semantic-veto-separation.json`). That is a
  fair measurement of the variable, but the veto never sees most of those rows, so
  it bounds the *classifier*, not the gate.
- **The benign evidence here is thin by construction.** 6 rows cannot tell us what
  the veto does to real benign traffic where the model false-positives more often.
  Deleting the gate outright is therefore a shadow-test decision, not an
  arithmetic one. Lowering the margin is the reversible version of the same move.

### Consequence for the semantic tier generally

`analyze.ts:432` trusts `classifySemantic().isAttack` as a **detector**, which
requires `margin >= MARGIN_THRESHOLD` (0.07, `semanticClassifier.ts:47`) — above
the p95 of real attack margins (0.050). Measured: it flags **59/3069 attacks
(1.92%)** against 9/918 benign (0.98%). Roughly 2:1, but at a rate low enough
that the tier is nearly dark in production.

---

## Finding 7 — learned prototypes (§6 / Finding 3's proposal) are bounded by the same space

Finding 3 proposed replacing the 1,085 hand-written prototypes with learned ones
over `embed()`. That is now measured as unnecessary, without building it, because
the ceiling is already known:

`scripts/ml/eval-analytic-head.ts:149` trains on `embed(row.text)` — the **same**
512-dim hashed-n-gram space the prototypes occupy — over 109,054 rows. A learned
linear separator is strictly more expressive than nearest-prototype cosine, so its
measured performance upper-bounds any prototype scheme in that space. It reached
**88.86% recall at 29.08% FPR** (threshold 0) and 14.7% / 0.65% at its selected
threshold.

So the binding constraint is the **feature space**, not the seed selection. Better
prototypes over `embed()` cannot beat a trained linear head over `embed()`, and
that head is already too imprecise to sit over the stack (Finding 4).

Combined with Finding 6, the prototype work is doubly unnecessary: the gate it
would improve is guarding 6 benign rows.

**This does not condemn `embed()` for its other job.** Feature hashing is a fine
*retrieval* index, and Finding 3's throughput argument stands. What it cannot do
is carry a precision decision over a transformer's output.

---


- **§7 Phase 0 first.** Gate before loop. `promotionGate.ts` implements it:
  fail-closed, golden-set hash match required, `maxRecallDropPts: 0`, and an
  explicit `training-overlaps-golden-set` REJECT.
- **"auto-learn, gated-deploy — not auto-deploy"** (§7 honesty note). Correct, and
  consistent with `workers/threatIntelWorker.ts:8`, which deliberately refuses
  remote auto-import.
- **§4D replay buffer + hard negatives.** Still right for the slow tier.
- **§4F per-class regression guard.** This is precisely what would have caught the
  v3→v4 regression.

## Suggested re-ordering of §7

| | doc | evidence-ordered |
|---|---|---|
| 1 | Phase 0 eval gate | Phase 0 eval gate *(unchanged)* |
| 2 | Phase 1 active-learning queue | **Threshold/gate sweep** — measured +19.32 pts, done |
| 3 | Phase 2 LoRA+EWC (4-6 wks) | **Analytic head** — minutes, exact guarantee, built, **measured: dominated by the margin fix** |
| 4 | Phase 3 drift detector | Phase 1 active-learning queue, keyed on **entropy**, not the inert floor |
| 5 | Phase 4 shadow/canary | Phase 3/4 drift + shadow *(unchanged)* |
| 6 | Phase 5 red-team | LoRA+EWC on the **weekly** clock |
| — | *(learned prototypes, Finding 3)* | **dropped** — Findings 6 & 7 close it as unnecessary |

Three of the six candidate levers here have now been measured and **two came back
negative** (analytic head, learned prototypes). That is the eval gate working as
intended: it is cheaper to disprove a lever than to ship it and discover the
ranking moved on paper only.

---

## Open, and not to be overstated

- The analytic head's detection value **was measured and it is dominated, not
  merely weak**: 59 rescues for 3 FPs at margin 0 but only 3 for 3 at −0.10,
  because the margin change already reaches those rows for less FPR.
  `promotionGate` REJECT at both. `artifacts/ml/analytic-head-eval.json`. Do not
  describe it as a shipping tier. What it retains is a proven throughput budget
  for the *labelling/retrieval* role in Finding 3 — a different job than scoring
  requests, and still unmeasured.
- **Learned prototypes over `embed()` are closed as measured-unnecessary**
  (Finding 7), on a ceiling argument rather than an attempt: the trained head over
  the same space bounds them, and Finding 6 shows the gate they feed is guarding
  6 benign rows.
- **The veto's benign evidence is 6 rows.** Findings 6's recommendation is to lower
  the margin, not delete the gate, precisely because 6 rows cannot support a
  deletion. Anyone proposing removal needs shadow traffic first.
- Margin −0.10 is **not deployed**; production default is still 0.
- Against `protectai/deberta-v3-base-prompt-injection-v2` on identical rows,
  SoterAI **loses as shipped** (74.57% vs 83.20%) and leads at −0.10 (96.31%,
  +6.96 F1, 5.5× faster) at a worse FPR — `artifacts/ml/samerows-v7-vs-protectai.json`.
- **Lakera is unmeasured** and must stay unranked: closed API, no PINT run.
  `scripts/ml/benchmark-vs-lakera.py:20-21` forbids the claim.
