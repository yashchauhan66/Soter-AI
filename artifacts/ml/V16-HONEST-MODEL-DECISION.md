# SoterLLM v16 — Honest model decision

**Decision:** keep **v14 live**. v16 is a **NO-GO for deployment**.

This decision uses paired production-path measurements on the same rows. It does
not use the in-distribution validation score as deployment evidence.

## Artifact validity

The downloaded v16 ZIP was CRC-checked, extracted to
`models/ml-classifier-v16/`, signed, admitted by the supply-chain gate, and loaded
through the real production ONNX backend. The manifest contains all 10 datasets
and 152,012 rows. ONNX/PyTorch parity passed with worst max absolute logit delta
`3.28e-06`. These results are therefore from the intended v16 artifact, not a
dark ML tier or a mislabeled v14 retrain.

Artifact fingerprints:

- v14: `5b83b2810138c89bc74e7c9e7f86d913d69d27d4efb2b07ba349ed00dc4bf829`
- v15: `1350692161589b715f239b2a36f8ade689ab699661687c5f95c91173d7b6d37f`
- v16: `08b99181c9f24f200c67fe93180f8898766aea884eaeebe12aafc234a865e469`

## Canonical deployment gate (3,987 rows)

3,069 attacks / 918 ordinary benign, rules + ML production path:

| model | attack recall | ordinary FPR | caught | false positives |
|---|---:|---:|---:|---:|
| v14 | **97.52%** | 5.56% | 2,993/3,069 | 51/918 |
| v15 | 97.10% | 5.66% | 2,980/3,069 | 52/918 |
| v16 | 97.13% | **5.34%** | 2,981/3,069 | **49/918** |

Paired conclusions:

- **v14 vs v15:** attacks only b=21/c=8, p=0.0241 in v14's favour. v15 is
  significantly worse and also breaches the 5.6% FPR ceiling.
- **v14 vs v16:** overall b=24/c=14, p=0.1433 (no overall significant
  difference), but attacks only **b=21/c=9, p=0.0428 in v14's favour**. v16
  saves 2 ordinary false positives but loses 12 net attack catches. The security
  product cannot trade statistically significant attack recall for two benign
  rows and call that an improvement.

v16 per-label crossdist regressions: PROMPT_INJECTION 915/943 -> 907/943
(97.03% -> 96.18%), SYSTEM_PROMPT_LEAK 922/959 -> 919/959, JAILBREAK 234/241 ->
233/241. PII is flat at 922/926.

## Held-out instruments

These sets are adversarial diagnostics, not ordinary-traffic deployment FPRs.
Their small denominators are mandatory.

### 274-row broad battery (238 attacks / 36 hard benign)

| model | recall | hard-benign FPR |
|---|---:|---:|
| v14 | **219/238 (92.02%)** | 29/36 (80.56%) |
| v15 | 217/238 (91.18%) | 29/36 (80.56%) |
| v16 | 207/238 (86.97%) | **28/36 (77.78%)** |

v14-v16 attack disagreements: only v14 23 / only v16 11, p=0.0576. The set is
not large enough to cross 0.05, but the direction is against v16 and the losses
are concentrated: MULTI_TURN 27/29 -> 17/29; SYSTEM_PROMPT_LEAK 27/28 -> 22/28.

### 266-row multilingual/weak-tranche diagnostic (220 attacks / 46 hard benign)

| model | recall | hard-benign FPR |
|---|---:|---:|
| v14 | 157/220 (71.36%) | 24/46 (52.17%) |
| v15 | **181/220 (82.27%)** | 10/46 (21.74%) |
| v16 | 169/220 (76.82%) | **7/46 (15.22%)** |

v16 is statistically better than v14 overall here (b=22/c=51, p=0.000914),
driven mainly by 17 additional hard-benign rows allowed. Its attack-only gain is
not significant (b=21/c=33, p=0.1337), and MULTI_TURN regresses 8/18 -> 4/18.
This is useful precision progress, but it cannot override the canonical attack
regression.

### 70-row targeted v16 probe (56 attacks / 14 hard benign)

| model | recall | hard-benign FPR |
|---|---:|---:|
| v14 | **49/56 (87.50%)** | 4/14 (28.57%) |
| v15 | **50/56 (89.29%)** | 4/14 (28.57%) |
| v16 | 44/56 (78.57%) | **3/14 (21.43%)** |

v15-v16 paired attack movement: v16 fixed 1 attack and broke 7, p=0.0703. It
fixed TOOL_CALL_ABUSE 3/4 -> 4/4 and one benign Hinglish continuity FP, but the
increment's main target did not move: MULTI_TURN **5/8 -> 4/8** versus v15 and
7/8 -> 4/8 versus v14. It also regressed DATA_EXFIL 3/4 -> 2/4, MODEL_EXTRACTION
4/4 -> 2/4, and six language cells. This directly fails the v16-specific gate.

## Ranking

1. **v14 — production winner / keep live.** Best canonical attack recall and
   statistically beats both v15 and v16 on paired attacks. It remains below the
   5.6% ordinary FPR ceiling (51/918 = 5.56%).
2. **v16 — best precision checkpoint, but NO-GO.** Lowest canonical FPR
   (49/918 = 5.34%) and strongest hard-negative precision, but statistically
   worse attack-side than v14 and fails its own multi-turn/multilingual objective.
3. **v15 — NO-GO.** Significantly worse than v14 on canonical attacks and exceeds
   the ordinary FPR ceiling.

## Market comparison — what is and is not measured

The market harness restricts the task to the four labels all models claim to
cover: PROMPT_INJECTION, JAILBREAK, SYSTEM_PROMPT_LEAK and SAFE. It removes rows
colliding with SoterLLM training skeletons, uses the same 256-token input bound,
and scores identical rows within a run. This is narrower than SoterLLM's full
14-label threat model.

The fresh v16 run reached SoterLLM before the competitor process crashed:

- v16 raw ONNX + calibration: **97.85% recall, 1.97% FPR, 98.31% F1** on
  1,200 in-scope rows (743 attacks / 457 benign).
- ProtectAI DeBERTa v2: no fresh result; the Python process segfaulted immediately
  after loading weights.
- Meta/Llama Prompt Guard 2 86M: not reached after the ProtectAI crash.
- Lakera Guard: **not measured** — closed API-only product, no API key or
  downloadable weights available.

A prior completed market run exists on a 1,200-row set with the same label counts:
SoterLLM artifact 98.52% recall / 1.75% FPR / 98.72% F1; ProtectAI 79.81% /
3.50% / 87.72%; Prompt Guard 2 25.03% / 0.44% / 39.96%. Those numbers establish
that the harness can measure the open competitors, but they are **not a valid
fresh v16 head-to-head**: v16's added training skeletons alter the eligible-row
filter, so matching label counts do not prove matching row identities. They must
not be used to claim v16 beats those models.

**Honest market conclusion:** there is no completed like-for-like competitor
result for the internal winner v14 in this pass, and no Lakera measurement.
Therefore no “world best” or “beats Lakera” claim is supported. The defensible
claim is only: on SoterAI's canonical 3,987-row production-path evaluation, v14
is the best of v14/v15/v16 at 2,993/3,069 attack catches and 51/918 ordinary
false positives.
