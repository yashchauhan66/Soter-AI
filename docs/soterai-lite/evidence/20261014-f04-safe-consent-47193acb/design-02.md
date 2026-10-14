# F04 bounded policy enrollment and terminal payload

Same-lineage adversarial design review LOW found two gaps before production. This adds to design-01; it does not overwrite it.

For managed-read-terminal, apply the existing terminalSafeText sanitizer before preparing safeText/outputDigest and return that exact same payload. Reader framing and LF-to-CRLF display transport are separate from the reviewed text; no unreviewed source values are added.

Move the current command's pre-enrollment BoundarySnapshot.load inside an optional trusted service dependency `prepare(target)`, before capture/preview/approval, under the same fixed60s timer and request epoch. A stalled prepare therefore cannot hang command execution or indefinitely retain BUSY. Expose only read-only `isPreparing()` lifecycle metadata, true solely for the currently live request's prepare; timeout/revoke/dispose/finish clear its ownership, and an old late completion cannot clear a newer request's phase.

During that current owned pre-enrollment phase, additive boundary-rule/owner-session enrollment events clear existing approved views but do not cancel the request before it has captured any content or approval. After prepare, those events revoke as before. Explicit user revocation, manual restriction intent, configuration/workspace/trust changes always cancel even during preparation. Capturing starts only after enrollment finishes and the request is still live; all policy/content/recipient/review bindings are then taken from fresh state.

Regression requirements added: hung prepare deadline, clearing phase/freeing BUSY, late expired prepare ownership isolation, first actual command from unenrolled storage, terminal control-character payload exactness, UTF-8 boundary16KiB/+1byte and full input64KiB even when regionView is tiny, recipient drift during recapture. Native timeout cannot dismiss a stale native modal; its later response grants nothing. No stronger independent identity or universal shell claim.
