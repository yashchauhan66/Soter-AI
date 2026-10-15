# F07 source review 01

Root self-review plus retained same-lineage delegate messages. Independence LOW. The delegate final note was INCOMPLETE due to usage-service failure; exact message retained separately. No independent/vendor/human or native test PASS is assigned by this note.

Concrete delegate findings: provider DetectorMatch contains raw `match`, so results reconstruct safe objects only; decoded coordinates conservatively map to original source spans; strict canonical UTF-8 and padding checks; nonrecursive original-input-only decoders; explicit work/candidate/byte limits; URL path encoded-value framing gap and unbounded duplicate-input loop. Root source preserves the safe projections and strict decoder controls. Reviewbefore01 captured six failures before hex-specific lexing/boundaries, HTTP path framing and pre-dedup byte accounting. Root R13 failing baseline then fixed canonical short values occupying explicit request parts.

Registry fields use ECMAScript private state, results are frozen metadata-only objects, callback errors become constant withholding. No file/env discovery is introduced. Real singleton starts unavailable until activation binds the machine/trust guard. Filter budgets and flag withdrawal return no response body through the actual capability consumer; transport audit remains sent because the approved operation already occurred. Existing deny and all-value safe-reader masking remain.

Self-test uses fresh synthetic values and mock transport only; returned results are booleans/case IDs/status, with finally revocation/deletion. Actual F07 host observations rely on those production self-test oracles and remain LOW; no external routing/streaming/isolation claim. This narrowed source read found no remaining concrete blocker; matching full/typecheck/artifact/native and affected-host evidence are separate required gates.

Current source SHA-256:
- packages/core/src/RegisteredSecretMatcher.ts: a4fafa75b3c9b30700221cd73f1df6c610eff142c8d6f39690db880d443f33c4
- packages/vscode-extension/src/secret-broker/OutputFilter.ts: 3c3df1fc16c15e5c11a7d6902ceb613412c8acdfc50ddefc0c7bbf784e4d8d46
- packages/vscode-extension/src/secret-broker/EnforcedApiCapability.ts: a0aff78c704769f71d1ff32c6a052ca95e218c32ddf62b6ef6ec89f746bd177b
- packages/vscode-extension/src/secret-broker/runtime.ts: a8405761e94852ccc8b84ae7c9e2ebe535b7fe0eb698f98cdcc1023f21ceab7c
- packages/vscode-extension/src/secret-broker/commands.ts: 2f792b609e40263d62a5a0d2aca54caae9c1b8e9639e138dd37c9a929afaa13e
