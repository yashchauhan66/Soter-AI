# F26a native owner-hook scenarios, read-only review 01

Status: PREPARED_READONLY_NOT_EXECUTED. This note refines the existing work-card-01/design-02-owner-route contract. It is not a replacement plan or a native result. Only this new note was authored; no product, fixture, launcher, queue or ledger was changed, and no test/build/Git/child/native launch was performed.

Use one fresh marked synthetic profile and ordinary synthetic repository, with reviewed default/custom installation rounds, then an owner-absent interval and restart. Bind the exact new VSIX, extracted manifest/assets and all **four** packaged runtimes. Retained F25 helpers supply patterns, not current acceptance or executable bindings.

## Separate setup, owner and scanner Git authority

`packages/vscode-extension/src/__tests__/host/liteHistoryScanner.host.ts` has useful real-child receipts, synthetic setup and `beforeActivate` delegation. Its `git()` at line 98 prepends `setupPrefix`, which includes `-c core.hooksPath=<empty-hooks>` at line 128. Reusing that helper for an owner commit would bypass the feature under test.

Create distinct fixture helpers for setup/readback and actual owner commits. The owner invocation must use the pinned Git executable, the isolated owner's captured discovery environment and locally configured synthetic identity. Permit only the required ordinary commit arguments; never call `safeGitArguments`, force hooksPath, supply `--no-verify`, inject `GIT_CONFIG_COUNT`/`GIT_CONFIG_PARAMETERS`, or inherit scanner global/system overrides. Stage beforehand; avoid `commit -a` and path-limited commit variants that select an incidental temporary index. A supported custom hooksPath is configured locally before owner discovery, and is never a per-command override.

Each attempt must have a real staged tree change and valid synthetic identity. Establish a successful public owner-commit control so an unrelated Git failure cannot masquerade as hook protection. Keep owner/discovery/scanner argv and environment witnesses separate: empty hooks are appropriate only for scanner children. The Git extension may remain disabled in the isolated editor; the fixture's pinned Git executes the owner commit.

## Minimal scenario matrix

| Round | Actual action | Required observation |
| --- | --- | --- |
| Default/review | Begin with absent `.git/hooks/pre-commit`. With strict machine flag false, installation refuses; with flag true, cancel review once, then approve installation. | Refusal/cancel leaves hook absence and durable install/key/backup/service effects unchanged. Approved installation has PREPARED/APPLIED/readback evidence and an encrypted absence record. No native helper directly substitutes a transaction method for the registered owner command. |
| Default/staged authority | Commit a new public staged change; then stage a synthetic secret and sanitize only its worktree copy; then stage public bytes while leaving a synthetic secret unstaged. | First and third commits exit zero and advance HEAD to the expected staged tree. Secret-staged attempt has a fresh actual owner scan/index witness, exits nonzero and leaves HEAD unchanged. Hook does not stage/rewrite the selected index or worktree. The unstaged control proves no worktree-body fallback. |
| Default/restore | Review Restore while the owned hook is unchanged, then commit another public staged change. | Exact original absence is restored; no recursive directory removal. The subsequent owner commit advances HEAD without invoking the removed owned prefix. Preserve encrypted recovery records. |
| Custom/coexistence | Configure one supported in-root custom path containing a space, for example `.synthetic hooks`. Seed a supported LF `#!/bin/sh` original using a shell builtin to append a harmless marker and exit zero. Review installation; exercise public and secret-staged commits; Restore. | Actual discovery selects that path, default hook stays untouched, original body/mode is preserved, public commit runs the original exactly once, blocked scan never reaches it. Restore returns exact original bytes/mode; a later public commit still runs that original and advances HEAD without an owned scan. No plaintext sibling backup. |
| Custom/exit 7 and owner edit | In a separate reviewed round, use an original that records a marker and literally exits 7. Separately test a synthetic owner edit after installation before Restore. | Public staged analysis ALLOWs, the original runs once, Git aborts and HEAD is unchanged. Record Git's **actual outer exit**, not an assumed 7; the original's literal exit 7 and preserved bytes are separate facts. Restore preserves that original behavior. For the owner-edit control, Restore refuses/records INCOMPLETE, preserves unknown edited bytes and retains recovery evidence; do not overwrite the edit to manufacture successful recovery. |
| Alternate index | Use ordinary selected files inside captured `.git`: default-public/alternate-secret, then default-secret/alternate-public. Invoke ordinary owner commit with the explicit alternate index. | First blocks with an actual hook/selected-index scan witness; second commits the alternate public tree. Default index bytes remain unchanged. Compare the service/client's selected digest and identity with the actual effective hook index. Explicit empty/invalid/missing selections never fall back; a Git failure before hook invocation alone does not prove hook refusal. |
| Flag withdrawal | Leave a reviewed hook installed, set the actual strict machine flag false, and try a public owner commit. Also attempt repository-level enablement while machine false. | Installed hook blocks/unavailable, HEAD and original marker remain unchanged, and no stale ALLOW is used. Workspace enablement cannot grant authority. Reviewed Restore remains available while disabled through its explicit restoration guard. |
| Owner withdrawal/restart | Close the owning editor naturally and observe actual close plus both EOFs, then attempt a public owner commit from the launcher with the same isolated owner discovery environment. Restart the same profile/root and retry with a new committable public change. | Owner-absent commit blocks without HEAD advance or original execution; stale endpoint is not protection. Restart publishes a freshly signed session descriptor for the retained reviewed installation/key; public commit succeeds with a fresh owner scan. Do not replace a missing/corrupt key as recovery. |

