# MODEL_CARD — v-final candidate A execution package

## Status

**No trained v-final model exists in this deliverable. Genuine training, pretrained export, three-seed/ablation measurements and final comparisons: NOT RUN. `release_ready=false`.** Tiny random-model unit optimization/export receipts are not learned Soter evidence. Do not deploy this card or a UNIT-ONLY fixture as a model.

## Intended experiment

Defensive Soter classifier with a MiniLM L6 backbone, native 14-way task labels, supervised CE plus optional temperature-scaled KL distillation, train-only hard-negative upsampling, validation-only multiclass temperature/risk-threshold selection and optional checked dynamic INT8 ONNX export. The implementation uses Hugging Face's sequence-classification head, not an asserted byte-compatible reconstruction of historical Soter MLP weights. Compare this architectural difference explicitly.

SAFE is index 0; risk = `1-softmax(logits)[0]` for the exported graph because temperature is baked into its logits. **Never apply exported temperature a second time.** Preserve labels/tokenizer/calibration/preprocessing identity with the model. Policy/whitelist interpretation stays outside the raw classifier.

## Evidence and limits

- Dataset sources, source licenses, observed support and actual training compute: fill from the accepted build's generated DATA_CARD/manifest; no invented counts here.
- Native fixture tests exercise actual random PyTorch/HF optimization, exact interrupted resume, validation calibration, ONNX checker/ORT parity and INT8. They do not establish T4 throughput or pretrained parity.
- Colab dependency releases are metadata-verified but the pinned Linux environment was not installed/exercised locally. Native checks use different installed versions; see execution receipts.
- Local resource floors: disk 933930572 bytes, genuine-model available RAM 5368709120 bytes. Genuine execution remained blocked by measured RAM. No floors were lowered.
- 512-token truncation does not solve long-context/many-shot attacks. All required long-context and multilingual slice gates still apply and may fail.
- Exact/lexical lineage audit does not establish semantic contamination freedom. Distillation can reproduce teacher bias, calibration can drift and quantization can fail parity. Tiny scaled-logit INT8 was actually rejected in one retained fixture attempt; do not waive tolerances.
- Historical recovered models remain historical. No claim to beat every model/axis is supported. Noninferiority is not superiority; paired confidence bounds and multiple-comparison caveats must accompany claims.

## Product integration boundary

This is a quarantine/research export, not a production signing manifest. Existing model loading, trust/signature, total bundle size, tokenizer compatibility and endpoint-specific policy gates must remain enabled. Python ORT success is not Node ORT, API, n8n or IDE acceptance.

The actual product whitelist conflicts remain unresolved outside this scope: restored text can retain effective PII risk, and repeated PII may be only partly redacted. Prototype classifier/policy fixtures are not production fixes. Require exact authorized occurrence filtering, all unapproved-occurrence redaction, unchanged injection/secret findings, and effective findings/action/text assertions through every actual consumer.

## Release/rollback

Fill model/data/tokenizer/calibration/export identities, seed metrics, ablations, real-serving latency/memory/size and signed-review links only from actual runs. Use a new versioned bundle, read-only shadow evaluation, then separately approved canary promotion with tenant opt-in and minimal retention. Keep immutable v14-compatible rollback artifacts and threshold/policy identities; route back on policy regression, FPR drift, SLO violation or trust failure. Do not automatically promote from the offline gate's JSON. The package verifier proves byte membership, not model efficacy or deployment approval.
