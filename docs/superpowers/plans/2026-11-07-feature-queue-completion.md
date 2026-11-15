# Remaining Feature Queue Implementation Plan

> **For agentic workers:** Execute the tasks below with one product implementation writer and parallel read-only investigation/review. The owner has explicitly requested immediate execution of all necessary remaining work.

**Goal:** Resolve reproducible local blockers in FEATURE-QUEUE.json and verify each claim against current artifacts, retaining genuinely outstanding human acceptance.

**Architecture:** Preserve the existing vault format, active storage, and security boundaries. Make reviewed removal retain encrypted recovery outside the directory VS Code deletes, then qualify the rebuilt package before native checks. Reconcile queue metadata against actual results without rewriting historical receipts.

**Tech Stack:** TypeScript, Node.js tests, VS Code extension host, PowerShell, existing exact-artifact verification tools.

**Spec:** `docs/soterai-lite/IMPLEMENTATION-PLAN.md`, especially F26, F31, F32 and V01–V05; `docs/soterai-lite/FEATURE-QUEUE.json`.

## Global Constraints

- No plaintext rollback or restoration during removal; preserve encrypted recovery and policy.
- Use isolated synthetic profiles, exact package/vendor identities, and actual host checks for native acceptance.
- Preserve existing work and failed evidence; do not count skipped/absent or human-unexecuted checks as passing.
- No publication, network push, login, or invented independent review.
- Product implementations remain serial; independent investigation and review run concurrently.

## Review Focus

- Actual vendor uninstall deletes extension-owned global storage after deferred physical cleanup.
- Recovery archival must refuse symlinks, hardlinks, unsafe paths, corrupt records and partial publication.
- A failed archive must prevent a successful removal report.
- Repeated removal/reinstallation must preserve recoverable ciphertext without overwriting newer data.
- Human usability, screen-reader and independent review results are absent (owner confirmed 7 November).

### Task 1: Durable encrypted recovery on reviewed removal

**Files:** `packages/vscode-extension/src/lifecycle/`, lifecycle tests, user guide.

**Interfaces:** A bounded archive operation integrated into `RemovalCoordinator` before COMPLETE; it consumes the actual extension storage path and preserves only verified vault recovery records. Existing vault encryption/key storage remains authoritative.

- [x] Retain vendor source/log evidence establishing the uninstall deletion.
- [x] Add a regression that deletes the old storage after approved removal and verifies recovery ciphertext remains, plus refusal cases.
- [x] Implement immutable encrypted recovery and truthful removal status/copy, including configuration backups and valid encrypted empty backups.
- [x] Run focused lifecycle/vault tests and compiler; review failure paths independently. Four added regressions failed before the fix; 78 scoped checks now pass.

### Task 2: Current candidate and native qualification

**Files:** Existing candidate preparation and F32/F26a/V01 verification tools under `docs/soterai-lite/evidence/20261106-remaining-queue/`; new dated evidence only.

- [x] Run full affected component tests and build/package checks after the runtime change: 4,913 PASS, zero FAIL, four privileged-symlink SKIP; compiler/build/package55 passed.
- [x] Freeze new source/VSIX identities and retain the old candidate as historical: 1,245 inputs, VSIX `38b81310f53d`.
- [x] Refresh safe native preparation against current vendor bytes; current affected509, pre-commit34, editor10 and reliability30 plus peer closure passed on Code1.145.2.
- [x] Record actual results, including incomplete native assertions; actual uninstall recovery passes, genuine old0.6.3 upgrade fails before U05. Separate limited14 passes and accepts zero original upgrade assertions.

### Task 3: Queue and final handoff reconciliation

**Files:** `docs/soterai-lite/FEATURE-QUEUE.json`, final report, human actions, dated progress evidence.

- [ ] Correct stale active-feature, skipped-feature, updater and phase metadata using verified evidence.
- [ ] Verify artifact/evidence hashes, source drift and document claims.
- [ ] Record local checks and outstanding gates precisely, including the owner's confirmation that human results do not exist yet.
- [ ] Leave original V05/L6 human acceptance and release rating pending until actual results are supplied.

## Current execution checkpoint

8 November 2026: the recovery artifact is built and its full/native verification receipts are retained. Manual approval restored native execution after two automatic-review 503 errors; those requests did not execute. Cline20+hook4, Claude CLI22 and Gemini16 passed. Codex CLI successor03 passes20 after explicit Node-helper ownership fixed premature wrapper failure. The current IDE run is separately tracked; do not infer it from CLI. Both earlier Codex failures remain retained.

The 264-pair assessment and raw route receipt adapter preserve missing semantic controls, the Gemini explicit-override leak, Cline vendor-context/image limits and absent Claude IDE coverage. The exact handoff7/neutral406 files and frozen inputs have been reverified. Original human and independent gates remain incomplete. See [current status](../../soterai-lite/evidence/20261107-removal-recovery/STATUS-20261108.md); `CURRENT-PROGRESS.md` is a historical pre-build checkpoint.