For flag/index/installation withdrawal during a held result, use an observable real pending point if the production surface supplies one without a test-only product bypass. Reentrant/held-completion unit controls remain separate evidence until an actual native pending/withdrawal receipt exists. No arbitrary sleep or fabricated native withdrawal claim substitutes for that receipt.

## Current source integration points

| Source | Native integration |
| --- | --- |
| `packages/vscode-extension/src/scanners/continuousGuards.ts`, `src/extension.ts`, extension manifest command contributions | Replace/gate the legacy install/copy route and register the reviewed owner install/status/restore surface. Exercise those actual commands and modal reviews. The current legacy shell generator is not a passing F26 route. |
| `src/history-hooks/CheckedOwnerHookContext.ts`, `OwnerHookDiscovery.ts`, `OwnerHookGitProcess.ts`, `OwnerHookProtocol.ts` | Fresh owner projection before/after mutation; real default/custom discovery. Scanner metadata configuration does not establish the owner's effective hook configuration. Global/system/include/command ambiguity refuses rather than writing an unused hook. |
| `src/history-hooks/CheckedHookFile.ts`, `PreCommitHookTransaction.ts`, `src/broker/EncryptedBackupSink.ts` | Genuine current snapshots, reviewed encrypted backup/readback, guarded CAS, exact owned restore and unknown-edit preservation. Invoke through the actual controller; test-only fake transaction dependencies are not native installation evidence. |
| `src/history-hooks/PreCommitOwnerService.ts`, `PreCommitScan.ts`, `CheckedHookIndex.ts`, `PreCommitGitProcess.ts`, `StagedContent.ts` | Live flag/root/install/index authority and finite canonical staged scan. Observe real delegated children without changing their arguments/results or exposing private content. |
| `src/history-hooks/PreCommitHookText.ts`, `PreCommitClient.ts`, `preCommitClientMain.ts` | Installed reviewed prefix, pinned worker/runtime and signed descriptor/decision checks. The fixed absolute `env.exe -i` clears startup preload environment before Code Node; it does not change the original hook's environment/arguments or secure an already-started shell. |
| `packages/soterai-lite/scripts/build.cjs`, `verify-build.cjs`, `package.cjs` and native/content inspectors | Deliberately add and inspect the fourth worker runtime. Existing three-runtime inventories/loops must not silently omit it. Hash-bind the literal installed worker/runtime paths to the exact new VSIX. |

In this table, abbreviated `src/` paths are under `packages/vscode-extension/`.

## Retained reusable helper paths

All following H25 paths are under `docs/soterai-lite/evidence/20261024-f25-logs-a41d9e62/`; preserve them unchanged.

| Retained path | Reusable pattern |
| --- | --- |
| `run-logs-native-01.ps1` | Unique D: profile/workspace, sealed VSIX/extraction checks, delegated actual activation, primary/restart phases, result copies and natural Code close/EOF observation. New F26 namespace, source freeze, counts and four-runtime bindings are required. |
| `run-owned-output-native-01.ps1` | Dedicated bounded environment namespace and single-phase owned result binding. |
| `build-native-hosts-02.cjs` | Current frozen-input TypeScript plus esbuild driver provenance and parser inlining. Author a new current F26 helper; no retained compiler/build acceptance transfers. |
| `host-current-binding-01.ps1`, `artifact-binding-01.ps1`, `run-native-gates-01.ps1` | Fail-closed host/artifact checks before/after and sequential actual receipts. Reinspect the installed editor and bind current F26 source/artifact facts. |
| `pre-native-snapshots-01.json`, `actual-native-execution-snapshots-01.json` | Separate pre-execution custody from actual executed bootstrap/driver/manifest byte copies. |
| `durable-native-exit-01.json` | Distinguish actual inner exit, stable streams and runner absence from an unobserved wrapper exit. Never invent wrapper exit zero. |

The shared receipt wrapper is `docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1`. Host fixture patterns are `liteHistoryScanner.host.ts` for child/EOF receipts and synthetic roots, `liteLogVaultRuntime.host.ts` for delegated real-child/environment witnesses, and `liteLogs.host.ts` for actual modal reviews/restart state, all under `packages/vscode-extension/src/__tests__/host/`.

Every observed direct setup/owner/discovery/scanner child needs actual close, exit, both EOFs and zero requested signals. A JavaScript spawn observer cannot directly observe Git's internally spawned shell/client; parent Git closure is not a fabricated nested client PID/EOF receipt. If direct client closure proof is required, add a separate actual invocation of the exact fourth runtime under its cleared startup environment, retaining its real close/EOF receipt; it supplements the owner commit and cannot replace it.

Retain exact before/after selected-index, HEAD/tree, original-marker, hook/mode and packaged-runtime facts, plus metadata-only signed session/nonce/index witnesses. Inspect no normal user configuration or history, and disclose no synthetic private payload in routine result metadata. Freeze declared native observations only after the fixture and reviewed matrix agree; this note assigns no PASS or reused F25 check count. Same-user bypass and the final-check-to-commit race remain the design's stated cooperative limits.
