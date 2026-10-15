# F08 adversarial design review — evidence reviewer 01

Date: 15 October 2026. Independence: LOW, same model lineage. Scope: read-only review of frozen design-01.md, current secret-broker/OutputFilter.ts and runtime.ts, and core/RegisteredSecretMatcher.ts. No tests, product execution, network calls, source/test edits, or F09 work were performed. This note is a design review, not a confidentiality pass or a numerical rating.

The completion-buffered release model is coherent: withholding the whole operation before finish avoids an already-released-prefix problem. Four declared views and bounded two-channel state are materially narrower than arbitrary reconstruction. Existing unmanaged/native/network limitations remain. The following items should be resolved in a design addendum and failing regression expectations before implementation.

## DR08-01 — normalized result must be the actual existing-consumer input

Priority: required implementation gate. Current OutputFilter.filter uses its input variable for JSON extraction, REQUESTS_SECRET, UNSAFE_COMMAND, SecretClassifier and its clean result. The new pipeline must replace that variable with the completed normalized stdout before those existing checks and before returning text. Otherwise it can successfully scan normalized text but return the original ANSI/control-bearing string, or evaluate legacy response rules against a different representation from the released result.

Regression expectations: public SGR/OSC/CRLF input returns only the specified normalized plaintext; an SGR insertion inside the word "show" cannot evade the existing asks-for-secret check after normalization; an SGR insertion inside a legacy blocked command cannot evade that legacy check. A valid JSON response is extracted from the normalized output, not a different original buffer. Preserve existing response rules without accidental recursion between filter and filterChunks.

The byte processor explicitly does not recursively normalize JSON-decoded leaves. State that boundary: JSON-escaped ANSI followed by consumer-side decoding/terminal normalization is not automatically established by the byte-level ANSI test. Add a bounded rejection/normalization policy for such leaves only if claiming that composition, or retain it as an explicit unsupported combination.

## DR08-02 — both existing and new runtime guards govern the new consumer

Priority: required implementation gate. Current runtime has a default-false F07 matching guard. Adding a default-false F08 guard must not let filterChunks bypass matchingEnabled, trust, or the existing consumer's withheld outcome. The new flag withdraws a route; it does not create a route that works with F07 disabled.

Regression expectations: matching false/output true, matching true/output false, either callback throwing, and trust unavailable all withhold with empty channels. Re-enable starts a fresh operation. Exercise the actual singleton, not only a new standalone core instance.

## DR08-03 — arrival-order matching is a view, not thousands of matcher parts

Priority: required availability/contract gate. F07 maxParts is 32; F08 allows 4096 pushes. Passing per-push normalized emissions as inspectRequest parts would reject ordinary public streams once their part count exceeds 32. Join emissions into the one declared arrival-order view; scan stdout/stderr and explicit ordered group with a bounded representation. Do not silently remove a view to make a fixture pass.

Regression expectations: 33, hundreds, and 4096 permitted public chunks, including empty pushes and alternating channels, remain useful when every other bound permits. Long public output is still subject to F07 recognition/work limits; the streaming byte/chunk limits alone do not guarantee availability.

## DR08-04 — define what observes withdrawal

Priority: frozen-claim clarification. A boolean callback sampled at push/finish cannot detect an unobserved false-to-true transition between calls. The contract's unconditional "withdrawal during collection permanently withholds" needs an observation boundary or a real invalidation mechanism.

Choose explicitly: (a) the host-free contract reacts to false/throw observed at entry/final checks and the actual runtime invalidates active operations on relevant configuration/trust changes; or (b) a monotonic guard epoch/revocation subscription binds the whole operation. Do not claim that a callback alone detects an event it never observes. No F09 shell integration is needed to document this boundary.

Regression expectations: observed true/false/true sequence remains terminally withheld; fresh operation succeeds. If an event/epoch guarantee is selected, test that event without relying on another push to notice it.

## DR08-05 — scope matcher budgets to each view or to the whole operation

Priority: resource-bound clarification. Reusing one RegisteredSecretMatcher instance does not share inspectRequest work/decoded/match budgets: that method resets counters on every call. Up to four distinct views therefore permit up to four per-call budgets, with at most three times the combined normalized input bytes across all views before deduplication.

Record whether F07 bounds are per view or whether F08 imposes an additional aggregate operation budget. The fixed four-view count is bounded, but it must not be described as a single F07 work budget without implementation. Keep the no-duplicate-view optimization explicit and retain fail-closed handling for any withheld view.

## Additional precise acceptance edges

- Preserve BOM using the appropriate decoder behavior; default TextDecoder BOM handling would remove it.
- A C1 CSI/OSC/ST code point is valid UTF-8 encoding of that code point; an isolated raw 0x9b byte remains invalid UTF-8. Test both.
- State the exact forbidden bidi code-point set. Preserve ordinary Unicode without normalization, and distinguish forbidden terminal-rewriting controls from harmless non-ASCII text.
- Count SGR/OSC UTF-16 lengths including introducer/terminator, including C1 forms, at the inclusive bound and bound plus one.
- Keep CRLF, UTF-8 and control-parser state separate per channel. stdout CR and stderr LF cannot complete one another; nor can different streams complete ANSI/OSC state.
- Invalid runtime channel, non-Uint8Array chunk, non-integer/out-of-signed32-bit exit code, and invalid constructor registrations must withhold without input-bearing reasons.
- Copy/process pushed bytes synchronously; caller mutation after push cannot alter the eventual matched or released text.
- Cancellation/error/finish is terminal; subsequent finish or push cannot replay output. Drop private references on terminal paths without claiming that JavaScript heap bytes can be securely erased.
- Test distinct fresh instances with complementary canary fragments: no cross-operation joins. Same-operation declared views must still catch their specified joins.
- Value-free progress/receipts and Object/JSON serialization checks must cover buffers, registration lists and callback failure paths. Freeze returned metadata/results.

No product result is promoted by this note. Required source/unit/native exact-object verification and scoped commit remain the root's F08 acceptance barrier; catalog44 and final rating remain pending.

