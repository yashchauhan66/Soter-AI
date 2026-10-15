# F08 source review — evidence reviewer 01

Date: 15 October 2026. Independence LOW (same model lineage). Read-only static review; no tests, product execution or production/test edits. Only this evidence note was authored. Findings apply to the measured source snapshots below, not to a later fixed artifact.

| Reviewed source | SHA-256 |
| --- | --- |
| packages/core/src/StreamingOutputRedactor.ts | 4fc10dd7a7b2a2d810467b3056145fc14c1735f700dbe23fb0f7d807753908e3 |
| packages/vscode-extension/src/secret-broker/OutputFilter.ts | c7e304e463ba5f5a4018165f0b55cc31104d64d695dced92e0295b8d7c605bd5 |
| packages/vscode-extension/src/secret-broker/runtime.ts | b7bf74a43c117e4c30ecc8de8e2f68e56ac7816a2d63eca09876187ceda1a74d |
| evidence/20261015-f08-output-b7429e10/design-02.md | b1fbf8cc128a1d3f86348a0d8f9a0c5cdf8aef7ba64571fa5c145a71295f3ad0 |

Runtime was being wired by root; only the observed dual default-false guard binding is assessed here. Production self-test completeness and actual loaded-bundle behavior remain outside this static review.

## SR08-01 — short registered values can collide with the replacement marker

Severity HIGH; OPEN on the reviewed snapshot. Core finish validates the proposed marker using the existing matcher. F07 deliberately matches registered values shorter than eight Unicode scalars only as an entire explicit part; it does not identify an arbitrary short substring inside a longer marker.

Concrete reasoning: register the synthetic value "SECRET" or "OUTPUT"; finish an operation whose complete stdout equals that value. The original whole-channel view matches and becomes [REDACTED_SECRET_OUTPUT]. The validation call inspects the marker as one part, so the short substring is not a whole part and yields CLEAN. The returned replacement still contains the exact registered spelling. Existing full-marker collision controls do not cover this case. The same weakness applies to existing-filter replacement validation when a short registered spelling is introduced by a replacement.

Required regression before fix: short raw registered values that occur within the static marker, both channels and the actual filter consumer; unrelated public output still works. Use a strict, case-sensitive literal registered-value collision check for replacement text in addition to the bounded encoded/provider matcher validation, or an equally strong dedicated replacement validator. Do not change accepted F07 short-input matching semantics globally and do not recursively select masks.

## SR08-02 — cancellation inside the final guard callback can still release COMPLETE

Severity MEDIUM; OPEN on the reviewed snapshot. available() checks closed only before calling the enabled callback. That callback can synchronously cancel/dispose the same instance and return true. At the final guard in finish(), cached stdout/stderr have already been computed; available then returns true and finish returns COMPLETE despite the cancellation.

Concrete control: count callback invocations; cancel the current instance on the third invocation (push entry, finish entry, finish final), return true throughout. Expected WITHHELD with empty channels, not COMPLETE. Recheck terminal state after the callback. This also protects earlier entry checks against callback-cleared state. No asynchronous or unobserved configuration transition is needed, so design-02's observed-guard clarification does not remove this case.

## SR08-03 — the implemented forbidden bidi set is narrower than the frozen wording

Severity MEDIUM; OPEN contract decision. The text-mode forbidden regex covers U+202A..U+202E and U+2066..U+2069 but permits directional control marks U+061C, U+200E and U+200F. They are appended to completed plaintext. Frozen design-01 says bidi cursor/control rewriting withholds; the exact set was requested in the earlier design review but design-02 does not pin it.

Required action: explicitly define and test the complete intended forbidden set, rejecting these marks if retaining the broad bidi-control claim. If intentionally narrowing the contract, log the reason and resulting residual behavior rather than imply the existing limited cases cover every bidi control.

## SR08-04 — unsupported ESC inside OSC is silently accepted and dropped

Severity MEDIUM contract/fail-closed gap; no disclosure observed. In oscEsc state, any next character other than a supported terminator can return the parser to osc. For example an OSC payload containing ESC followed by [2J is suppressed to the eventual BEL and the operation can COMPLETE, although the frozen contract says malformed/unsupported ESC/CSI operations withhold. Repeated ESC and forbidden C0/DEL payload handling also lack an explicit frozen payload grammar.

Required action: define permitted OSC payload syntax, then test ESC not followed by backslash, nested unsupported controls and the exact length boundary. Prefer rejection of unsupported escape transitions while retaining documented OSC suppression. Merely dropping the payload is confidentiality-preserving here, but it does not establish the declared malformed-control failure behavior.

## Confirmed design items in the inspected source

- Completion buffering returns no source bytes from push; failures clear private buffers/decoders/matcher references.
- Separate fatal UTF-8 decoders preserve BOM and per-channel CRLF/ANSI state; scalar/sequence work is bounded by fixed input/chunk/control limits.
- Arrival emissions are joined before matcher calls, avoiding the F07 32-part/4096-push mismatch.
- Exactly the declared channel/arrival/ordered-group views are inspected with deduplication; design-02 explicitly scopes per-view F07 work plus bounded marker validation.
- Existing filter consumes normalized stdout for JSON extraction, legacy checks and clean return, rather than returning its original ANSI-bearing buffer.
- filterChunks combines both guard callbacks; runtime snapshot binds both guards default-false. Re-enable/actual trust handling still requires production verification.
- Private class state uses actual JavaScript private fields; returned progress/result objects are frozen; reasons are constant metadata.

These observations are static evidence, not test PASS or independent certification. Root should retain failing regressions before each fix, rerun affected checks, record new source hashes and obtain final exact-artifact/native verification before declaring F08 complete. No F09, terminal-shell or gateway work is authorized by this note.

