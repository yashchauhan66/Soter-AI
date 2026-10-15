# F09 static source review 02

Reviewer `/root/evidence_adversarial_review`; same lineage, independence LOW. Closing UTC clock: 2026-10-15 12:41:24. This review inspected source and authored only the separately requested new no-child lifecycle test file. No tests, typecheck, build, app, VS Code host, network or model execution was performed. Production and existing test files were not edited by this reviewer.

## Earlier blockers: source corrections observed

**S09-04 policy freshness:** `VaultManager.withRuntimeValues` now captures `runtimePolicyBinding` for the three frozen policy sources and the effective `exportRootPolicy` result. Its retained synchronous guard compares both on each check, independently of owner-review session events. `runtimePolicyBinding` uses canonical bounded regular-file reads, file identity and SHA256; absent sources are explicitly represented. The guard also checks the exact private encrypted store and absence of a pending migration through `runtimeStoreUnchanged`, closing the reported late-key storage window at source level. These bindings remain internal; the inspected registered commands do not return their source text, ciphertext, key or selected values.

**S09-05 ownership recovery:** strict `recovered()` validation is atomic before the prior map is accepted. Invalid, ambiguous, oversized or unreadable state sets `#ownershipAvailable=false`; both admission and persistent writes refuse unavailable ownership. `#persist` revalidates stored record shape before writing. Prior valid records remain UNVERIFIED and are never adopted or signalled. Source corrections observed; matching behavioral evidence belongs to the root's retained regressions.

The root reported focused-after03 as 142 PASS. This reviewer did not run or independently recalculate that result. The earlier 24-failure review baseline remains separate retained evidence. These observations do not certify native task/debug behavior or final package identity.

## New concrete blocker at this snapshot

**S09-06 no-child debug cancellation does not finish.** In `VaultSurfaces.ts`, `terminate`/`disconnect` call `#requestStop` and send a successful response. If cancellation occurs before launch, or after accepted launch but before `configurationDone`, `#started` remains false and no `#run()` exists. Aborted state then prevents `#maybeRun`; only `#run.finally` emits exited/terminated. Thus a session with provably no child can remain open indefinitely.

Requested regression file `packages/vscode-extension/src/__tests__/vaultRuntimeSurfaces.review.test.ts` contains four expanded scenarios: before launch / after launch without configurationDone, each with terminate/disconnect. They require the successful response before exactly one exited and terminated event, no coordinator run/stop or process/output event, replay without duplicate completion, rejected late launch and no post-dispose emissions. The reviewer authored but did not execute these checks. The root must retain a baseline before the production correction. In-flight approval and actual child jobs must continue awaiting their existing outcome/real completion; the no-child correction must not create an early exit path for them.

## Registration and boundary inspection

`firewall/commands.ts` registers the runtime using the same actual VaultManager instance. Owner setup reads a project entry, selects migrated variable metadata through native UI, and saves a strict descriptor. Run/stop/status commands return IDs or descriptor/job metadata; selected values flow only through the private reviewed callback into the owned job. Tasks carry only type and descriptorId with CustomExecution. The inline adapter binds its descriptor at construction and rejects request-supplied env/program/args and source-debug/evaluation/memory requests. Both surfaces publish only finalized filtered output and do not substitute raw output or exception text on failure. Cancellation uses AbortSignal/cooperative stop. Deactivation requests stop and awaits metadata persistence; it does not claim process exit.

No additional high-confidence blocker was identified in this bounded registration/fix review. The final manifest, packaged bundle, actual executable READY/START behavior, native CustomExecution and inline-session events still require the root's matching checks. The authored host fixture declares 12 scoped observations with scripted native decisions and LOW independence; its source is not an executed host receipt, installed-VSIX proof or human approval.

## SHA256 snapshots

| Path | SHA256 |
| --- | --- |
| `packages/vscode-extension/src/vault-runtime/commands.ts` | `59e2f2cc9ec6094be4bd116df1d4889d4aef0da725fa65de023911c34b064ed6` |
| `packages/vscode-extension/src/vault-runtime/VaultSurfaces.ts` | `21533fba38a7eb5fbb16d3df30dc92525113cf811c13e9d5dcf6724a90cdfef7` |
| `packages/vscode-extension/src/vault-runtime/RuntimeBinding.ts` | `a73d6c376edf26acb4afe3e046b9dd259a5f5ea3b14c437781cede54f4f4062a` |
| `packages/vscode-extension/src/vault-runtime/VaultRuntime.ts` | `7a19b97cec9be86c1f7b0b91e23e0a67a47199ede123f60e06d175271f25ea08` |
| `packages/vscode-extension/src/firewall/VaultManager.ts` | `196f074643a2275d87479bc30e2f76441303265214c645b25833095a0f48bcae` |
| `packages/vscode-extension/src/firewall/commands.ts` | `6dafaec321a4649c0882b0b7dd92896225d054eba48aab101b57b13b1bcfea07` |
| `packages/vscode-extension/src/extension.ts` | `a23373a31e0b2a3991a0e803b108ca5216cbc3ec5e6d4b6e6374714a4ac77179` |
| `packages/vscode-extension/src/__tests__/vaultRuntimeSurfaces.review.test.ts` | `2522d47d63c0c3bff0023ee72aabec1e96b10bbffeb76f39e56237adeb9f265b` |
| `packages/vscode-extension/src/__tests__/host/liteVaultRuntime.host.ts` | `2242c74770c0dc203945a14ac1f1d21d726c334dd13ed57daa21567dd7ded48f` |

Read-only commands were narrow `Get-Content`, `rg`, `Get-FileHash` and UTC clock queries. One literal `firewall/*.ts` search argument was rejected by Windows path parsing and supplied no evidence. The no-child source remains unresolved at the snapshots above; later fixes require separate source/behavioral evidence. No tool-support promotion, final score or independent review is claimed.
