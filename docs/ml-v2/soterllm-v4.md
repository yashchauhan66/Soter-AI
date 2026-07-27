# SoterLLM v4 — Market-leading local AI security classifier

**Date:** 2026-07-23  
**Status:** Trainer + inference stack shipped; full weights require `npm run ml:train:v4` (CPU) or `npm run ml:train:v4:gpu`.

## Why v4 (honest gap analysis of v3)

| Area | v3 (production) | Problem | v4 fix |
|---|---|---|---|
| Head | Single `Linear(384→9)` | Under-capacity; over-defense on benign INPUT | LayerNorm + MLP `384→256→9` + binary attack head |
| Split | `random_split` (leaked) | ~35.8% val rows share train skeleton → fake 99% F1 | **Group-aware 3-way** train / cal / val |
| Calibration | None (raw softmax) | Confidence ≠ probability | Temperature scaling (baked into ONNX) + ECE report |
| Thresholds | Global floor 0.9 | One size fails per-family base rates | Per-label thresholds @ target FPR on cal split |
| OOD | Low conf → SAFE | Silent miss of novel attacks | Abstention flag + `attackProbability` fusion |
| Context | max_length 128 | Truncates multi-turn / long jailbreaks | max_length **256** |
| Loss | Plain CE | Class imbalance ~2.5:1 attack:safe | Class-balanced effective-number weights + focal + label smoothing |
| Honesty | Reported 99.29% val F1 | Not generalization | Manifest + group-aware metrics only |

Competitors (Lakera Guard, Prompt Security, Protect AI / HiddenLayer cloud APIs) are a **different product class** (hosted multi-GB models, network hop). SoterLLM v4 targets the **best local / on-prem / no-cloud** operating point: ~90MB ONNX, p95-friendly CPU inference, calibrated scores, fail-open ensemble with rules.

## Architecture

```
text
  → BertTokenizer (HF-parity WordPiece, lib/ml/bertTokenizer.ts)
  → MiniLM-L6-v2 encoder (mean pool)
  → LayerNorm
  → MLP head → 9-class logits / T   (T = fitted temperature, baked at export)
  → optional binary attack head (training only; ranking signal)
  → calibration.json thresholds + OOD abstain
  → lib/guard/mlAugment.ts precision gate (INPUT reliable labels + semantic not-benign)
  → at most HUMAN_REVIEW (never hard BLOCK alone)
```

**Labels (9):** SAFE, PROMPT_INJECTION, JAILBREAK, SYSTEM_PROMPT_LEAK_ATTEMPT, PII, SECRET, UNSAFE_OUTPUT, RAG_POISONING, DATA_EXFILTRATION_ATTEMPT.

## Train

```bash
# Smoke (CI / sanity, ~2 min CPU)
npm run ml:train:v4:smoke

# Full production (CPU, multi-hour on 4-core)
npm run ml:train:v4

# GPU (Colab / cloud)
npm run ml:train:v4:gpu
```

Artifacts in `models/ml-classifier-v4/`:

| File | Role |
|---|---|
| `model.onnx` (+ optional `.data`) | Inference graph (temperature-baked logits) |
| `labels.json` | index → label |
| `calibration.json` | T, per-label thr, OOD floor, ECE |
| `dataset_manifest.json` | rows, groups, split sizes |
| `eval_results.json` | **group-aware** val metrics |
| `training_stats.json` | full history |
| `tokenizer_config/` | vocab + HF tokenizer |

## Wire-up (production)

```bash
ML_BACKEND=onnx
ML_ONNX_MODEL_PATH=models/ml-classifier-v4/model.onnx
ML_ONNX_LABELS_PATH=models/ml-classifier-v4/labels.json
ML_ONNX_CALIBRATION_PATH=models/ml-classifier-v4/calibration.json
ML_ONNX_MAX_LENGTH=256
ML_ONNX_CONFIDENCE_FLOOR=0.9
ML_ONNX_ATTACK_PROB_FLOOR=0.85
SOTERAI_ML_AUGMENT=shadow   # then enforce after held-out verify
```

## Verify (honest)

```bash
npx tsx scripts/guard-benchmark/ml-v4-verify.ts
```

Reports rules-only vs v3 vs v4 gated recall / FPR on frozen held-out sets. **Do not** quote training val F1 as generalization.

## Safety contract (unchanged)

- ML never hard-BLOCKs alone → max HUMAN_REVIEW  
- Fail-open on model errors  
- INPUT precision gate: only injection / jailbreak / system-prompt-leak + semantic not-benign  
- Shadow mode default for rollout  

## What “best vs market” means here

| Claim we make | Claim we do **not** make |
|---|---|
| Best-in-class **local** calibrated 9-way AI-attack classifier with honest group-aware eval | “Better than Lakera cloud on all public benches without numbers” |
| Calibrated probabilities + per-label FPR control | 100% novel-attack recall |
| Ensemble lift over rules with bounded FPR | Replaces deterministic detectors |

Always attach the `ml-v4-verify.ts` numbers before any external competitive claim.
