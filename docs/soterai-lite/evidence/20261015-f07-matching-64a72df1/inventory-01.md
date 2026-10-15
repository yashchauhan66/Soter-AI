# F07 matching inventory 01

Date 2026-10-15. Read-only source review, same-lineage independence LOW. Facts are not executed PASS results or coverage promotion. No production/test edits, test execution, user secret/env-file scans, broker/GUI launch or network access. Only this new evidence file is written.

## Frozen scope

IMPLEMENTATION-PLAN.md:75 requires a shared bounded registered-value recognition engine for raw/base64/base64url/URL/hex/JSON escaped/quoted forms, provider patterns and entropy, request-local concatenation and false-positive controls. Flag: soterai.lite.secretMatching. Root must freeze thresholds/budgets before fixtures. Streaming and complete gateway integration remain F08/F15/F16; arbitrary cipher/private prose/cross-request detection are excluded.

## Actual reusable code

- packages/vscode-extension/src/secret-broker/OutputFilter.ts:12: the real managed output filter. Private containsKnownSecret at line 40 receives raw registered values; generates raw/base64/base64url/lower+upper hex/encodeURIComponent/JSON.stringify-inner forms; searches original text, parsed JSON string leaves and leaves.join(''). Input cap 128KiB UTF-8; JSON caps 10,000 nodes/depth32 and withholds when traversal exhausts. No explicit secret-count/value/total-variant budget or public fingerprint registry.
- secret-broker/EnforcedApiCapability.ts:253: actual caller passes [record.value] after approved transport and reference/release revalidation. This is the smallest existing registered-value consumer. runtime.ts:60 shares its OutputFilter instance; commands.ts:35 configures the separate capability release guard.
- packages/guard-core/src/detectors/SecretDetector.ts:73: canonical provider patterns and assignment-bound entropy. Exported detectSecrets/SECRET_DETECTOR_CLASSES. High-entropy assignment: >=32 value characters, entropy>=3.5, placeholder exclusions. Opaque credential: credential-named key, >=28 value characters, two lowercase/uppercase/digit classes, entropy>=3.6 and public/hash/test/etc key exclusions. Named-provider shapes use their own gates. Raw DetectorMatch.match must not be returned as an F07 public receipt.
- guard-core/detectors/EncodedSecretDetector.ts:27: base64/base64url/hex decoding followed by canonical detectSecrets. Constants decoded>=16, encoded>=24, 40 accepted candidates, >=90% printable ASCII. Recognition only, not arbitrary registered-value matching. Its comment mentions canonical re-encoding comparison, but implementation does not perform that comparison. Candidate cap counts accepted decodes and silently stops; it is not a complete work/completeness budget.
- guard-core/ContextRedactor.ts:11: direct redaction, NFKC/invisible removal, packed text, URI decode, hex/unicode escapes and base64/hex runs. Cap 1,048,576 JS code units, 256 candidates, 16KiB encoded runs. Transformed detection withholds the whole item because transformed offsets are not safely mapped to the original.
- guard-core/Redactor.ts: canonical redaction/survivor vocabulary, redactForSharing/findSurvivingSecrets. Reuse class vocabulary and evidence minimization instead of another provider list.
- secret-broker/SecretClassifier.ts:104: broker-specific references/PII/operations metadata. Its generic API pattern accepts bare32+ identifiers without all canonical false-positive gates; not the preferred new provider/entropy source.
- guard-core/HashCache.ts:125: hashExactContent is exact UTF-8 cryptographic SHA-256 with provider failure rejection. Legacy hashContent near148 normalizes whitespace/case and preserves a weak historical fallback; unsuitable for exact credential identity/authorization.
- guard-core/OutputLeakScanner.ts:38: canonical provider/exfiltration/canary composition with minimized findings. Options carry canaries/placeholder names, not arbitrary registered values.

## FingerprintVault search

No FingerprintVault.ts was found in the searched source filenames. Actual document fingerprint implementations exist at apps/extension/src/lib/fingerprint-matcher.ts and lib/ai-data-security/fingerprint.ts: NFKC/whitespace/lowercase normalization, 900-character chunks, five-word shingles, hash-overlap ratios, default minimum0.18. They are document DLP in browser/hosted paths, not byte-exact case-sensitive credential matching in canonical Lite. Do not import their hosted auth/database stack to satisfy F07.

## Packaged gateway paths

packages/soterai-lite/scripts/build.cjs:20 builds extension, apps/local-ai-broker/src/cli.ts and the MCP server. BrokerManager.ts:148 starts dist/local-ai-broker.js. The local broker depends on guard-core; no Full VM component is needed. packages/core/src/index.ts already reexports the guard-core ABI.

