# S4 host attempt and baseline comparison

**FACT — Current extra-round comparison, 2026-10-11.** Same17 existing cases; synthetic values change per run, so compare observation semantics. Actual loaded extension ca6a3e027cb881449d94410e82edb9e65503ee29165069f48b1f26780730338b.

| Case | A0 | Current | Current disposition |
|---|---|---|---|
| .env redacted preview | BLOCKED_SCOPED | BLOCKED_SCOPED | PASS; UNCHANGED |
| .env direct filesystem read | LEAK_CONFIRMED | LEAK_CONFIRMED | FAIL; UNCHANGED |
| nested/private.txt redacted preview | BLOCKED_SCOPED | BLOCKED_SCOPED | PASS; UNCHANGED |
| nested/private.txt direct filesystem read | LEAK_CONFIRMED | LEAK_CONFIRMED | FAIL; UNCHANGED |
| private.pem redacted preview | BLOCKED_SCOPED | BLOCKED_SCOPED | PASS; UNCHANGED |
| private.pem direct filesystem read | LEAK_CONFIRMED | LEAK_CONFIRMED | FAIL; UNCHANGED |
| selected.txt redacted preview | BLOCKED_SCOPED | BLOCKED_SCOPED | PASS; UNCHANGED |
| selected.txt direct filesystem read | LEAK_CONFIRMED | LEAK_CONFIRMED | FAIL; UNCHANGED |
| hardlink direct read | LEAK_CONFIRMED | LEAK_CONFIRMED | FAIL; UNCHANGED |
| hardlink redacted preview | BLOCKED_SCOPED | BLOCKED_SCOPED | PASS; UNCHANGED |
| junction direct read | LEAK_CONFIRMED | LEAK_CONFIRMED | FAIL; UNCHANGED |
| junction redacted preview | BLOCKED_SCOPED | BLOCKED_SCOPED | PASS; UNCHANGED |
| repository deny rule | BLOCKED_SCOPED | BLOCKED_SCOPED | PASS; UNCHANGED |
| agent edits repository deny policy | LEAK_CONFIRMED | BLOCKED_SCOPED | PASS; CHANGED |
| runtime environment and command output | LEAK_CONFIRMED | LEAK_CONFIRMED | FAIL; UNCHANGED |
| Git object after working-tree replacement | LEAK_CONFIRMED | LEAK_CONFIRMED | FAIL; UNCHANGED |
| encoded chunked exfiltration | LEAK_CONFIRMED | LEAK_CONFIRMED | FAIL; UNCHANGED |

**FACT — Superseding extra-round status, 2026-10-11.** One explicitly granted test-only repair round fixes TST-01; five typechecks/builds and 1338/1341 tests PASS (3 skipped, zero failed). Both existing hosts ran (SecurityReview harness PASS; NativeBaseline harness FAIL/R01 INCOMPLETE) with actual loaded extension ca6a3e027cb881449d94410e82edb9e65503ee29165069f48b1f26780730338b; SecurityReview eight scoped blocks/nine leaks, NativeBaseline observations recorded separately. [Current results](evidence/EXTRA-TST01-20261010/REPAIR-REPORT.md), [all17 A0 comparisons](evidence/EXTRA-TST01-20261010/host-comparison.json). Earlier S4/S6 failures and historical statements below retain their original time/scope and are superseded for current status only. S5-unmarked FAIL,30 full criteria UNTESTED,63 cells NOT_TESTED, exact-object review NOT_PERFORMED; full claim BLOCKED/deployment DEFERRED.

**FACT — Current attempt, 2026-10-10.** Windows **26300.8935**, isolated test editor 1.104.0. Default launch refused while existing Code.exe processes were running. One documented `AllowConcurrentIsolatedHost` fallback used a separate synthetic profile, workspace and extensions directory. No process was closed or killed. [Attempt](evidence/S4-20261010T103945Z-8ad14ded/attempt-record.json), [exact default log](evidence/S4-20261010T103945Z-8ad14ded/default-wrapper.log).

**FACT — INCOMPLETE.** The SecurityReview host started and activated the development extension, then failed its old assertion that the repository-deny edit must expose the canary. The final `live-host.json` and its post-activation bundle hash were never written. NativeBaseline preparation/compile succeeded, but its deeply nested working directory failed process launch with `Exception calling "Start" with "0" argument(s): "The directory name is invalid"`. The wrapper returned 1. [Raw fallback](evidence/S4-20261010T103945Z-8ad14ded/isolated-fallback-wrapper.log) and [wrapper summary](evidence/S4-20261010T103945Z-8ad14ded/isolated-fallback/verify-20261010T103949Z-c0796106a69c43aab375ad7d93c14d65/summary.json) retain both failures.

**INFERENCE — Interpretation.** A public-prose positive control passed before the policy case; the failed assertion expected a leak after removal of `.aiignore`. This is consistent with the new retained-deny mechanism, but an incomplete run supplies no complete current grading. The earlier stages remain distinct from a later final repair/verification run. A prepared/launch-record hash is not an actually loaded-hash attestation.

