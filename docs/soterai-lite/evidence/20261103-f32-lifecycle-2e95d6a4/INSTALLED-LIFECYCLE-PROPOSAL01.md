# F32 installed-only lifecycle fixture source proposal01

Status: **INERT SOURCE ONLY / NOT_RUN**. This packet implements the existing F32 work card's test instrumentation; it does not replace the implementation plan. No install, Code/Edge launch, build, test, network request, Git write, profile mutation or F26a retry was performed while authoring it. Root must review these sources and bind current source, exact newly built VSIX, complete payload/runtime rows, current vendor pins and marked-owner absence before materializing a runnable wrapper. These sources are not a native PASS.

## Product admission and instrumentation

Install the actual immutable local VSIX using the signed installed Code executable and its exact reviewed out/cli.js:

    Code.exe <cli.js> --user-data-dir=<fresh-profile> --extensions-dir=<fresh-extensions> --install-extension <exact-local.vsix> --do-not-sync --force

ELECTRON_RUN_AS_NODE=1 applies only to CLI operations. Every operation uses shell:false, scrubbed synthetic environment, fixed arguments and the existing owned child helper. Require actual exit0, natural close and both EOF before the next phase. First/last CLI inventories must prove exactly the product installation, no extension dependencies/pack and no extra product installs. CLI setup duration is separate from default onboarding timing.

The window gets **one development extension: the separate observer soterai-fixture.f32-installed-observer**. Declare this instrumentation; never package it as the product. Product extensionDevelopmentPath, loader/require interception, changed product manifest, thin bootstrap, forced Extension.activate(), mocked vscode/prompts and patched command functions are forbidden. The actual public registry must resolve the product under the isolated extensions directory. Installed package.json and every declared runtime must match extracted exact VSIX payload bytes. Observer calls fixed public commands and reads real results.

The attach-only renderer observes the owned workbench over numeric127.0.0.1 CDP. Pin owner and fresh read-only listener-custody receipts: listener PID must be the witnessed Code child or its enumerated tree, with exact synthetic profile. Pin local Playwright entry/dependency graph and verified connectOverCDP transport-disconnect implementation before use. No browser launch. Inputs use real keyboard; DOM operations only read text/focus/visibility. Frozen prompt/button allowlist refuses unknown UI. No synthetic values, raw native results or exception messages enter evidence.

## Source contracts

- installed-observer-proposed-01.cjs: public API observer; product is never imported. SOTERAI_F32_BINDING points to immutable per-phase admission, and writes are exclusive metadata evidence. Native prompts retain confirmation authority.
- installed-observer-package-proposed-01.json: test instrumentation manifest only. Copy as package.json with observer source as observer.cjs in a unique synthetic observer directory. No canonical/product manifest changes.
- installed-renderer-proposed-01.cjs: standalone attach-only real keyboard driver, invoked only after actual Code PID, current vendor review and listener custody. Nonce-bound UI completion follows real observed UI.
- installed-launch-contract-proposed-01.cjs: inert exports for CLI/window arguments, isolated settings and scrubbed environment. **No main function or process launch**. Root supplies the established owned runner/custody/finalization wrapper; this is not an executable admission shortcut.

Binding requires schemaVersion1/featureF32/status REVIEWED_ONE_NORMAL_ROUND, one D: root f32-installed-UTC-nonce with child profile/extensions/workspace/gate/observerRoot, phase, current product id/version/manifest/runtime4 payload facts, exact localVSIX, deniedFile/envFile paths, declared synthetic canary and launchWallMs immediately before owned Code spawn. Renderer additionally needs endpoint, codePid, ownerReceipt/listenerCustody **fact objects**, rendererPins, local Playwright entry and initial trust choice. Root admission must pin all bytes, restrict paths to that one root and prove current source/VSIX/vendor facts. A status string alone is never admission.

Before first startup, exclusive USER settings disable autoVaultMigration, broker.autoStart, cloud/providers, schema downloads, telemetry, updates, experiments and recommendations. Preserve enabled workspace trust: no --disable-workspace-trust or --disable-extensions. Observe the actual native trust choice for the exact synthetic project. Prepare a valid policy fixture, .aiignore, denied.txt and .env containing only a clear synthetic canary. Bind policy/.aiignore facts as retained-inputs.json. Real restrictProjectFile/preview and native migrateSecretsToVault approval create genuine deny/recovery state. Hash generation/current vault ciphertext and placeholder file without decryption or SecretStorage reads.