apps/local-ai-broker/src/BrokerServer.ts:648 routes OpenAI through normalizeMessages -> scanBrokerRequest -> serialized egress verification -> provider; Anthropic also includes system text. guard-core/BrokerScanner.ts:71 scans each message through DecisionEngine; role-prefixed joined text feeds canaries/survivors, not general registered-value concatenation. BrokerServer.ts:951/959 unsafePayload/serializeEgress uses survivor patterns, encoded detection, context redaction and canaries over actual forwarded JSON; no registered vault-value registry is passed.

Broker readJson near1052 defaults to1MiB, validates UTF-8 and JSON object input. DecisionEngine defaults to500,000 JS characters and blocks size-incomplete scans. Current local SSE code near738 buffers a complete bounded response before release. These are current facts, not F15/F16 acceptance.

lib/gateway/core.ts is a distinct hosted gateway with auth/policy/ML dependencies and documented scanner-error fail-open branches. It is not the Lite implementation to extend. Lite builder also rejects apps/privacy-controller/, project-privacy/capabilities/ and tier2-lite/ inputs.

## Smallest integration recommendation (API/thresholds not frozen here)

Add one host-free module under guard-core and export through its existing index. Compile finite registered representations once per bounded request/registry; compose canonical provider/entropy recognition; return value-free match/completeness metadata. Replace OutputFilter's private containsKnownSecret responsibility through that engine, retaining current release revalidation and withholding when the machine flag is off. This exercises an actual consumer without a new raw-read command, project env scanning or prematurely implementing F08/F16.

Freeze registration-count/value/representation/input/JSON/decode/concatenation/work budgets before fixtures. Incomplete scans must not return no-match. Preserve exact credential case/bytes; normalize only grammar-permitted encoded variants. Specify base64 padding, base64url, URI percent case/full encoding, JSON escaping/quoting and strict UTF-8. Bound request-local leaf ordering/concatenation and false positives; retain no prior-request state.

Public output should contain safe status/type/opaque IDs, not raw matches, fragments, value lengths, unkeyed value fingerprints or secret-bearing exceptions. Keep private registry material out of logs/Memento/vault metadata; no silent global loading of all projects' vault values. Same-host heap access is not isolation. Future F08/F16 can consume the engine with explicit short-lived registrations after their own card barriers.

## Source SHA-256 snapshot

Paths prefixed secret-broker/ below are under packages/vscode-extension/src; guard-core/ paths are under packages/guard-core/src.

| Source | SHA-256 |
| --- | --- |
| secret-broker/OutputFilter.ts | 5c21d867615ea5cf08876f4c4dc1594974be404e5372ebd4ee4c56f64116a94a |
| secret-broker/EnforcedApiCapability.ts | 3c0877982232d7e87ef85e07e97d17df30917460eab67232d2dfa2fdd0783f5f |
| secret-broker/SecretClassifier.ts | 43c8082ed0c5b62ea5143ef75dcc96750e906cfa5913517563ca939006810767 |
| secret-broker/runtime.ts | a60c6e3e6917f471e5e2c6a7a1d01440e7ad004666874c8608fb016bb91859c7 |
| guard-core/detectors/SecretDetector.ts | 8dfdd6f4931660c638be246f9e25e239c38908a9f4136c3d45960a3d8da9078b |
| guard-core/detectors/EncodedSecretDetector.ts | 020d43b0cc184290dc5c4a0415cf20740b5c16a87c152afab9c5f6fc6ded8eaa |
| guard-core/ContextRedactor.ts | 438d6ae62d12d1259dbe0c52e1ef9cdbd064a0c3c88454c03a059ba2401ef304 |
| guard-core/HashCache.ts | 1dcb8d57fdee9232bfc7f56a0270fc52891bf1d0c2a48a0a8639ff281ad262fa |
| guard-core/BrokerScanner.ts | 55e5050ba0a9798cdef18e54d66dc7ac0a6a2f4ec5e9da2d57680319519a1342 |
| apps/local-ai-broker/src/BrokerServer.ts | b38828d3d5b9f101fa6fe6def7775aa18420caf8a1dc0c061c2d7b29f3885a26 |
| packages/soterai-lite/scripts/build.cjs | 4c93829fa36d95d1cc1b24868144bce88899f390324ab023dff1f74c3fc73d98 |
| apps/extension/src/lib/fingerprint-matcher.ts | fd91765a96d808a491ac64abc24db95530b31fd7a121005208d5d194fbba03c4 |
| lib/ai-data-security/fingerprint.ts | b78572bcf5f7006d4d920ee6a141505a55802133332de842b7c4bd9c5cc9aa90 |
| lib/gateway/core.ts | f2f87282caa198c364fc57a1d8734fb29b8780dc06d92b8dac3720c4813f2989 |

Preparation failures retained as facts: probes of nonexistent packages/local-broker, packages/broker and build-lite.mjs were corrected to actual paths; Windows rg path/glob errors were not treated as proof of missing behavior. The first exclusive inventory writer exceeded Windows command-line length (CreateProcess error206) before process creation/file writing; this shorter base64 writer creates a new file only. No implementation/test gate ran.
