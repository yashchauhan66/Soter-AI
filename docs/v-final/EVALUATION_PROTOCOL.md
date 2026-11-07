# Soter evaluation protocol — implementation contract

**Status: planning contract for Phase 2, not a completed evaluation or release gate.** Phase 1 recovery fixes are being verified separately. No learned weights, calibration or production policy are changed by this protocol.

## 1. Targets must remain distinct

Report three separate targets rather than one ambiguous “attack score”:

- **Content risk:** the artifact's categorical taxonomy, including PII and secrets. Benign intent does not imply absence of PII.
- **Instruction attack:** direct/indirect injection and the mapped related security families. PII alone is not an instruction attack.
- **Effective policy outcome:** whether the full configured guard should flag/block/redact the case after trusted exceptions and contextual policy. A classifier-only adapter cannot certify this target.

Authorized literal pairs have identical raw text and different trusted policy metadata. The raw classifier probabilities should remain identical unless policy conditioning is explicitly part of a future architecture. Do not train contradictory raw-text labels merely because a private whitelist differs.

## 2. Case contract

Each case retains an immutable ID, original text or ordered role-tagged turns, exact source identity, source row ID, licence/provenance status, declared language, source/template family, slice memberships, categorical truth when available and an explicit target/outcome. Preserve source labels and identifiers verbatim; mappings are additional named fields, not silent repairs.

Policy cases also retain direction, trusted ignored literals/entities, expected effective findings/action, and expected preservation/redaction of exact occurrences. Text inside a document cannot authorize a policy exception.

Missing language stays `unknown`. Missing family/provenance is a coverage defect, not evidence of independent examples. Importers must record how categories become slices; heuristic mappings are provisional, reviewable and never silently presented as verified labels.

## 3. Required slices and probes

| Slice | Required positive and negative coverage |
|---|---|
| Direct injection | Instruction override, jailbreak/role-play, system-prompt extraction; ordinary role instructions and quoted analysis as negatives |
| Indirect injection | Documents, webpages, email, tool output and RAG carriers; genuine content to summarize/retrieve as negatives |
| Obfuscation/evasion | Base64, hex, ROT13, leet, homoglyphs, zero-width characters, token splitting, markup/structured-data/code-comment carriers; harmless encodings as negatives |
| Multilingual/code-mixed | Hindi, Hinglish, Spanish, French, German, Arabic, Chinese and explicitly reported additional languages; benign counts separately for every language |
| Multi-turn/many-shot/long context | Event history and flattened-view adapters labelled separately; buried events at 4k, 8k, 16k and 32k reference-token lengths, plus long benign contexts |
| Agent/tool use | Tool-call/MCP context and exfiltration intent, with legitimate tool use as negatives; no actual command execution or outbound exfiltration |
| PII/secrets/policy | Synthetic values, exact trusted exceptions, repeated values, overlapping identifiers and a second unapproved value; approved PII must not waive injection or secrets |
| Benign hard negatives | Security education, pentest discussion, support/KYC context and code/quotes containing alarming words |
| Reasoning-heavy | Context-dependent intent and multi-step interpretation, with labelled benign counterparts; classification accuracy is not proof of general reasoning ability |
| Recall/rare families | Explicit family taxonomy, long-tail counts and publication/source dates where available |
| Robustness | Grouped paraphrases, fixed defensive suffix fixtures, typos, whitespace/case noise; parent/variant IDs and flip statistics |

Every named slice is present in the results schema even when unpopulated. Empty or one-class slices return undefined metrics with a reason, not invented zero FPR or perfect PR-AUC.

Long-context length is measured by a declared reference tokenizer and also recorded per artifact. Report processed token ranges, truncation, unscanned ranges and window caps. Never silently label a truncated single-message probe as full 32k context coverage.

## 4. Dataset partitions and sealing

Keep unit fixtures, diagnostic/development data, train, validation/calibration and untouched release data separate. A new hand-authored diagnostic is not a public benchmark or independently verified release test.

Sealing writes to a new path, rejects an existing destination, and records raw bytes, ordered case IDs, schema/importer identities, grouping policy and hashes. Evaluation refuses edited/incomplete inputs. The split builder requires source/template families and connected near-duplicate groups, not row-level random splitting or only first-six-word matching.

Decontaminate against all baseline and prospective training sources AND frozen teacher train/calibration/selection exposure. Record exact, normalized, lexical near-duplicate and embedding checks with thresholds and positive controls. Unknown source lineage and unaudited semantic overlap block an independence claim. Do not tune thresholds, select architectures or mine hard negatives from the release set.

The existing `data/v19/sealed-plan.jsonl` is a plan filename, not proof of an accepted release holdout. Its text was not read for this planning catalog.

## 5. Existing model inventory

