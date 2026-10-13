# Controller component completion record

**FACT / result (2026-10-12):** 28 tests PASS, 0 FAIL, 0 SKIP. This is a new owner-side source component; full deployment remains incomplete and full G1-G6 remains **BLOCKED**. Sources: [TAP output](../evidence/20261012-controller/controller-tests.tap), [execution receipt](../evidence/20261012-controller/test-execution.json).

## Implemented and verified locally

All rows are **FACT / source and synthetic test observations (2026-10-12)**.

| Change | Verification | Limit |
|---|---|---|
| Signed deny-add-only policies | Invalid signature, old revision and deny relaxation reject; protected-item denial survives restart with a working public control | No deployed policy custody or relaxation UX |
| Real signed scoped capabilities | Exact reviewed recipient/item/revisions/destination; one-use, expiry, restart and scope substitution controls | Physical-presence verifier and OS identity measurement are synthetic adapters in tests |
| Durable signed journal/checkpoint | Fsynced commit before content, single writer, tamper/partial-write/missing-state refusal | Windows power-loss, independent witness and joint rollback not verified |
| Fixed dispatcher | Approved variable names with all values masked; finite synthetic contracts/status; ordinary reviewed text digest-bound and redacted | No arbitrary secret read, real-service gateway or universal prose detector |
| TLS data/control roles | Real TLS 1.3 loopback traffic; missing/unpinned clients refuse; agent cannot call owner routes | No enrolled real agent/guest service lifecycle |
| Revocation during asynchronous release | Awaited projection yields no output after revocation/revision change | No real remote-operation drain or recall of prior disclosures |
| Bounded review queue | 32 live reviews cap; old reviews cannot issue; expired records free capacity | Persistence/graceful interactive review are not deployed |
| Runtime configuration/readiness | Pinned hashes/identities; shared mounts, clipboard, NAT/extra adapters, stale measurements reject; no native fallback | Parser assertions do not prove operating-system enforcement |

Sources: [controller](../../../apps/privacy-controller/src/CapabilityController.mjs), [journal](../../../apps/privacy-controller/src/SignedJournal.mjs), [transport](../../../apps/privacy-controller/src/DataPlane.mjs), [runtime plan](../../../apps/privacy-controller/src/FullModePlan.mjs), [tests](../../../apps/privacy-controller/src/__tests__/controller.test.mjs).

**FACT / changed files (2026-10-12):** New `apps/privacy-controller/package.json`, README, `src/index.mjs`, controller, journal, data-plane and runtime-plan modules, and three test files. Root `package-lock.json` adds only this workspace and its local link. New report/setup/evidence files are under `docs/project-privacy`. Existing extension product code and bundle were not changed in this controller round. Source: [hash inventory](../evidence/20261012-controller/SHA256SUMS.txt).

**FACT / historical results retained (2026-10-12):** The preceding extension suite remains 790 PASS / 0 FAIL / 3 SKIP; its real functional host H01-H10 remains 10/10 PASS. The retained adversarial survey still contains nine confirmed unmanaged-route leaks. This round did not rerun those hosts or install a replacement VSIX. Source: [previous final report](../FINAL-LOCAL-REPORT.md).

**FACT / loaded-artifact scope (2026-10-12):** Previous tested extension bundle SHA-256: `d8abff1a7ac48809420bb4f2862b8d9700ccc85c9b5cd97152608be85556b032`. Previous VSIX SHA-256: `7b590560325aa46c3519cbf6bf0300c7bf7783d910cbae7d89e4636010e61c2c`. Those identify the previous extension checks, not a deployment containing the new controller. Source: [previous package inventory](../evidence/20261012-final-local/vsix-integrity.json).

**FACT / UI status (2026-10-12):** No new controller results were injected into the packaged extension report or used to show active full protection. The existing review UI retains bounded coverage and full-claim BLOCKED. No running Code.exe was closed/killed/reloaded, no main-editor installation was performed and no driver/VM/account/firewall change occurred. Source: [previous UI receipt](../evidence/20261012-final-local/raw/ui/ui-ready.json), [setup state](../evidence/20261012-controller/setup-state.json).

**INFERENCE / remaining exposure:** Native same-account AI extensions and terminals can still reach original files/buffers/environment/history/clipboard through unmanaged routes. Unknown confidential prose, prior disclosures, administrator/host compromise and side channels remain limits. The unbundled controller cannot intercept those routes by existing in the repository.

**FACT / required next step (2026-10-12):** A verified installer is staged but not run. Explicit installation approval and a subsequent exact VM image/configuration review are still outstanding. Real protected custody/presence, gateway, whole-IDE enrollment, publication/import integration and actual agent flows remain incomplete. Source: [setup review](SETUP-REVIEW.md).

**INFERENCE / rollback:** Keep the new component disabled and unconstructed. A source rollback removes only the new controller package and its two lockfile entries, retaining reports and the existing extension work. Future deployed-ledger or backend rollback requires its own supported recovery procedure; no automatic original-file/native fallback is permitted.

**FACT / failures and exclusions (2026-10-12):** Earlier restricted test subprocess launches returned `spawn EPERM`; reviewed test execution resolved that restriction. Read-only Docker/WSL access was denied or timed out, so runtime availability is INCOMPLETE. No safety-filter rejection occurred. No new probe, exploit code, real-secret read, provider credential extraction, push or deployment was performed. Sources: [setup state](../evidence/20261012-controller/setup-state.json), [execution receipt](../evidence/20261012-controller/test-execution.json).

**INFERENCE / honest claim sentence:** “Managed public-project workflows are tested, and the owner-side controller has passed 28 synthetic/loopback component tests. Independently enforced whole-IDE protection is not deployed; native agents remain uncovered and the full claim is BLOCKED.”
