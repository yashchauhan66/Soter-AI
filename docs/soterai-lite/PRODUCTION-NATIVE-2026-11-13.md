# Installed Windows workflow acceptance — 13 November 2026

> **Historical candidate; current handoff:** [14 November provider-form fix and remaining gates](PRODUCTION-READINESS-2026-11-14.md).
> This record binds `528c3cb0`. Fresh `df92f72a` source/package/CLI/broker checks
> passed, but current native execution and advisory lookup remain incomplete.
> These retained native passes do not transfer to the fresh artifact.

The current SoterAI Secret Guard candidate has passed actual installed Windows
VS Code workflow tests for reviewed copying, restricted workspaces,
same-session vault migration/restoration and a configured synthetic Node app.
These are executed product workflows
with synthetic fixtures in isolated profiles. They advance the earlier
[production-readiness preparation](PRODUCTION-READINESS-2026-11-13.md), whose
native-launch and current-advisory blockers are now historical.

**Release status: Windows preview candidate; `releaseReady` remains false.**
The selected synthetic Node app ran successfully after migration; actual
supported Cline traffic,
interrupted/configured-upgrade recovery and independent human acceptance remain
open. No registry publication, provider acceptance or 10/10 verdict is claimed.

## Exact candidate

- Identity: `soterai.soterai-ide-guard`; display name: **SoterAI Secret Guard**.
- Version/target: **0.7.0, win32-x64, pre-release**.
- [VSIX](../../packages/soterai-lite/soterai-secret-guard-0.7.0-route-fix-20261113-attempt01.vsix).
- Size: **1,674,111 bytes**.
- SHA-256: `528c3cb0bfed0fa106d920c54694873a6023e7a1c123ba984ba89100b424741d`.
- [Receipt pointer](evidence/20261113-production-readiness/candidate-route-pointer.json)
  binds the immutable package receipt, build provenance and inventory.

The package receipt retains its packaging-time `PACKAGED_NOT_HOST_VERIFIED`
status. Later native reports below independently bind the same VSIX hash;
historical receipts are preserved rather than rewritten. Earlier same-version
objects, including the `e7f331a7` Cline-compatibility candidate, remain historical.
Matching version numbers do not transfer acceptance between artifacts.

## Product changes in this candidate

The adapter recognizes the reviewed Cline 4.1.25 and 4.1.26 bytes. The latest
route fixes refuse a conflicting legacy URL override and preserve repeated
setup of a current configuration. Expired or drifted sessions require reviewed
restoration before fresh setup. These source contracts protect configuration
state; they do not establish live Cline routing or provider coverage.

The earlier guided setup, live findings, reviewed code/debug previews,
names-only environment contracts and reviewed vault actions remain available.
The practical benefit is concrete: a developer can inspect useful code or error
context with detected values removed before choosing to copy it, and can review
vault migration and restoration rather than modifying a project blindly.

## Current exact-object evidence

| Check | Executed result | Evidence |
| --- | --- | --- |
| Affected source regressions | **110 pass, 0 fail, 0 skip** | [TAP](evidence/20261113-production-readiness/affected-route-final.tap) |
| TypeScript | Exit 0 | [Log](evidence/20261113-production-readiness/typecheck-route-final.log) |
| Package, receipt and inventory | Passed | [Package log](evidence/20261113-production-readiness/package-route-final.log) and receipt pointer above |
| Actual installed reviewed workflow | **11 checks passed**, VS Code 1.146.0 | [Host result](evidence/20261113-production-readiness/workflow-native-route-04/host-result.json) |
| Actual installed restricted workspace | **6 checks passed**, observed trust false | [Host result](evidence/20261113-production-readiness/restricted-native-route-01/host-result.json) |
| Actual installed vault workflow | **6 checks passed**, same-session migration/restoration | [Host result](evidence/20261113-production-readiness/vault-native-route-01/host-result.json) |
| Actual installed configured vault app | **8 checks passed**; selected Node app exited 0 with verified visible output | [Host result](evidence/20261113-production-readiness/vault-app-native-route-06/host-result.json) and [launch result](evidence/20261113-production-readiness/vault-app-native-route-06/native-launch.json) |
| Actual unchanged Cline 4.1.26 legacy-route refusal | **6 checks passed**; refused override without owned writes/backups; owned broker stopped cooperatively | [Host result](evidence/20261113-production-readiness/cline-native-legacy-route-02/host-result.json) |
| Packaged broker | **6 synthetic loopback scenarios passed**; child closed | [Result](evidence/20261113-production-readiness/broker-route-final/result.json) |
| Isolated 0.6.2 → 0.7.0 CLI upgrade | Synthetic metadata preserved; four runtime hashes verified | [Result](evidence/20261113-production-readiness/upgrade-install-route-final/result.json) |
| Current shipped-component OSV lookup | **0 known matching advisories** across three shipped npm components | [Result](evidence/20261113-production-readiness/advisories-route-final/result.json) |
| Independent review packet | **377 files byte-verified**; human reports unfilled | [Review instructions](evidence/20261113-production-readiness/review-kit-route-final/REVIEW.md) |

Counts describe their own runs; repeated source runs and shared activation
controls are not cumulative feature or human-review counts. Historical 153 and
93 source suites remain available in the earlier record and are not relabeled
as executions against this new artifact.