| Existing observation | A0 | Current saved result | Classification |
|---|---|---|---|
| .env redacted preview | BLOCKED_SCOPED | INCOMPLETE | Matching current managed observation not persisted |
| .env direct filesystem read | LEAK_CONFIRMED | INCOMPLETE | OUT-OF-COVERAGE-BY-DESIGN; historical failure retained, no current fix claim |
| nested/private.txt redacted preview | BLOCKED_SCOPED | INCOMPLETE | Matching current managed observation not persisted |
| nested/private.txt direct filesystem read | LEAK_CONFIRMED | INCOMPLETE | OUT-OF-COVERAGE-BY-DESIGN; historical failure retained, no current fix claim |
| private.pem redacted preview | BLOCKED_SCOPED | INCOMPLETE | Matching current managed observation not persisted |
| private.pem direct filesystem read | LEAK_CONFIRMED | INCOMPLETE | OUT-OF-COVERAGE-BY-DESIGN; historical failure retained, no current fix claim |
| selected.txt redacted preview | BLOCKED_SCOPED | INCOMPLETE | Matching current managed observation not persisted |
| selected.txt direct filesystem read | LEAK_CONFIRMED | INCOMPLETE | OUT-OF-COVERAGE-BY-DESIGN; historical failure retained, no current fix claim |
| hardlink direct read | LEAK_CONFIRMED | INCOMPLETE | OUT-OF-COVERAGE-BY-DESIGN; historical failure retained, no current fix claim |
| hardlink redacted preview | BLOCKED_SCOPED | INCOMPLETE | Matching current managed observation not persisted |
| junction direct read | LEAK_CONFIRMED | INCOMPLETE | OUT-OF-COVERAGE-BY-DESIGN; historical failure retained, no current fix claim |
| junction redacted preview | BLOCKED_SCOPED | INCOMPLETE | Matching current managed observation not persisted |
| repository deny rule | BLOCKED_SCOPED | INCOMPLETE | Matching current managed observation not persisted |
| agent edits repository deny policy | LEAK_CONFIRMED | INCOMPLETE | Managed repair exists; host stopped at obsolete leak expectation, no complete result |
| runtime environment and command output | LEAK_CONFIRMED | INCOMPLETE | OUT-OF-COVERAGE-BY-DESIGN; historical failure retained, no current fix claim |
| Git object after working-tree replacement | LEAK_CONFIRMED | INCOMPLETE | OUT-OF-COVERAGE-BY-DESIGN; historical failure retained, no current fix claim |
| encoded chunked exfiltration | LEAK_CONFIRMED | INCOMPLETE | OUT-OF-COVERAGE-BY-DESIGN; historical failure retained, no current fix claim |

**FACT — Identity.** Prepared extension candidate: `853fc442fe868db57b63c9bbf9d4abe31a09afab6cec7b6b30e7239197c5d43a`; actually loaded hash not persisted. No real agent/model/provider, normal profile, real token contents or F16/auth probe was used. All thirty full architecture assertions and 63 real-agent cells remain unchanged.

## Final S6 disposition

**FACT — Windows 26300.8935.** Final guarded wrapper ran all suites, found TST-01 and withheld both launches. No current loaded-bundle hash or complete observation record. [Machine-readable per-case comparison](evidence/S6-evaluation-20261010T113227Z-7fb071c5/host-comparison.json). All seventeen current cases remain INCOMPLETE; source/unit improvements are not a re-run. Original A0 confidentiality remains FAIL, with seven scoped blocks and ten confirmed leaks.

| Existing observation | A0 result | Current result | Mechanism status/limit |
|---|---|---|---|
| .env redacted preview | BLOCKED_SCOPED | INCOMPLETE | MANAGED_PATH; CURRENT_HOST_INCOMPLETE |
| .env direct filesystem read | LEAK_CONFIRMED | INCOMPLETE | OUT-OF-COVERAGE-BY-DESIGN; NOT_FIXED |
| nested/private.txt redacted preview | BLOCKED_SCOPED | INCOMPLETE | MANAGED_PATH; CURRENT_HOST_INCOMPLETE |
| nested/private.txt direct filesystem read | LEAK_CONFIRMED | INCOMPLETE | OUT-OF-COVERAGE-BY-DESIGN; NOT_FIXED |
| private.pem redacted preview | BLOCKED_SCOPED | INCOMPLETE | MANAGED_PATH; CURRENT_HOST_INCOMPLETE |
| private.pem direct filesystem read | LEAK_CONFIRMED | INCOMPLETE | OUT-OF-COVERAGE-BY-DESIGN; NOT_FIXED |
| selected.txt redacted preview | BLOCKED_SCOPED | INCOMPLETE | MANAGED_PATH; CURRENT_HOST_INCOMPLETE |
| selected.txt direct filesystem read | LEAK_CONFIRMED | INCOMPLETE | OUT-OF-COVERAGE-BY-DESIGN; NOT_FIXED |
| hardlink direct read | LEAK_CONFIRMED | INCOMPLETE | OUT-OF-COVERAGE-BY-DESIGN; NOT_FIXED |
| hardlink redacted preview | BLOCKED_SCOPED | INCOMPLETE | MANAGED_PATH; CURRENT_HOST_INCOMPLETE |
| junction direct read | LEAK_CONFIRMED | INCOMPLETE | OUT-OF-COVERAGE-BY-DESIGN; NOT_FIXED |
| junction redacted preview | BLOCKED_SCOPED | INCOMPLETE | MANAGED_PATH; CURRENT_HOST_INCOMPLETE |
| repository deny rule | BLOCKED_SCOPED | INCOMPLETE | MANAGED_PATH; CURRENT_HOST_INCOMPLETE |
| agent edits repository deny policy | LEAK_CONFIRMED | INCOMPLETE | SCOPED_MECHANISM_REPAIRED_IN_UNIT_TESTS; FULL_T_NOT_FIXED; CURRENT_HOST_INCOMPLETE |
| runtime environment and command output | LEAK_CONFIRMED | INCOMPLETE | OUT-OF-COVERAGE-BY-DESIGN; NOT_FIXED |
| Git object after working-tree replacement | LEAK_CONFIRMED | INCOMPLETE | OUT-OF-COVERAGE-BY-DESIGN; NOT_FIXED |
| encoded chunked exfiltration | LEAK_CONFIRMED | INCOMPLETE | OUT-OF-COVERAGE-BY-DESIGN; NOT_FIXED |
