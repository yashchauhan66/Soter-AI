# Current release handoff — 14 November 2026

SoterAI Secret Guard has a fresh Windows preview candidate fixing provider-form
focus loss and cancellation. **115 affected source checks, TypeScript, exact
packaging, six packaged broker scenarios and isolated CLI metadata upgrade
passed. Current-candidate native acceptance and advisory lookup remain
incomplete. `releaseReady` is false; this is not a fully accepted stable release
or a 10/10 security verdict.**

The user has already approved isolated native testing. Automatic approval
review returned a technical `content-blocked` error before execution for two
approved current Cline launches and the outside-sandbox advisory lookup. These
are approval-system execution failures, not native test failures or a verdict
that the approved actions were unsafe. Existing authorization remains valid;
the prepared manual terminal sequence below is a concrete execution handoff.

A separate root retry of adjacent routing tests was also rejected before
execution. An earlier authorized sub-agent execution subsequently completed:
**16 tests passed, zero failures/skips**, including the four D-drive ownership
controls. The exact rejected attempts are recorded in
[execution blockers](evidence/20261114-production-finish/execution-blockers.json);
they are not substituted for the later successful regression result.

## Exact current candidate

- Identity/display name: `soterai.soterai-ide-guard`, **SoterAI Secret Guard**.
- Version/target: **0.7.0, win32-x64, pre-release**.
- [Current VSIX](../../packages/soterai-lite/soterai-secret-guard-0.7.0-provider-input-fix-20261114-attempt01.vsix).
- Size: **1,674,363 bytes**.
- SHA-256: `df92f72ae4672ed8f4857b0cfba51fc422b7811ad57aff36b76b417e149ef55f`.
- [Receipt pointer](evidence/20261114-production-finish/candidate-pointer.json)
  binds the package receipt, build provenance and final inventory.

The receipt remains `PACKAGED_NOT_HOST_VERIFIED`, with `releaseReady: false`.
All current checks below bind this object. Historical native results for
`528c3cb0` and other 0.7.0 builds are preserved separately; the shared version
number does not transfer installed-product acceptance to the new bytes.

## Product fix and source evidence

The three provider inputs in
[broker commands](../../packages/vscode-extension/src/broker/commands.ts)
now use `ignoreFocusOut: true`. Losing editor focus keeps the input pending.
Cancellation returns immediately after each field when VS Code returns
`undefined`, before configuration or credential writes. Explicit Enter on an
optional blank endpoint remains accepted; an explicitly accepted blank key
retains the existing stored key.

The five focused regressions reproduced **1 pass / 4 fail** before the change
in [the retained red run](evidence/20261113-production-readiness/broker-provider-focus-red-01.tap).
All five pass as the first five checks in the current 115-check affected run.
The historical mixed `broker-provider-focus-green-01.tap` also contains unrelated
filesystem failures and is not presented as a clean passing suite.
The subsequent [authorized 16-test green run](evidence/20261113-production-readiness/broker-provider-focus-green-02.tap)
passed all form and adjacent routing ownership controls. These source/regression
results remain separate from installed Cline/provider acceptance.

## Executed current-object checks

| Check | Result | Evidence |
| --- | --- | --- |
| Affected source suite, including five provider-form regressions | **115 pass / 0 fail / 0 skip** | [TAP](evidence/20261114-production-finish/affected.tap) |
| TypeScript | Exit 0 | [Log](evidence/20261114-production-finish/typecheck.log) |
| Package, receipt and final inventory | Passed | [Package log](evidence/20261114-production-finish/package.log) and current pointer above |
| Packaged broker | **Six synthetic loopback scenarios passed**, child closed | [Result](evidence/20261114-production-finish/broker/result.json) |
| Isolated CLI install upgrade 0.6.2 → 0.7.0 | Synthetic metadata preserved; **four runtime hashes verified** | [Result](evidence/20261114-production-finish/cli-upgrade/result.json) |
| Independent review packet | **377 files byte-verified**; human reports unfilled | [Review instructions](evidence/20261114-production-finish/review-kit/REVIEW.md) |
| Current shipped-component advisory lookup | **LOOKUP_INCOMPLETE** | [Sandbox result](evidence/20261114-production-finish/advisories-sandbox-01/result.json) |
| Current installed workflows, restricted workspace, Cline and vault seed/restart | **Not executed** | Prepared runs and execution handoff below |

Source tests verify the form contracts; they are not proof of fresh installed
UI acceptance. The broker is a synthetic receiver, not unchanged Cline or a
real provider. The CLI upgrade checks installation and synthetic metadata,
not vault decryption or configured upgrade recovery. A verified review packet
establishes bytes, not independent human/security/accessibility approval.

The advisory request covers `@babel/parser` 7.29.7, `jsonc-parser` 3.3.1 and
`yaml` 2.9.0 from the fresh SBOM. Sandbox network access did not complete the
lookup; its outside-sandbox retry was rejected before execution. The
[13 November zero-known-match result](evidence/20261113-production-readiness/advisories-route-final/result.json)
for the same three versions remains historical. It is not relabeled as a
completed fresh-candidate/current-day lookup or a security audit.

## Historical native product evidence

The earlier `528c3cb0bfed0fa106d920c54694873a6023e7a1c123ba984ba89100b424741d`
candidate, 1,674,111 bytes, passed these actual installed VS Code 1.146.0 runs:

