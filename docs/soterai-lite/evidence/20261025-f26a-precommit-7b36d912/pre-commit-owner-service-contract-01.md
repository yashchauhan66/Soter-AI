# F26a live owner service test contract

TEST ONLY, frozen before corresponding service production. Executes the existing F26a owner-route design; no replacement feature plan, native evidence, compiler result or completion claim. The root agent alone runs the missing-module baseline and implements production.

`PreCommitOwnerService` takes captured `root`, installation `generation`, worker/runtime SHA256 pins, live `valid`, async `loadKey`, optional ambient environment, and the announced `prepareIndex` / `createScan` private seams. Construction has no key/listener/index/scan side effects. `start()` is one shot, returning a signed descriptor for an OS-selected IPv4 `127.0.0.1` port and exact POST `/pre-commit`. Duplicate start or start after close returns undefined without another key load/listener. `close()` is idempotent, withdraws active work, closes admission, and waits for actual held scanner closure without signals.

Tests use fresh synthetic Ed25519 keys, genuine `CheckedHookIndex` capabilities obtained from retained manually framed SHA1 DIRC roots, and fake scanners. No Git or other child is launched. Actual HTTP/net traffic is confined to numeric IPv4 loopback. All temporary fixtures remain retained. On other platforms the genuine-index cases skip; no cross-platform behavior is inferred.

The announced scanner seam exposes `start`, `closed`, `busy`, `withdraw` and exact-result `canRelease`. The fake scanner can hold an outcome or return a premature ALLOW while its actual `closed` promise remains pending. Withdrawing releases a status-only STOP result while preserving actual busy ownership until the fixture explicitly completes it. Fake completion does not simulate a process signal.

The 28 declared tests cover:

- Constructor/one-shot/closed/disabled/missing-or-unsuitable-key startup and verified descriptor pins.
- Complete public ALLOW with authentic nonzero `indexSha256` and `indexIdentity`, fixed signed BLOCK, unavailable/STOP refusal, correct request nonce/session/generation binding and no staged filenames/content/error diagnostics in any response.
- Strict canonical request schema/version/session/generation/nonce/index data; duplicate JSON, unsupported fields, malformed UTF8/BOM, malformed/truncated JSON and empty bodies refuse before preparation.
- Exact method/path/Host/no-Origin admission, absent or unsupported content type, duplicate Host/content headers and transfer encoding ambiguity, body above 4096 bytes and excessive headers. These tests assert zero preparation/scanners and refusal; they do not prescribe a specific HTTP refusal status.
- One active request with no queue, a signed BUSY bound to the second nonce and zero index digests under the still-live key, and no second prepare/scanner. Admission refusals when authority/key becomes unavailable may be fixed unsigned refusals.
- Only captured root and literal effective-index selector data reach preparation. The root-owned ambient object is supplied to the announced seam unchanged; canonical index preparation remains responsible for sanitizing the eventual Git environment. Foreign-root genuine capabilities, structural clones and missing capabilities cannot enter a scanner.
- Fresh final-key load, original-pin continuity, missing/thrown/changed signing key, observed disable/re-enable while final key awaits, real index byte/identity drift, exact held-result `canRelease` after the await, and explicit close while final key awaits.
- Premature result versus actual scanner closure, aborted HTTP transport, sticky withdrawal/busy until actual closure, close waiting for natural closure, and sanitized preparation/factory exceptions.

As agreed with the root before freeze, a failed valid request may return a correctly signed fixed UNAVAILABLE under the original pin or an empty/fixed unsigned HTTP refusal. Neither may contain raw content or a signed ALLOW. Changed final signing material cannot authorize ALLOW under either old or replacement pin. No specific HTTP status is required for malformed or unavailable requests. Positive public ALLOW, BLOCK and live BUSY paths must verify through the real `PreCommitWire` helpers.

For observed disable/re-enable the test explicitly invokes the scanner's provided `valid` callback while the flag is false, before re-enabling. That makes the observed withdrawal point concrete rather than inferring an unobserved transient flag change. The fake then tries to release its held ALLOW after final-key resolution.

These tests authenticate owner responses, not caller identity. They do not claim same-user exclusion, kernel atomicity, absence of the final-check-to-Git race, real Git scanning, hook/client installation, encrypted backup/restore, native editor execution, or a completed F26a feature. Root must retain the actual missing-module baseline, then run implemented behavior and compiler gates separately.
