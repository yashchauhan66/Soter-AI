# DATA_CARD — v-final execution recipe

**Status: genuine dataset assembly NOT RUN. No release independence certificate.**

`python -m vfinal_pipeline build accepted-input.json NEW_DATA_DIR` produces actual train/validation/holdout JSONL, a hash-bound manifest and a generated DATA_CARD with source pins, split counts, label/language/slice distributions and quarantine reasons. Input template: `configs/v-final/input.template.json` (deliberately not accepted).

## Target and representation

Preserve the 14 native labels from `models/ml-classifier-v14/labels.json`, SAFE at index 0. Do not collapse training into binary SAFE/attack. Risk evaluation uses `1 - P(SAFE)`; injection-specific evaluation and native multiclass confusion remain separate required downstream measurements. PII presence is not inherently malicious intent. Private tenant whitelist decisions are policy outcomes, not contradictory labels for the same raw text.

`Case` rows retain exact IDs, raw text OR ordered turns, source/version/family, provenance, verified license, language and declared slices. Multi-turn model text is `[role]\ntext` joined by newlines. Only the leakage audit normalizes NFKC/case/whitespace. Training truncation is tokenizer-first 512 tokens, not a claim of 4k–32k reasoning.

## Admission and source review

For every source record in `sources`, require `{path, sha256, bytes, role, license, accepted}`. Paths are portable and relative to the input manifest. Roles: development, frozen_holdout, exposure. Records need matching verified licenses. Include original data plus separately accepted hard negatives, indirect/agent/tool cases, obfuscation, multilingual/Hindi/Hinglish, long-context and rare families only after source/license/label adjudication. No external corpora are bundled or downloaded automatically.

Before a genuine notebook run, additionally require `privacy_review: "accepted"` on every source and `exposure_audit_complete: true`. This is a reviewed declaration, not machine proof. Exposure sources must enumerate every baseline/teacher train, calibration, validation, selection and mining input—including translated/mutated descendants. Test-only/benchmark-restricted licenses must not enter training. Whitelist policy records are quarantined from raw classifier training; preserve the original source separately for real policy evaluation.

## Leakage and label controls

- Verified raw SHA256/byte pins before decoding. Strict finite JSON, duplicate-key and Unicode checks inherited from common/Case contracts.
- Exact/normalized duplicates plus trusted source-family/parent/variant connectivity are grouped before splitting. Connected development records touching holdout are removed. Declared baseline/teacher exposure touching holdout rejects the build.
- Exhaustive shared character-5-gram candidate Jaccard audit; threshold 0.8 by default. Candidate-budget exhaustion rejects rather than certifying a partial audit. This is potentially expensive on large corpora; increase resources or perform an independently reviewed equivalent audit. It is not semantic/paraphrase deduplication.
- Contradictory exact normalized labels quarantine the whole connected development component; contradictions involving holdout reject. Missing development labels are quarantined, never invented as SAFE. Class balance uses train-only inverse-frequency CE weights, not evaluation reweighting.
- Deterministic family-grouped train/validation split. Frozen holdout never enters teacher selection, training, distillation, mining, threshold or temperature selection.
- Mining reports train-only IDs/predicted class, no raw text; only those IDs can be upsampled in the next training stage. New independently sourced cases need another reviewed, versioned data build, not an append to a frozen run.

## Privacy, access and deletion

Use consented/minimized data with synthetic or irreversibly de-identified PII; retain no tenant secrets in checkpoints/logs. Secure accepted corpora and Drive access. Follow source license and tenant retention limits. Separate incident evidence from the research corpus. Do not send raw prompts to W&B or a third-party labeler by default. Never publish source text in model cards or mined-error reports.

## Unresolved acceptance

Semantic-near-duplicate review, public benchmark licenses, adjudicated genuine source sizes/distributions, teacher exposure completeness and independent holdout adequacy are **NOT RUN/not established here**. A caller setting `accepted=true` cannot replace review. Require at least 200 risk and 200 benign records in every required release slice/language. Empty or attack-only slices do not produce invented zero FPR/ECE.
