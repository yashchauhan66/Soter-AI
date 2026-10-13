# Current requirements audit — 13 October 2026

## Verdict

The user's five requirements are **not fully fulfilled**. There is a real approval-and-masking implementation for SoterAI-managed reads. It does not intercept all native AI tools, original editor documents, normal shells, copies/history or independent uploads. Restricting scope to the project does not remove those access routes.

This is a **STATIC-ONLY source assessment plus fresh inspection of retained synthetic execution evidence**, not a new product test run. No feature implementation, build, install, publication or real-secret inspection was performed. The earlier L0 disk STOP gate remains failed: the first measurement in this audit was 2,114,633,728 available bytes (1.9694061279296875 GiB). New Lite stages remain NOT-RUN. Independence: LOW, including same-lineage adversarial source/evidence review.

## Five requirements

| Requirement | Implemented in current local source/candidate | Remaining for the full demand | Status |
| --- | --- | --- | --- |
| 1. AI cannot read project secrets | Known sensitive-path exclusions, managed redaction, names-only dotenv views, always-masked sensitive-file summaries; explicit encrypted vault migration replaces reviewed disk values with placeholders | Direct original filesystem reads, original editor buffers, unrecognized secret/prose, copies/history, inherited environment and independent network routes remain accessible. A custom non-TextDocument secret editor and complete app runtime integration are not delivered by the new Lite task | PARTIAL |
| 2. User easily restricts files | Explorer/privacy actions; file/folder/glob and protected-region policies; retained add-only denies; sensitive markings saved with the deny | These are managed policy restrictions, not another process's filesystem permissions. Other tools are not compelled to use them. Sensitive-deny relaxation is missing; generic restriction action cannot report persistence success precisely | PARTIAL |
| 3. Terminal permission, then masked env; ordinary-file release with permission | Explicit managed reader asks for each saved-file snapshot, rejects cancellation/drift/revocation, emits every dotenv value as `[MASKED]`, wholly withholds other sensitive content; ordinary file can get a one-time redacted view while deny remains | `SoterAI Project Reader` accepts only `read/help/clear`; it is not a PowerShell/bash shell. Normal AI terminal commands are not stopped before reads. Existing shell watcher observes after execution starts. No guarded shell with inherited-secret removal and full output masking is established | PARTIAL |
| 4. Professional, easy UI/UX | Native Activity Bar sidebar, control panel/tree views, status feedback, themed UI, keyboard/focus support, contrast/motion CSS; searchable/paginated privacy inventory and explicit scope/outcomes | Main controls and separate privacy editor panel need a simpler primary flow. Real-user usability, real screen reader and comprehensive accessibility verification remain unmeasured. Browser visuals do not establish enterprise usability | PARTIAL / human validation NOT-RUN |
| 5. Protect every project leak surface | Local scanning, managed read/context exclusion, reviewed paste/redaction, Git change checks, config risk detection, encrypted recovery outside workspace and checking of requests routed through the broker | Raw files/buffers, aliases/copies, inherited env/output, old Git objects, logs/debug/build output and independent uploads have no complete boundary. Detection cannot recognize every secret. Nine observed host-survey leak cases remain | INCOMPLETE |

Relevant source: `packages/vscode-extension/src/project-privacy/{ProjectFileAccess,SafeFileView,ReadTerminal,commands,panel}.ts`, `src/ai-boundary/{BoundarySnapshot,policy,commands}.ts`, `src/terminal/ShellExecutionWatcher.ts`, `src/secret-shield/{SecretFileInterceptor,AutoVaultMigration}.ts`, `src/firewall/VaultManager.ts`, and `packages/guard-core/src/{ContextRedactor,sensitiveFiles}.ts`. The evidence script hashes the inspected core source files.

## What the permission-and-mask implementation actually does

After one native confirmation, an approved dotenv view returns only a schema, for example:

```text
DATABASE_URL=[MASKED]
API_KEY=[MASKED]
PORT=[MASKED]
```

Every value is masked, including ordinary settings; comments and multiline value content are omitted. Non-dotenv sensitive files produce a withheld summary. Ordinary restricted files return a recognized-secret/protected-region-redacted saved-file snapshot after approval; unknown private text can remain. The stored deny remains. The 60-second lifetime is pending-review expiry, not recall of previously released safe output.

Sources: `SafeFileView.ts:13`, `SafeFileView.ts:55`, `ProjectFileAccess.ts:45`, `project-privacy/commands.ts:64`, `BoundarySnapshot.ts:187`. `ReadTerminal.ts:5` explicitly excludes other terminals. `ShellExecutionWatcher.ts:132` explains that the shell command is already running. `SecretFileInterceptor.ts:5` explains that document-open notification happens after the document is available; it does not remove plaintext from `workspace.textDocuments`.

## Freshly checked retained evidence

These runs happened on **12 October 2026**, not in this audit. Counts and existing object identities were checked again without rerunning the product.

| Retained evidence | Checked result | Practical limit |
| --- | --- | --- |
| `docs/project-privacy/evidence/20261012-final-local/full-tests-agent-target.log` | 793 test records, 106 suites; 790 PASS / 0 FAIL / 3 SKIP | Unit assertions; three skipped Windows symlink cases remain untested |
| `raw/functional/functional-results.json` under that evidence directory | 10 PASS / 0 FAIL | Real isolated editor, synthetic files, scripted dialogs; no live Cline interception proof |
| `raw/security/live-host.json` and `host-comparison.json` | 17 cases: 8 BLOCKED_SCOPED / 9 LEAK_CONFIRMED; all compared rows match | Direct `.env`, restricted file and key reads; hardlink/junction reads; inherited environment/output; Git history; independent encoded delivery remain exposed |
| `raw/native/results.json` | 9 scoped blocks, 9 leaks, 6 public controls, 1 identity observation, 1 NOT_REPRODUCED | Overlapping observations, not 18 distinct leaks |
| `visual-results.json` | Aggregate receipt reports 30 PASS / 0 FAIL | No individual controls there for independent recount; browser-template checks, not human usability/screen-reader certification |