Use all entries in `docs/v-final/MODEL_LINEAGE.csv`, with smoke, backups and tokenizer-only locations explicitly distinguished. Include recovered v18 and additional locations from `MODEL_ARTIFACT_LOCATIONS.csv` without relabelling duplicate locations as independently trained versions.

Every entry gets a result or an explicit unusable/metadata-only/duplicate/unsupported-contract status with measured evidence. Do not fabricate predictions for broken ONNX files. Legacy nine-class arms can still be scored on compatible binary targets, but absent categorical labels are recorded as unsupported, never remapped to SAFE. Missing calibration is not silently replaced with a claimed calibrated model.

## 6. Common inference contract

Use identical original cases, outer normalization/serialization, context-view/window policy, maximum sequence policy, hardware, provider, threads, batch size and decision definitions across arms. Native artifact tokenizers remain part of each model; forcing MiniLM token IDs onto a different multilingual vocabulary is not an apples-to-apples test.

Validate labels, required input/output names, dtypes/shapes and finite probabilities. Count referenced external ONNX data in size and fingerprint the entire effective model/tokenizer/label/calibration bundle. Research-runtime loading is distinct from production trust/signature acceptance.

Temperature already baked into exported logits is not applied again. Use predeclared shared operating points for the baseline comparison; calibrated per-model operating points must be selected on validation only and reported separately. Cache reuse requires exact matching identities, case order, settings and runtime; do not repair mismatched raw hashes with canonical aliases.

## 7. Metrics

For each target, model, operating point and slice report support, confusion counts, precision, recall, F1, FPR, FNR, average precision, trapezoidal precision–recall AUC and binary ECE. Name AP versus trapezoidal PR-AUC explicitly. Add categorical confusion/support and per-label metrics where supported.

Denominator-free rates are null with a reason. Validate score ranges, label/score alignment, ties and edge cases. Calibration applies to the target probability being evaluated, not whichever unrelated categorical confidence is largest.

Bootstrap paired case/family units with a fixed seed and report the resampling unit. Missing trustworthy families limits independent uncertainty claims. Keep diagnostic confidence intervals separate from predeclared final significance tests. Never claim significance from a tiny hand-picked cohort.

## 8. Latency and resources

Record cold load, tokenization, feed construction/forward, rules, policy/postprocessing, network and persistence separately when available. Benchmark warm batch-one requests, realistic batches and concurrency as different experiments. Store actual samples, p50/p95/p99, sample counts, host/provider information, memory method and complete model bytes.

Alternate/balance arm order and padding modes where practical. Record contention and failures instead of dropping slow requests. Tiny-sample p99 is diagnostic, not an SLO certification. CPU, GPU and real-serving rows remain `not_run` until actually exercised.

## 9. Full-policy adapters and regressions

The real synchronous rules core, ONNX augmentation plus policy, n8n local engine, mocked cloud seam, authenticated server, IDE guard-core and browser paths are separate adapters. Name what each probe executes and omits. Do not send test load, credentials or synthetic adversarial requests to production without the release/deployment step.

Required regression pairs include:

- Approved PII alone: preserve the exact value and remove only its effective PII enforcement signal.
- Approved PII plus injection/secret: retain the independent security decision.
- Two occurrences of unapproved PII: redact both while checking scoring deduplication separately.
- Approved value plus a distinct unapproved value: redact/flag only the latter as appropriate.
- Spanless ML PII, policy review ceilings and advisory-only findings: record real final-action behavior, not a assumed fix.

## 10. Public benchmark licence gate

Candidate suites named by the request include deepset prompt-injections, PINT-style sets, BIPIA, AgentDojo, JailbreakBench, HarmBench-adjacent, Lakera/public data and OWASP-mapped fixtures. None is declared used by this protocol. Before import, retrieve the exact version/source and dataset licence, distinguish code from data licences, and map what a text classifier can actually measure. Record unsupported agent/attack-success targets. Report each public suite separately from internal diagnostics and the sealed release set.

## 11. Current catalog evidence and gaps

`artifacts/ml/v-final/phase2/input_catalog.json` is a read-only, programmatically checked catalog of 18 primary locations and six candidate local batteries. It records real hashes/counts/declared languages and metadata gaps; it contains no new inference scores.

All six candidate batteries lack a declared family field and slice memberships in the catalog. Local data licences and semantic independence remain unestablished by that catalog. These are development candidates, not accepted release data. No `eval_harness/` implementation was present at catalog capture.

## 12. Phase 2 completion criteria

- Runnable `eval_harness/` with tested import/schema validation, metric edge cases, strict identity/cache checks, grouping/leakage checks and real inference adapters.
- Actual baseline results/status for every inventoried entry, identical cases/settings, explicit coverage matrix and all requested metrics.
- Working policy/long-context/robustness probes with measured output, not only descriptive templates.
- Public suite/version/licence table stating exactly what was used versus not run.
- Honest remaining release-set, family/semantic decontamination, GPU and real-server gaps; no v-final promotion before later release evidence.
