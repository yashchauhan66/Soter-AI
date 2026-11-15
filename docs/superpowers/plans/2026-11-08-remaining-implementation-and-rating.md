# Remaining implementation and rating plan

**Goal:** Implement missing executable features, verify the resulting candidate, and provide an explicitly provisional engineering rating while preserving absent acceptance results.

**Architecture:** Add a separate PowerShell 7 worker and profile/controller following the existing checked cmd/PS5.1 adapters. Reuse the safe command grammar, reader, output filter and hidden-input terminal. Bind the PS7 child to the fixed installed executable and reject the wrong edition/major version before interpreting any request. Integrate profile recovery and process shutdown. Keep immutable historical evidence unchanged and qualify a new artifact for changed source.

**Tech stack:** TypeScript, Node test runner, PowerShell, native VS Code integration.

**Spec:** `docs/soterai-lite/FEATURE-QUEUE.json`, F11/F32/V01–V05; latest owner instruction grants all needed permissions and explicitly requests a rating. That instruction authorizes necessary PS7 installation and a clearly provisional rating despite the older optional-runtime/no-interim-rating plan. It does not supply missing human test observations.

## Constraints and review focus

- Preserve existing user changes and historical failed/passing receipts.
- Never infer old-version migration, native closure or actual human results.
- Require PS7 Core version 7, fixed executable, no profiles, no workspace scripts, scrubbed environment and complete filtered output.
- Wire independent PS7 flag, worker ownership, cancellation, profile undo and removal recovery; PS5.1 remains independently supported.
- Exercise input injection, wrong runtime, secret output, cancellation and missing runtime cases, then native public commands and safe-reader interactions.

## Tasks

- [ ] Implement `PowerShell7Worker.ts`, `CheckedPowerShell7Profile.ts`, `powerShell7Commands.ts` and their focused tests; install/verify official runtime if available.
- [ ] Register commands/settings/profile and integrate lifecycle recovery, shutdown and output filtering.
- [ ] Run compiler, affected regressions and actual PS7/native-host checks; build and inspect a successor VSIX.
- [ ] Pursue legitimate F32 migration evidence and missing catalog controls without relabeling existing failed/partial results.
- [ ] Save a provisional engineering assessment with its evidence, limits and remaining gates, then reconcile the queue from actual completed work.
