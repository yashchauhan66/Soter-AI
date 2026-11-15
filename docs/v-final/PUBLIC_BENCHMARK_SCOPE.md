# Public benchmark scope and licence gate

**Scope only — not completed public evaluation and not a Phase 4 research brief.** All eight families are `used=false`, `run_status=not_run`; zero dataset records imported/scored and no weights downloaded. Readiness below is limited to future offline **diagnostic**, never release, imports with stated conditions.

## Eight-family gate

| Family / primary source | Retrieved immutable revision | Code versus data licence | Text / labels | Offline import gate and task boundary | Actual status |
|---|---|---|---|---|---|
| 1. [deepset prompt-injections](https://huggingface.co/datasets/deepset/prompt-injections) | `4f61ecb038e9c3fb77e21034b22511b523772cdd` | Code N/A; data **unresolved**: top-level Apache-2.0 versus nested CC-BY-4.0; org-member CC-BY grant does not resolve current precedence.[11][16] | Public `text`, numeric `label`; metadata: train 546/test 116.[50] | **Blocked** pending licence precedence; detector labels need import-time confirmation. Related classifier has 0 LEGIT / 1 INJECTION, not a data licence.[46] | `used=false / not_run` |
| 2. [PINT-style](https://github.com/lakeraai/pint-benchmark) | `0efab3f463eae9c823130d8faffb71b2e7c06e63` (harness) | Code MIT; **full-data licence/access unresolved**; mixture of public/proprietary inputs.[12][13] | Official data not publicly distributed; permission case-by-case; public YAML format `text/category/label:boolean` only.[34][13] | **Blocked**; no public full-PINT subset URL. BYO/toy format use is not official PINT evaluation. | `used=false / not_run` |
| 3. [JailbreakBench / JBB-Behaviors](https://huggingface.co/datasets/JailbreakBench/JBB-Behaviors) | `886acc352a31533ffbcf4ef22c744658688086fc` (data; code pin in catalog) | Code MIT; selected dataset explicitly MIT in its own card/LICENSE.[17][18][20] | `Goal` text; harmful/benign split labels describe behavior, not injection.[17][48] | **Source-ready, adapted diagnostic only**; no jailbreak success without target responses/judging. Attack artifact repo not cleared.[19] | `used=false / not_run` |
| 4. [HarmBench-adjacent](https://github.com/centerforaisafety/HarmBench) | `8e1604d1171fe8a48d8febecd22f600e462bdcdd` | Code MIT; **data grant unresolved** in retrieved README/LICENSE; no imputation from code licence.[22][21] | Text behavior CSV paths verified in metadata; rows/schema not downloaded; dataset-doc body empty.[23] | **Blocked** for data grant/schema. Generative completion evaluation cannot be replaced by native prompt classification.[21] | `used=false / not_run` |
| 5. [BIPIA](https://github.com/microsoft/BIPIA) | `a004b69ec0dd446e0afd461d98cb5e96e120a5d0` | Code MIT; explicit all-parts clause with dataset exceptions; attack templates/EmailQA MIT, TableQA/CodeQA CC-BY-SA-4.0; other contexts require source terms.[24][28] | Attack JSON + EmailQA JSONL; derive attack/clean text labels, not QA-answer labels.[28] | **Source-ready only original MIT templates + EmailQA**; other components withheld. Upstream Evals MIT verified; no full five-task ASR.[39][27] | `used=false / not_run` |
| 6. [AgentDojo](https://github.com/ethz-spylab/agentdojo) | `089ed468cf3ed0322acc66b0211f26d9d90dbf60` | Code MIT; **fixture/trace-specific data grant unresolved** in retrieved evidence; not a prohibition finding.[26][25] | Public suite/task/fixture metadata; no standalone gold binary detector corpus verified.[36][51] | **Blocked** for fixture licence/text adapter; dynamic tool/state utility or targeted ASR unsupported by a classifier.[25] | `used=false / not_run` |
| 7. [Lakera official Gandalf set](https://huggingface.co/datasets/Lakera/gandalf_ignore_instructions) | `04737b65e90a6794ec227012e4a255a7def6344b` | Dataset explicitly MIT; no separate harness licence claimed.[29] | `text/similarity`, train 777/validation 111/test 112; automated weak positives with acknowledged noise, not binary gold labels.[49][29] | **Source-ready, weak-positive diagnostic only**; no specificity/balanced accuracy or Gandalf success from this set. | `used=false / not_run` |
| 8. [OWASP LLM Top 10 mapped fixtures](https://github.com/GenAI-Security-Project/GenAI-LLM-Top10) | **2026**, `9253e38ade58e959b531c0c5c9a4842272c9cd0e` | Awareness/source content CC-BY-SA-4.0; no executable benchmark/data harness licence claimed.[40][42] | Guidance/example scenarios, not a retrieved labelled corpus; no fixtures created.[40][45] | **Blocked for fixture import**; guidance adaptation may proceed under CC-BY-SA obligations, but mapping is not a coverage result. | `used=false / not_run` |

## Fetch handles, not fetched data

`artifacts/ml/v-final/phase2/public-suite-sources/catalog.json` contains full code/data commits, verified revision-metadata API URLs, exact file handles, `download_executed=false`, source IDs and component-specific conditions. The pinned deepset metadata API was actually read; dataset import remains blocked by the licence conflict.[50][11]

For deepset, the suggested conditional handle is `datasets.load_dataset('deepset/prompt-injections', 'default', revision='4f61ecb038e9c3fb77e21034b22511b523772cdd', split='test[:32]')`; **not executed, not licence-cleared**. For official full PINT there is no verified public data handle; the pinned example YAML path exists but is toy-only and its data licence was not inferred from MIT code.[14][34]

**Source-ready families:** JailbreakBench (behavior-text task adaptation only); BIPIA (original MIT templates + EmailQA only); Lakera official Gandalf (noisy positive-only).[17][24][29] This does not assert chain of title, grant release approval, supply labels/adapters, or execute a benchmark.

## OWASP edition-qualified mapping, not coverage

The current official release retrieved is **2026**, published August 4, 2026; do not silently reuse the 2025 ordering (notably Excessive Agency, Hidden Context Exposure and Unbounded Consumption). Names below come from the pinned official source; classifier limits are this project's scope decisions.[40]

- **LLM01:2026 Prompt Injection**[40] — Text injection indicators only; exploit/agent effects unmeasured; no fixture/run.
- **LLM02:2026 Sensitive Information Disclosure**[40] — Disclosure-request text only; actual leakage unmeasured; no fixture/run.
- **LLM03:2026 Excessive Agency**[40] — Privileged-action request text only; permissions/tools/state unmeasured; no fixture/run.
- **LLM04:2026 Supply Chain**[40] — Dependency/model provenance controls not measured by text detection; no fixture/run.
- **LLM05:2026 Data and Model Poisoning**[40] — Training/data integrity and backdoors not measured; no fixture/run.
- **LLM06:2026 Unbounded Consumption**[40] — Resource budgets/denial-of-service not measured; no fixture/run.
- **LLM07:2026 Misinformation**[40] — Factual correctness and grounding not measured; no fixture/run.
- **LLM08:2026 Hidden Context Exposure**[40] — Hidden-context extraction-request text only; actual exposure unmeasured; no fixture/run.
- **LLM09:2026 Vector and Embedding Weaknesses**[40] — Malicious retrieved-text indicators only; vector-store access/isolation unmeasured; no fixture/run.
- **LLM10:2026 Improper Output Handling**[40] — Output validation/rendering/downstream exploitation not measured; no fixture/run.

## Limits and licence discipline

- Generic repository code licences were never imputed to dataset licences; unresolved means no adequate explicit data grant verified in the retrieved evidence, not proof that a grant cannot exist. Current deepset card conflict and PINT restricted access are positive evidence of their respective blockers.[11][34]
- JBB harmful requests are not synonymous with prompt injection; Gandalf similarity is not a success label; BIPIA needs a clean/injected text adapter.[17][29][28] Preserve raw labels, sources, splits and copyright/licence notices; validate schemas and third-party overlap before scoring.
- A native classifier can score text detection only. It cannot establish tool execution, targeted ASR, actual leakage, jailbreak success, robust refusal, multimodal robustness or all-ten-OWASP coverage.
- No data/weights downloaded, installations, uploads, production traffic or benchmark/model inference calls. Public documentation/metadata APIs were read. Empty HarmBench dataset docs and capped AgentDojo recursive metadata were handled by marking gaps and using narrower metadata; unsuccessful exploratory URLs are not supporting citations.
- Parent owns permission resolution, imports/adapters and all metrics/runs. Store any permitted subsets separately as diagnostic material; never silently mix public suites into release data or tune against them as held-out evaluation.

## Artifact and verification handles

- Report: `docs/v-final/PUBLIC_BENCHMARK_SCOPE.md`
- Catalog: `artifacts/ml/v-final/phase2/public-suite-sources/catalog.json`
- Ledger: `artifacts/ml/v-final/phase2/public-suite-sources/ledger.json`
- Append-only family-batch history: `family_batches.json`; Python verified exactly eight unique requested families.
- Evidence: `evidence.json`, saved `sources/*.txt`; generated Sources block below.
- Exact SHA-256 hashes and real verification output: `SHA256SUMS.json`, `verification.json` in the same artifact directory (hash manifest excludes itself and verification output to avoid self-reference).

```bash
py -3.12 'C:/Users/USER/AppData/Local/hermes/skills/research/grounded-citations/scripts/sources.py' --ledger 'C:/Users/USER/OneDrive/Desktop/Ai-Agent-Security-Guard/artifacts/ml/v-final/phase2/public-suite-sources/ledger.json' verify 'C:/Users/USER/OneDrive/Desktop/Ai-Agent-Security-Guard/docs/v-final/PUBLIC_BENCHMARK_SCOPE.md' --evidence
```

## Sources

[11] https://huggingface.co/datasets/deepset/prompt-injections/raw/4f61ecb038e9c3fb77e21034b22511b523772cdd/README.md — deepset prompt-injections pinned dataset card
[12] https://raw.githubusercontent.com/lakeraai/pint-benchmark/0efab3f463eae9c823130d8faffb71b2e7c06e63/LICENSE — Lakera PINT pinned code licence
[13] https://raw.githubusercontent.com/lakeraai/pint-benchmark/0efab3f463eae9c823130d8faffb71b2e7c06e63/README.md — Lakera PINT pinned official README
[14] https://api.github.com/repos/lakeraai/pint-benchmark/git/trees/0efab3f463eae9c823130d8faffb71b2e7c06e63?recursive=1 — Lakera PINT pinned repository file metadata
[16] https://huggingface.co/api/datasets/deepset/prompt-injections/discussions/2 — deepset maintainer original data licence clarification
[17] https://huggingface.co/datasets/JailbreakBench/JBB-Behaviors/raw/886acc352a31533ffbcf4ef22c744658688086fc/README.md — JailbreakBench JBB-Behaviors pinned dataset card
[18] https://huggingface.co/datasets/JailbreakBench/JBB-Behaviors/raw/886acc352a31533ffbcf4ef22c744658688086fc/LICENSE — JailbreakBench JBB-Behaviors pinned dataset licence
[19] https://raw.githubusercontent.com/JailbreakBench/jailbreakbench/23dbdf6b19650521604456229bc1d9c4156c85c1/README.md — JailbreakBench pinned framework README
[20] https://raw.githubusercontent.com/JailbreakBench/jailbreakbench/23dbdf6b19650521604456229bc1d9c4156c85c1/LICENSE — JailbreakBench pinned code licence
[21] https://raw.githubusercontent.com/centerforaisafety/HarmBench/8e1604d1171fe8a48d8febecd22f600e462bdcdd/README.md — HarmBench pinned official README
[22] https://raw.githubusercontent.com/centerforaisafety/HarmBench/8e1604d1171fe8a48d8febecd22f600e462bdcdd/LICENSE — HarmBench pinned repository code licence
[23] https://api.github.com/repos/centerforaisafety/HarmBench/git/trees/8e1604d1171fe8a48d8febecd22f600e462bdcdd?recursive=1 — HarmBench pinned repository file metadata
[24] https://raw.githubusercontent.com/microsoft/BIPIA/a004b69ec0dd446e0afd461d98cb5e96e120a5d0/LICENSE — Microsoft BIPIA pinned explicit code and dataset licences
[25] https://raw.githubusercontent.com/ethz-spylab/agentdojo/089ed468cf3ed0322acc66b0211f26d9d90dbf60/README.md — AgentDojo pinned official README
[26] https://raw.githubusercontent.com/ethz-spylab/agentdojo/089ed468cf3ed0322acc66b0211f26d9d90dbf60/LICENSE — AgentDojo pinned repository code licence
[27] https://raw.githubusercontent.com/microsoft/BIPIA/a004b69ec0dd446e0afd461d98cb5e96e120a5d0/README.md — Microsoft BIPIA pinned official README
[28] https://raw.githubusercontent.com/microsoft/BIPIA/a004b69ec0dd446e0afd461d98cb5e96e120a5d0/benchmark/README.md — BIPIA pinned context data provenance and acquisition instructions
[29] https://huggingface.co/datasets/Lakera/gandalf_ignore_instructions/raw/04737b65e90a6794ec227012e4a255a7def6344b/README.md — Lakera Gandalf pinned explicit dataset card and licence
[34] https://raw.githubusercontent.com/lakeraai/pint-benchmark/0efab3f463eae9c823130d8faffb71b2e7c06e63/benchmark/pint-benchmark.ipynb — Lakera PINT pinned access restrictions and evaluation notebook documentation
[36] https://api.github.com/repos/ethz-spylab/agentdojo/contents/src/agentdojo/default_suites?ref=089ed468cf3ed0322acc66b0211f26d9d90dbf60 — AgentDojo pinned benchmark suite file metadata
[39] https://raw.githubusercontent.com/openai/evals/main/LICENSE.md — OpenAI Evals official upstream invoices source licence
[40] https://raw.githubusercontent.com/GenAI-Security-Project/GenAI-LLM-Top10/9253e38ade58e959b531c0c5c9a4842272c9cd0e/README.md — OWASP pinned current release source README and content licence
[42] https://raw.githubusercontent.com/GenAI-Security-Project/GenAI-LLM-Top10/9253e38ade58e959b531c0c5c9a4842272c9cd0e/CITATION.cff — OWASP pinned edition identifiers and explicit content licence
[45] https://raw.githubusercontent.com/GenAI-Security-Project/GenAI-LLM-Top10/9253e38ade58e959b531c0c5c9a4842272c9cd0e/2026/final/LLM01_PromptInjection.md — OWASP LLM01 2026 pinned canonical risk and example scenarios
[46] https://huggingface.co/deepset/deberta-v3-base-injection/raw/main/config.json — deepset official linked classifier label metadata only; not model weights
[48] https://huggingface.co/api/datasets/JailbreakBench/JBB-Behaviors/revision/886acc352a31533ffbcf4ef22c744658688086fc — JBB-Behaviors verified revision-pinned metadata API handle
[49] https://huggingface.co/api/datasets/Lakera/gandalf_ignore_instructions/revision/04737b65e90a6794ec227012e4a255a7def6344b — Lakera Gandalf verified revision-pinned metadata API handle
[50] https://huggingface.co/api/datasets/deepset/prompt-injections/revision/4f61ecb038e9c3fb77e21034b22511b523772cdd — deepset prompt-injections verified revision-pinned metadata API handle
[51] https://api.github.com/repos/ethz-spylab/agentdojo/contents/src/agentdojo/default_suites/v1/workspace?ref=089ed468cf3ed0322acc66b0211f26d9d90dbf60 — AgentDojo pinned workspace fixture and task file metadata