The eleven reviewed-workflow checks exercised installed activation, debug and
environment copying, keeping a preview without copying, cancellation,
source/preview/settings drift refusal, concurrent review refusal, a live
quick-fix review and refusal to reuse an action. The UI driver selected the real
installed product's controls. The restricted-workspace run verified local
findings and refusal of reviewed context, vault migration, finding actions and
adapter setup in an untrusted workspace; it is extension-host automation rather
than a screen-reader or human usability review.

The vault run exercised cancellation before migration and restoration, reviewed
migration, encrypted records, a safe example and restoration of the original
synthetic file in the same session. The separate configured-app run selected
the synthetic Node program, source and two variables through the real reviewed
configuration UI. The extension-owned job reached `EXITED` with exit code 0,
the task completed, and `VAULT_APP_OK=true` matched the native terminal's
accessibility view. Source, vault and program-byte checks passed; cancellation
and raw restoration passed afterward. This closes the selected synthetic app's
runtime gate. It does not establish support/usability across other frameworks,
recovery across interruption or configured upgrade, or certify operating-system
secret custody. The separate CLI upgrade proves installation and synthetic
metadata preservation, not vault decryption/recovery.

The native Cline legacy-route run activated the exact installed SoterAI and
unchanged pinned Cline 4.1.26 in a synthetic home/profile. A conflicting legacy
URL override was refused with `CLINE_LEGACY_ROUTE_OVERRIDE_UNSUPPORTED`; owned
entries and backup snapshots remained unchanged. The extension-owned broker
then stopped cooperatively. Neither product API nor vendor manifest/runtime
was mocked or modified. These controls prove the tested refusal and activation,
not public task completion, provider routing, request/tool-result canaries or
attachment protection. The [public loopback preparation](evidence/20261113-production-readiness/cline-native-loopback-route-03/prepared.json)
has not yet executed; no passing route result is inferred from preparation.

The broker uses a synthetic loopback receiver. Useful public content passed;
detected values were redacted, and selected nested/strict-policy requests were
withheld. It does not prove that unchanged Cline sends all relevant inputs
through the supported route or that a real provider handled them.

OSV was queried for the shipped SBOM components `@babel/parser` 7.29.7,
`jsonc-parser` 3.3.1 and `yaml` 2.9.0. Zero known matches is a current advisory
lookup result, not a complete security audit or a guarantee of no defects.

## Open acceptance gates

1. **Actual supported Cline route.** Exercise unchanged, hash-pinned Cline with
   useful benign controls and synthetic request, tool-result and attachment
   canaries. Record precisely which paths were covered. Isolated loopback vendor
   execution and an actual provider trial are separate claims; neither is
   established by the broker or public-source contract checks alone.
2. **Interrupted and configured-upgrade recovery.** Verify restart/interruption,
   upgrade with populated encrypted state and useful recovery in an installed
   profile. Same-session restoration and metadata-only upgrade are narrower
   evidence.
3. **Real independent acceptance.** Run developer pilots and relevant independent
   security/accessibility review, including real keyboard/screen-reader use.
   The user confirmed these reviews have not happened. Generated reports,
   builder-run profiles and agent reasoning do not establish independent people.
4. **Final release handoff.** Resolve applicable findings, confirm advertised
   scope, obtain the owner's final release decision and verify the exact served
   objects/target/channel on both VS Code Marketplace and Open VSX. The local
   publishing wrapper remains disabled; no upload is reported here.

These gates can be closed only with their own exact evidence. Do not advertise
universal interception of AI tools, same-user filesystem access or unmanaged
uploads. Docker/AWS experiments are separate scope unless explicitly offered
as supported Windows Lite production features.

## Retained application diagnostics

Current app acceptance is the complete passing **vault-app-native-route-06**
report above. Earlier attempts remain available for diagnosis. The first
[app attempt](evidence/20261113-production-readiness/vault-app-native-route-01/host-result.json)
timed out at configuration with `VAULT_TIMEOUT` / `RENDERER_ACK`.
Attempt 05 [verified visible successful output](evidence/20261113-production-readiness/vault-app-native-route-05/ui-step-5.json)
but did not produce its final host report because the test harness's Windows
path-case traversal failed. The fix was confined to the harness; attempt 06
completed the full installed-product workflow and report using the same
immutable candidate. Earlier partial runs are not relabeled as full passes.

## Marketing assets and provisional assessment

The [launch kit](../../marketing/extension-launch-2026-11-13/README.md) now includes
actual installed-product screenshots of the reviewed debug preview and
environment contract. Their captions identify synthetic fixtures and an
isolated driver host; they are not provider demos. Promotional illustrations
remain labeled separately.

The current subjective assessment is **7.5/10 overall**, **8/10 usefulness for
supported workflows**, and **6/10 stable-release readiness**, provisional while
Cline integration and remaining acceptance are open. Reviewed copying,
same-session vault controls and the selected synthetic Node app
now have native evidence, which supports the higher assessment. Stable release
still needs interruption/upgrade recovery, integration and human evidence. Passing more
local tests alone would not establish 10/10 or broad market usefulness.

Recommend the current build for controlled **Windows preview/pilot testing**.
Do not present it as a fully accepted stable security release. Keep the message:
**“Check secrets before your next AI prompt.”**