## Fixed assertions and sequence

I01–I28 are **28 unique assertions**. Repeated identity/payload/startup observations in later phases never add to that unique count.

| Phase | IDs | Actual evidence required |
| --- | --- | --- |
| Fresh install / primary | I01–I04 | Installed identity/path, unchanged manifest, four payload hashes, actual default activation/commands under120s without forced activation. Outer evidence independently proves admin0/extra installs0; observer does not hardcode either PASS. |
| Primary optional workflows | I05–I10 | Real deny save and preview withholding; native migration/placeholders/encrypted generation; no-argument summary cancel; forged arguments cannot bypass summary; reviewed checked profile and secure association configuration. |
| Primary recovery | I11–I17 | Aggregate retains per-action native cancel; reviewed restoration requires actual STOPPED; policy/ciphertext unchanged; saved deny active; machine flag off withdraws and retains data; reenable configures a receipt for restart. |
| Same profile normal restart | I18–I22 plus repeated I01–I04 | Persisted setting, native restoration of receipt, policy/ciphertext unchanged, saved deny active, repeated absent inventory conservative. |
| Fresh restricted-mode profile, same project | I23–I24 plus repeated I01–I03 | Actual native don't-trust choice, untrusted removal INCOMPLETE, unchanged settings/policy/ciphertext. No mocked workspace or trust-flag coverage inference. |
| Disabled product | I25–I26 | Start with --disable-extension=soterai.soterai-ide-guard; observer separate; product inactive/restore command unavailable and data unchanged. This is launch-disabled behavior; live disable/reload needs separate actual UI evidence. |
| Actual CLI uninstall | I27–I28 | After close+bothEOF and owner absence, actual local CLI uninstall exit0+close+bothEOF, inventory absent, observer-only window sees no product and retained data/ciphertext intact. No recovery cleanup. |

Preserve real rows, timing, product/instrumentation facts, inventories, launch/close/pipes and failures. Primary PASS is not all F32. An unresolved phase means INCOMPLETE; no component interpolation, dev-host relabeling or suppressed cases.

## Withdrawal and rounds

Reuse byte-reviewed ../20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs for CLI/Code/renderer/custody children, or separately reviewed successor. It owns both pipes before spawning, bounds retained streams, records deadline without a signal and awaits actual close. Observer uses real workbench.action.closeWindow. Require declared broker/terminal/vault child custody and natural close+bothEOF, twice-observed exact owner absence and stable streams before next phase. Main Code close proves no unknown nested descendant closure. Deadline or remaining owner stops the chain with retained evidence; no kill/signals/retry. Historical84707 closure remains unconfirmed.

Existing plan permits at most three normal improvement rounds. No source grants extra rounds or retries. Root must record single-round consumption before launch, retain failures, and honor smaller applicable bounds. F26a remains owner-skipped INCOMPLETE/unsupported, no original34/native attempt.

## Required upgrade and gaps

**Actual old-version upgrade is NOT IMPLEMENTED / NOT_RUN in this first packet. F32 cannot be DONE using current-version replacement.** Prior candidate admission:

- packages/vscode-extension/soterai-ide-guard-0.6.3.vsix:4446653bytes, SHA256 dcbcd9738cb480616cf4d3aa66d1a1ac2287e1754aa7307dea7ac23fee7c3677, id soterai.soterai-ide-guard/version0.6.3.
- Old broker.autoStart and autoVaultMigration.enabled defaulttrue; safe isolated USER settings MUST exist before first old startup. Old startup has automatic watcher/timer paths. It has onStartupFinished, no extensionDependencies/pack, three declared runtimes. Inspect/bind exact old payload/public commands; never fake version bytes or apply current four-runtime expectations.
- Separate retained synthetic profile must install/observe old product, create genuine known old policy/recovery through supported public APIs, naturally close and freeze bytes, then CLI install current exact VSIX into SAME isolated extensions/profile and verify genuine version transition, preservation, restart/review/withdrawal. Incompatible/unavailable old routes stay named gaps.

Still missing: runnable final binding/owned wrapper; current vendor admission; source syntax/build checks; actual installed/native execution; real old upgrade phase; live disable/reload UI if catalog requires it; installed-only drift/busy/corrupt cases; affected tool checks; source/ledger/commit byte barriers. Human/independent final evidence and originalL6 HUMAN-ACTIONS STOP remain separate. No release readiness, rating, publish, push or tag is claimed.