| Historical scope | Actual result |
| --- | --- |
| Reviewed code/debug/environment copy, cancellation, drift and one-use controls | **11 checks passed** |
| Restricted workspace findings and refusal of sensitive actions/setup | **6 checks passed** |
| Configured synthetic Node app after reviewed vault migration, visible `VAULT_APP_OK=true`, exit 0, cancellation/restoration | **8 checks passed** |
| Unchanged pinned Cline 4.1.26 activation/home isolation/legacy-override refusal without owned writes/backups/cooperative broker stop | **6 checks passed** |

Exact reports and limitations are retained in
[the 13 November native handoff](PRODUCTION-NATIVE-2026-11-13.md). These are
useful implementation history, not current-object native passes. The app run
was a selected synthetic fixture and same-session restoration; it did not
establish arbitrary framework usability, interruption or configured-upgrade
recovery. Cline legacy refusal did not establish public task completion,
request/tool-result/attachment canaries or external-provider acceptance.

## Prepared manual terminal sequence

Run from the repository root in the owner's PowerShell terminal, **one command
at a time**. Inspect each result and stop dependent steps after a failure.
These scripts preserve historical evidence and use isolated profiles/synthetic
fixtures. The ordinary IDE/provider profile is not the test target. Current
prepared drivers are bound to the exact candidate and their saved source
hashes; do not edit a prepared driver or reuse it for another VSIX.

First verify the fresh independent review packet:

```powershell
node docs/soterai-lite/evidence/20261114-production-finish/review-kit/verify.cjs df92f72ae4672ed8f4857b0cfba51fc422b7811ad57aff36b76b417e149ef55f
```

Then run the already prepared fresh workflow, restricted-workspace and Cline
synthetic public-loopback suites sequentially:

```powershell
node scripts/soterai-installed-acceptance.cjs run docs/soterai-lite/evidence/20261114-production-finish/native-workflow-01
node scripts/soterai-installed-acceptance.cjs run docs/soterai-lite/evidence/20261114-production-finish/native-restricted-01
node scripts/soterai-installed-acceptance.cjs run docs/soterai-lite/evidence/20261114-production-finish/native-cline-loopback-01
```

For each, require a passing `host-result.json` and successful
`native-launch.json` bound to `df92f72a`. An exited launcher or a prepared file
alone is insufficient. Cline success here would prove the recorded synthetic
public loopback route/reply scope; it would not automatically establish an
external provider, secret canaries or attachments.

The vault restart test is a **two-phase sequence**. Run the prepared seed first:

```powershell
node scripts/soterai-installed-acceptance.cjs run docs/soterai-lite/evidence/20261114-production-finish/native-vault-seed-01
```

Only after its host status is `PASS_NATIVE_VAULT_APP_SEED`, its source state is
`MASKED`, and its same-hash native launch succeeded, prepare the restart using
that seed and the same receipt pointer, then run it:

```powershell
node scripts/soterai-installed-acceptance.cjs prepare docs/soterai-lite/evidence/20261114-production-finish/native-vault-restart-01 docs/soterai-lite/evidence/20261114-production-finish/candidate-pointer.json vault-restart docs/soterai-lite/evidence/20261114-production-finish/native-vault-seed-01
node scripts/soterai-installed-acceptance.cjs run docs/soterai-lite/evidence/20261114-production-finish/native-vault-restart-01
```

Preparation validates the accepted seed before binding its preserved profile.
Require `PASS_NATIVE_VAULT_RESTART` and a successful same-hash native launch.
The seed/restart runs have **not executed**; no restart result is claimed.
This controlled reopen sequence must still be distinguished from interruption,
crash or populated-state upgrade recovery.

For a fresh public OSV lookup with network access:

```powershell
node scripts/soterai-shipped-advisories.cjs docs/soterai-lite/evidence/20261114-production-finish/candidate-pointer.json docs/soterai-lite/evidence/20261114-production-finish/advisories-manual-01
```

Inspect the saved result and applicable advisories. The output directories are
create-only: preserve failures and prepare a new named attempt if a retry is
needed, rather than deleting or overwriting prior evidence. Provider credentials
stay in the owner's trusted setup; do not include credentials or raw private
clipboard/configuration content in reports.

## Remaining production gates and release decision

1. Execute and assess fresh exact-object native workflow, restricted-workspace,
   selected app/controlled restart and unchanged pinned Cline loopback evidence.
2. Complete actual supported Cline/provider request, tool-result and attachment
   canaries with useful benign controls; record the covered paths precisely.
3. Verify meaningful interruption and populated encrypted-state upgrade/recovery.
   Historical same-session restoration and current metadata-only CLI upgrade
   are narrower evidence.
4. Complete the fresh shipped-advisory lookup and review/remediate any findings.
5. Run real developer pilots and relevant independent security/accessibility
   review. The user confirmed independent reviews have not occurred.
6. Resolve acceptance findings, approve final advertised scope and have the
   owner decide release. Verify served artifact/target/channel independently on
   VS Code Marketplace and Open VSX after any eventual authorized publication.

No registry upload, site deployment, social post or message was performed.
Publishing remains disabled locally. Arbitrary same-user reads and unmanaged
uploads are outside the advertised protection; Docker/AWS experiments remain
separate scope unless offered as supported production features.

The subjective assessment remains **7.5/10 overall**, **8/10 usefulness for
supported workflows**, and **6/10 stable-release readiness**. Historical native
workflows support the practical usefulness assessment; current native execution
is blocked and these ratings are provisional, not fresh-object certification.
Recommend controlled **Windows preview/pilot testing**, while stable publication
still requires the gates above. Keep the marketing message:
**“Check secrets before your next AI prompt.”**
