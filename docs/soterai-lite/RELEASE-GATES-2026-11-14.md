# Release gate continuation, 14 November 2026

The missing-live-vault recovery bug is fixed. Current Cline loopback, native vault cold restart, current shipped advisory lookup and local checks passed. Production acceptance is still incomplete; no publication occurred.

Candidate: **SoterAI Secret Guard 0.7.0, Windows x64 preview**, identity `soterai.soterai-ide-guard`.

- [VSIX](../../packages/soterai-lite/soterai-secret-guard-0.7.0-recovery-hardening-20261114-attempt01.vsix), 1,674,780 bytes.
- SHA-256: `98f3e336ee3a76e992276409648de98d1db4c6e362fb7669e624dd892adf0d9c`.
- [Evidence summary](evidence/20261114-release-gates/summary.json) and [candidate pointer](evidence/20261114-release-gates/candidate-pointer.json).

## Changes and verified results

An absent live vault previously looked like an empty store even when encrypted generations remained. Another migration could replace the lost records. The manager now refuses that empty-store interpretation and retains authenticated, owner-approved backup recovery. The two regressions failed before the fix and passed after it. The check uses `hasGenerations()`, so a first migration's own mutation lock does not look like prior vault data.

| Verification | Observed result |
| --- | --- |
| Full extension suite using current first-party source | 5,145 passed, 0 failed, 4 symlink skips |
| Vault consumers using current source | 428 passed, 0 failed |
| Missing-vault regression suite | 31 passed, 0 failed |
| TypeScript | Exit 0 |
| Release suite | 97 passed; two Cline reply fixture tests also passed |
| Exact packaged broker | 12 synthetic loopback scenarios passed; process closed |
| Installed Cline 4.1.26 | 10 native controls passed, including actual request and visible public reply against a synthetic loopback provider |
| Native vault seed and cold restart | 6 controls each; actual SecretStorage reuse, app execution, cancellation and approved original restoration passed |
| Source process recovery drill | 8 child processes; interruption after vault commit, fresh-process recovery, idempotence and corrupt-ciphertext rejection passed |
| 0.6.2 to 0.7.0 CLI upgrade | Installation/metadata preservation and four runtime hashes passed |
| Current shipped dependency lookup | OSV returned no matches for `@babel/parser` 7.29.7, `jsonc-parser` 3.3.1 and `yaml` 2.9.0 |
| Review packet | 377 files byte-verified; no human verdict |
| Acceptance helpers | 16 JavaScript files passed syntax checks |

Suite counts overlap. The process recovery drill supplies an in-memory key through owned IPC and uses synthetic UI consent; it does not establish native SecretStorage interruption acceptance. The native restart separately proves cold-process SecretStorage reuse. The seed host and owning app exited before restart; a constant VS Code session ID was not treated as proof of process identity.

## Remaining work

1. **Final native Cline canary:** attempt 01 failed because its test required forwarding/redaction. The isolated client reported policy withholding, with zero canary upstream requests. That is not a demonstrated leak or a passing acceptance result. The revised attempt also requires a fresh benign task after the canary; it is prepared in `native-cline-canary-02` and has not run. Native tool-result/attachment and real external-provider acceptance remain incomplete.
2. **Populated legacy vault upgrade:** seed attempt 05 ended `Canceled`. The old extension waits for **Migrate & Backup**, but the driver had no renderer for legacy mode. The helper now handles that real dialog; `native-legacy-seed-06` is prepared and unexecuted. The original old product bytes are retained, but the fixture normalizes the old URI drive-letter casing; this must not be called unmodified legacy native acceptance. Current-version upgrade has not run. Restoration of old unbound raw entries remains intentionally withheld.
3. **Other current native acceptance:** reviewed-workflow and restricted-workspace runs are prepared but unexecuted for this candidate. Full native interrupted recovery remains incomplete.
4. **Independent acceptance:** human pilot, security and accessibility verdicts are absent. Reasoning-only subagent feedback and a valid review packet do not satisfy those verdicts.

The latest GUI execution request, for `native-cline-canary-02`, was rejected before launch with `CreateProcess Rejected("rejected by user")`. It was not retried or bypassed. Earlier technical `content-blocked` errors are historical; some native and network checks subsequently succeeded. No fresh approval is presumed from elapsed time.

## Prepared continuation

Run GUI suites one at a time after native execution is allowed again. Existing attempts are immutable; do not rerun a directory that already has a launch report.

```powershell
node scripts/soterai-installed-acceptance.cjs run docs/soterai-lite/evidence/20261114-release-gates/native-cline-canary-02
node scripts/soterai-native-legacy-upgrade.cjs run docs/soterai-lite/evidence/20261114-release-gates/native-legacy-seed-06
```

Only if the legacy seed succeeds and its owning processes close:

```powershell
node scripts/soterai-native-legacy-upgrade.cjs prepare-upgrade docs/soterai-lite/evidence/20261114-release-gates/native-legacy-upgrade-01 docs/soterai-lite/evidence/20261114-release-gates/candidate-pointer.json docs/soterai-lite/evidence/20261114-release-gates/native-legacy-seed-06
node scripts/soterai-native-legacy-upgrade.cjs run docs/soterai-lite/evidence/20261114-release-gates/native-legacy-upgrade-01
node scripts/soterai-installed-acceptance.cjs run docs/soterai-lite/evidence/20261114-release-gates/native-workflow-01
node scripts/soterai-installed-acceptance.cjs run docs/soterai-lite/evidence/20261114-release-gates/native-restricted-01
```

Complete external-provider and independent human acceptance separately. Immutable package receipts retain `releaseReady: false`; no ordinary profile was modified by these acceptance runs and no stable release is claimed.
