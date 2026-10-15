# F08 source follow-up review — evidence reviewer 02

Date: 15 October 2026. Independence **LOW** (same model lineage). Scope: updated core, actual OutputFilter consumer, runtime/command binding, synthetic production self-test and retained regression source. Read-only static inspection; no tests, native host, network or product execution. Only this unique evidence note was written.

**Result:** the four source findings in review01 are resolved in the inspected implementation. No further F08 core/consumer implementation blocker was found. One native evidence-scope wording correction remains below; exact-artifact/unit/native acceptance is still root's responsibility.

## Reviewed identities

| Source | SHA-256 |
| --- | --- |
| packages/core/src/StreamingOutputRedactor.ts | 428903846312dc93d3f30b0c3f976678d7a59b6f2458f1ecb5deffa9daf69dc8 |
| packages/core/src/RegisteredSecretMatcher.ts | b271fe9262f775fdc5802c5d0059018e524ee946a3d333d2ab6c36130aa92b36 |
| packages/vscode-extension/src/secret-broker/OutputFilter.ts | f3dd1f90a0878614dd0c2a61fbf1653712c49dc9cf8055e59436c716de9404bf |
| packages/vscode-extension/src/secret-broker/runtime.ts | b7bf74a43c117e4c30ecc8de8e2f68e56ac7816a2d63eca09876187ceda1a74d |
| packages/vscode-extension/src/secret-broker/OutputSelfTest.ts | d9927b247e174d486fe37b7dc50fd7807d99088490fbde446dac2227dd4e1edb |
| packages/vscode-extension/src/secret-broker/commands.ts | e695e31ece7d5d3eee65776f88950b8b2dc11651cb1833a4bd02586bcec2d34f |
| packages/vscode-extension/src/__tests__/streamingOutputRedactor.review.test.ts | 09c45b53361cfc5b9d96f856e7208b67b27eea854ec051e35aba4ca8c567d548 |
| packages/vscode-extension/src/__tests__/host/liteStreamingOutput.host.ts | 14da7947e1f13a5aaaeccf33d7056a1bceaa296814cb08e9f3d60cb9924d7f48 |

Runtime/source identities are working-file measurements, not loaded-memory or VSIX proof. Future edits invalidate the matching static conclusions.

## Closed source findings

- **SR08-01, replacement collisions:** isSafeReplacement checks private registered literal spellings before invoking existing bounded recognition. It catches short values within a proposed mask without changing F07's ordinary short-input matching policy. Core and semantic JSON/legacy replacements use it. Existing public output is not subjected to the stricter marker-only rule. X04/X05 explicitly cover the short SECRET/OUTPUT regression.
- **SR08-02, final-guard cancellation:** available rechecks closed after the callback and before returning enabled. Callback cancellation/disposal cannot release cached final output or access callback-cleared state. X10 covers both methods at the final check.
- **SR08-03, bidi controls:** text and OSC payload handling use the full Bidi_Control property. X06 includes the twelve named controls and byte partitions, including the previously omitted marks.
- **SR08-04, OSC grammar:** oscEsc accepts only backslash; OSC permits documented BEL/C1-ST terminators and rejects other C0/C1/DEL/bidi payload controls. X07/X08 cover malformed transitions; X09 preserves ordinary Unicode payload and legal terminators.

Presence and logic of these regressions were inspected. Their dynamic passing result was reported by root and was **not rerun or independently measured by this reviewer**.

## Remaining evidence wording correction

**EV08-01, LOW severity:** native host S10 is labeled "Fresh/concurrent stream instances", while production OutputSelfTest S10 performs two sequential, completed filterChunks calls. That native oracle establishes fresh-operation isolation. Separate live core instances are interleaved in unit R16, which is a different evidence kind.

Before recording final native acceptance, narrow S10's native scope to sequential fresh-operation isolation, or provide an actual corresponding production concurrency check. Keep core-unit interleaving evidence separately attributed. This wording does not require expanding into F09/task/shell work.

S08's production fixture specifically checks incomplete final UTF-8; malformed final control states have separate core-unit coverage. Retain that distinction when summarizing the named native case.

## Other inspected safety boundaries

- Separate fatal UTF-8 decoders, BOM preservation, CRLF/control states and per-channel completion remain intact.
- Byte/chunk/control limits are applied before release; normalization state is private; cancellation/failure/finish closes and clears owned references.
- Four declared views are bounded and joined as intended; no arbitrary permutation, whitespace erasure or cross-operation join is introduced.
- Both F07 and F08 guards govern the actual filterChunks path. Runtime starts both unavailable; command registration binds trusted machine/default settings. Observed-guard semantics follow design02.
- Existing filter checks/clean output use normalized stdout; JSON semantic-leaf grouping and legacy response checks remain.
- Production output self-test receives the actual singleton, returns only constant case IDs/booleans/status, and uses synthetic in-process data. Its Unicode source escapes are ordinary single-escape forms, so the split-byte case includes non-ASCII scalars.
- Synthetic self-tests/native command receipt do not establish independent caller identity, real terminal interception, network/gateway mediation, external-tool routing or human acceptance.

No numerical rating, STRONG catalog promotion or full-feature completion is issued by this review. Root must retain regressions/failures, verify the current exact bundle/native scope and complete its serial commit/byte barrier before F09.