Cline tool/provider routing: NOT_TESTED. Claude Code retained CLI check: INCOMPLETE because not logged in. Public-context controls for other CLIs do not prove protected-file denial. Linux/macOS/remote behavior is not verified by these Windows records.

No Lite Coverage Score is assigned: the new frozen Lite catalog and per-tool positive/negative/mutation verification have not run. Unit pass count is not a confidentiality percentage.

## Download/install readiness

Automatic activation (`onStartupFinished`), local scanning/protection defaults, first-run walkthrough and local broker auto-start exist. The broker uses the bundled runtime through Electron's Node execution; a user does not need to run npm for that component. However, routing/config changes and vault migration require review, and the broker's default fixed port can conflict with another window/service. Therefore installation is not equivalent to verified AI protection.

The normal `packages/vscode-extension/soterai-ide-guard-0.6.3.vsix` is **a different older artifact** from the tested project-privacy candidate:

| Object | Freshly computed SHA-256 |
| --- | --- |
| Current `packages/vscode-extension/dist/extension.js` | `d8abff1a7ac48809420bb4f2862b8d9700ccc85c9b5cd97152608be85556b032` |
| Tested dated candidate `docs/project-privacy/evidence/20261012-final-local/soterai-project-privacy-0.6.3-20261012.vsix` | `7b590560325aa46c3519cbf6bf0300c7bf7783d910cbae7d89e4636010e61c2c` |
| Normal local `packages/vscode-extension/soterai-ide-guard-0.6.3.vsix` | `dcbcd9738cb480616cf4d3aa66d1a1ac2287e1754aa7307dea7ac23fee7c3677` |
| Extension inside normal local VSIX | `7746177a904ec5579938aa9282486680febde0129334b8c47941588de6069c53` |

The dated candidate has 16 entries; all 16 sizes/hashes match its retained inventory, and its three runtime bundles/manifest/verification JSON match current files. The normal local VSIX has 21 entries; its runtime bundles and manifest differ and it lacks the project-privacy verification JSON. Results for the dated candidate cannot be attributed to the normal local VSIX or a Marketplace download. Current Marketplace artifact identity and a current exact-VSIX clean-profile-only install remain UNVERIFIED. A development host run is not that installation test.

## Practical extension-only product direction

For the user's download-and-use goal, the appropriate bounded product is **Lite: no VM, administrator setup, controller deployment or external software installation**. Local detection can start automatically. User file selection and access approvals remain part of the workflow. Supported AI adapters still need explicit config consent and verified actual tool behavior; they cannot be silently treated as routed.

Required work, in priority order:

1. Package one current Lite VSIX with an exact artifact identity, separating Full/controller/VM/protocol scaffold from its shipped runtime. A new Lite split has not happened.
2. Connect each supported AI tool's verified permission/deny hooks and the safe-read MCP adapter; test real file and terminal requests. Keep unsupported tools visibly Uncovered.
3. Deliver an opt-in guarded real terminal with scrubbed inherited environment and registered-value output masking; keep shell/parser bypasses explicit. The tiny managed reader is not a substitute for a development terminal.
4. Finish a masked custom secret editor and an optional vault workflow with safe Run/Task/Debug injection and recovery. Existing migration is an encrypted file in extension global storage with its key in SecretStorage, not complete OS-store-per-value plus runtime injection. Replacing `.env` values with placeholders alone can break a real application.
5. Expand leak discovery for history, source/config families, logs/debug output, caches/build artifacts and secret copies; do not promote discovery to universal enforcement.
6. Consolidate primary UI around Protected items, Activity and measured Coverage; add an actual canary Verify setup action, clear error states, effective rollback and human accessibility/usability checks.
7. Fix automatic broker port selection/multi-window coexistence, then measure a clean profile installation using only the exact VSIX, with no admin/extra installs. Prepare publishing only after required evidence; do not publish automatically.

Additional source findings to fix behind flags with regressions: `project-privacy/commands.ts:105` cannot establish saved-policy success because `ai-boundary/commands.ts:55` catches errors without returning status. `VaultManager.ts`'s `redactValuePreview` retains the first/last two characters for longer values; a strict fully masked preview should withhold these too. These are STATIC-ONLY findings, not dynamically reproduced defects in this audit.

## Architectural limit

Microsoft documents that extensions run with the editor's permissions and can access files, run processes and make network requests: [VS Code extension runtime security](https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security). **Inference:** a conventional extension cannot promise universal denial of arbitrary same-user AI/native reads merely because the protected file is inside the project. Supported cooperative tools can have documented controls and managed routes verified. A hostile same-user confidentiality guarantee needs a separately enforced boundary and is outside the install-only Lite promise.

Source-only broker finding: current `BrokerManager.ts:147` creates a control token and `:168` supplies `SOTERAI_BROKER_CONTROL_TOKEN`. The prior blanket assertion that this token is absent must not be repeated. Token presence does not certify the complete authentication/threat model. Dedicated sensitive-deny relaxation remains missing.

## Next step and block

The first-check request is completed by this assessment. Product implementation and fresh builds/tests remain blocked by the earlier explicit **20 GB else STOP** gate. Free C: space to at least 20 GiB and send the preflight retry text from `PREFLIGHT-STOP.md`; then finish L0, freeze the catalog and implement/test through L6. This audit does not change product protections, restore plaintext, re-grade an independent report or claim that L6 was reached.

