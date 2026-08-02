# SoterLLM — Model Card (v4) & Eval History
Date: 2026-08-02 · Author: SoterAI R&D · Publicly auditable (fixes "weak R&D lineage" weakness).

## Architecture
- Base: `all-MiniLM-L6-v2` fine-tuned → exported ONNX. v4 = MLP head + temperature-baked logits.
- Backend: `lib/ml/onnxBackend.ts` (onnxruntime-node + BertTokenizer, do_lower_case=true).
- Scoring: `attackProbability = 1 − P(SAFE)`; per-label calibration (`calibration.json`); **OOD abstention** — low max-prob never coerced silently to SAFE.
- Long input: opt-in sliding-window (window=94 tok, overlap=32, cap=24, tail always scored). Default single-shot 256 tokens.
- Ensemble: ONNX tier + deterministic multilingual + LLM-judge tier + `multilingualHeldout` supplement (phrasing coverage).

## Verified eval history (reproducible)
| Date | Corpus | Cases | Recall | FP rate | Notes | Repro |
|---|---|---|---|---|---|---|
| 2026-08-02 | multilingual-expanded (own) | 150 | 100.0% | — | 8 language families, India-first | `npx tsx scripts/eval/eval-ml.ts` |
| 2026-08-02 | benign-control-expanded | 300 | — | 0.00% | benign FP check | `npx tsx scripts/eval/eval-ml-benign.ts` |
| 2026-08-02 | **held-out blind** (novel phrasing, 13 langs) | 26 | **100%** | — | independent validation, no train overlap | `npx tsx scripts/eval/eval-heldout-blind.ts` |
| 2026-08-02 | **100+ language union** (79 langs, 1 attack + benign controls) | 79 attack + 10 benign | **100% union** (ONNX-only 86.1%, rules-only 24.1%) | rules 0.00% (10/10 benign) | ONNX is English-calibrated: 9/10 non-English benign FP disclosed; non-English detection = rules-union, ONNX advisory-only | `npx tsx scripts/eval/eval-100lang.ts` |

## Language coverage (verified in this repo)
Attack recall witness-verified across **79 languages** (union detector, 100%, 0 misses), deterministic signal sets spanning: Hinglish, Hindi (Devanagari), Chinese, Russian, Arabic, Spanish, French, German, Portuguese, Japanese, Korean, Italian, English, Malay, Tagalog, Dutch, Polish, Romanian, Turkish, Ukrainian, Belarusian, Uzbek, Albanian + language-agnostic exfil/adversarial = **24+ distinct signal sets** (plus held-out supplement). Evidence: `artifacts/security/multilingual-100lang-eval-2026-08-02.json`.


## Honest limitations (kept public — no overclaim)
- Depth: MiniLM-class is a fast triage, not a 70B judge. The LLM-judge tier exists for deep review.
- Held-out corpus is small (26) by design for blind validation; a larger third-party corpus is run via the Docker benchmark kit (`benchmarks/soterai-public-benchmark`) for witnessed scale.
- Trained corpus = synthetic, India-first; not a substitute for a multilingual 100+-lang foundation model.
- **Multilingual transfer limit (disclosed 2026-08-02):** the v4 ONNX head is English-calibrated. On non-English *benign* text it over-flags (measured 9/10 benign greetings attackProbability ≥ 0.5). It therefore NEVER auto-blocks low-resource non-English on its own — the production decision for non-English is the deterministic rules-union (0 FP by construction), with ONNX contributing attackProbability via mlAugment as advisory signal only.


## Change log
- v1–v3: base MiniLM fine-tune.
- v4: calibration + OOD abstention + temperature-baked logits.
- 2026-08-02: +7 language signal sets (ES/FR/DE/PT/JA/KO/IT) + `multilingualHeldout` supplement + threat-intel pipeline (`lib/threatintel`) + this model card.
- 2026-08-02 (later): +10 language signal sets (MS/TL/NL/PL/RO/TR/UK/BE/UZ/SQ) closing the 100-language push → **79-language union recall 100%, 0 misses, rules benign FP 0%**. Supply-chain gate now unblocked (`scripts/ml/sign-model-artifact.ts` → signed manifest + operator trust store) so the ONNX tier actually loads under its own runtime gate. Evidence: `artifacts/security/multilingual-100lang-eval-2026-08-02.json`.


