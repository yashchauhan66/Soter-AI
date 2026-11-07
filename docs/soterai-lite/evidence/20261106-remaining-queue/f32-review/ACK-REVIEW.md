# Inert completion acknowledgment successors

Prepared only in this review directory. No frozen native07 file was changed. No Code process or native lifecycle run was launched by this review.

Files ready for root inspection:

- `installed-observer-proposed-06.cjs` and `installed-upgrade-old-observer-proposed-05.cjs`: after all existing checks pass, publish the existing observer result plus a new nonce, then wait at most 90 seconds for a renderer acknowledgment bound to that nonce, phase, and exact result hash. Only then execute the existing normal close command.
- `installed-renderer-proposed-06.cjs`: validate and retain the completed observer result, disconnect its existing attach-only CDP transport, then publish the renderer result with the matching nonce and observer-result fact. Disconnect failure cannot publish success.
- `prepare-ack-successors.ps1`: reproducible preparation from exact predecessors, with new-file-only writes and before/after predecessor hashes.
- `completion-controls.test.cjs`: exercises the actual generated handshake functions and disconnect finalizer, without loading VS Code or launching children.

Verification: 18 controls passed, 0 failed; all three generated scripts passed `node --check`. Tests verify the complete existing observer assertion bodies remain byte exact. No lifecycle assertion, phase, or observation was added or removed. The original runner still requires 44 unique assertions and 59 observations across eight phases.

Integration for a later successor: copy these three files into the original F32 evidence directory under their new names, update the successor runner's three exact fixture-name admissions, and pin those files in its fresh admission. No new helper dependency or product change is required. The original copies and native07 close/failure evidence remain unchanged. Root should also keep the renderer/source hash checks in the existing admission flow.

This acknowledgment addresses the short-phase close/attach race. It does not reinterpret native07's unobserved trust grant as an observed keyboard action; the separate `native07-trust-review.md` records that actual failure.
