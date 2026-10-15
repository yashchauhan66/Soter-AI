# F09 static source review 01

Reviewer: `/root/evidence_adversarial_review`, same agent lineage; independence LOW. Review performed on 2026-10-15, with closing metadata read at 12:12:44 UTC and a subsequent matching source-hash read. This is source inspection only. No tests, compiler, child process, VS Code host, installed extension, network, or model execution was performed by this reviewer. No production or test file was changed. The previous service failure remains retained separately; this note does not retroactively complete that failed attempt.

Scope: the frozen F09 descriptors, staged READY/START child, private VaultManager lease, canonical runtime binding and ownership coordinator. Read design01 through design05; design04 explicitly limits cancellation during module import and exposes recovery records as UNVERIFIED. F10 and later are outside this review.

## Source-corrected findings observed during this review

- **S09-01: rejected descriptor ID disclosure.** The earlier constructor copied an arbitrary string ID before strict parsing. A blocked job could expose that rejected input through snapshot/completion. Current `VaultAppJob.ts` initializes `#id` to the constant `unavailable` and assigns the parsed UUID only after descriptor validation. Source correction observed; behavioral regression evidence must come from the root's retained run.
- **S09-02: missing-pipe setup lost close ownership.** The earlier implementation installed the child close handler after checking both pipes. A missing pipe could throw first and leave a real child permanently unconfirmed even after its actual exit. Current source registers close ownership first, marks an absent channel drained and failed, and requests cooperative stop. Source correction observed; real child close plus the available channel's drain remains required for completion.
- **S09-03: normal app output invalidated directory binding.** The earlier binding used file identities containing size/mtime for cwd/root directories. A normal file creation could revoke the app's own lease. Current source uses dev/ino/birthtime for directories while retaining full before/after file identities and digest validation for source/program. Source correction observed; the root owns the synthetic output-file regression and matching verification.

The bootstrap waiting timer and own-data construction for a selected `__proto__` environment name were already corrected before the root's initial focused run. This review does not invent an earlier failing baseline for those corrections.

## Remaining source blockers at the hashes below

### S09-04: policy-file invalidation can miss leases without owner-review grants

`VaultManager.ts` captures effective policy during async preparation, but the retained guard at lines 238-244 checks configuration/root/epochs plus `runtimeBinding`; the binding contains source/program/directory identity, not policy-file identity. Its runtime epoch subscribes to boundary and owner-session events. `PolicyDrift.ts:75` handles policy-file watcher events by calling global `revokeOwnerPolicySessions()`. `BoundarySnapshot.ts:30` emits that global notification only for roots already in `sessionGrants`.

Consequently, an ordinary vault run with no owner-review grants can retain a true guard after an existing policy file is edited. If the policy is already enrolled additively, a subsequent load may require no boundary write either. Editing an existing file does not require a directory mtime change. A child waiting for READY can receive START values after this owner-policy drift, and a running guard need not revoke it. This is approval freshness, not a claim that injected app values can be recalled.

Required regression: prepare a synthetic lease with no owner-review grants, alter an existing `.aiignore`/`.soterai/policy.json`/team policy and deliver the native watcher event, then require the retained guard to be false before READY/START. Include a previously enrolled policy change that causes no new additive storage write. A separate positive control creates an unrelated app output file without revoking an otherwise valid lease. An explicit runtime policy invalidation event or fresh bounded public policy binding can close the gap; relying only on events for session grants cannot.

### S09-05: corrupt recovery ownership is silently replaced by new admissions

`VaultRuntime.ts:31-37` treats a nonarray, over-64 array, rejected entry or storage read exception as empty/partial recovery history. `run()` can then reserve/persist new records, overwriting the unreadable or dropped outstanding ownership metadata. This conflicts with design04's refusal when outstanding records cannot be safely retained. A failed metadata read is not evidence that no previous owned child may remain.

Required regression: stored nonarray, 65 valid outstanding records, an invalid/ambiguous record and a storage get exception must prevent new launch and preserve the original ownership storage; no approval, secret lease or spawn should occur. Valid records remain UNVERIFIED, are never adopted/signalled, and must remain visible. Include valid empty/63-record positive admission and the valid 64-record capacity rejection. A recovery-unavailable state can refuse new work without trying to repair, signal or erase unknown processes.

## Limits and acceptance still required

The READY handshake limits release to the already owned child; it does not authenticate hostile same-user software. Selected app/dependency code can inspect, write, print or upload its injected values. Cancel before START prevents import; once module evaluation begins, its side effects cannot be undone. Neither STOP acknowledgement nor a timeout proves process exit. The current source correctly retains output until child close and channel drain and withholds on cancellation/failure; native acceptance is still required for the actual executable and final packaged runtime.

No F09 test count, source-level test result, packaged VSIX identity, actual task/debug session acceptance, tool support promotion, independent human review or final rating is certified here. The root's focused-after01 76 PASS is retained prior evidence for its then-current source, not a fresh run by this reviewer or proof for later changes. S09-04 and S09-05 remain open at this snapshot until matching fixes and retained regressions establish otherwise.

## Reviewed SHA256 snapshots

| Path | SHA256 |
| --- | --- |
| `packages/core/src/VaultAppDescriptor.ts` | `ffc21361b5cefb6586ed672d41157fe68c9fbcf8c894494d2e195067c15a5134` |
| `packages/vscode-extension/src/vault-runtime/VaultAppJob.ts` | `db6555fc8fd58098a50b7d5ce4914d3b178101b6cb04e3c762571a9b3508be2c` |
| `packages/vscode-extension/src/vault-runtime/RuntimeBinding.ts` | `cbf5b808390d61abd45a5322f9bb388067e206a6c713dae3fc80b1a8802ef153` |
| `packages/vscode-extension/src/vault-runtime/VaultRuntime.ts` | `3ad3e52d3efb6cbfbaab6d26711f1dea4837e2424e4b6fdd80201ae3d817446e` |
| `packages/vscode-extension/src/firewall/VaultManager.ts` | `57e940b14f218e0c241691cffa9b988b8f2ffefdccb32b9d65c516c2e443e5b4` |
| `packages/vscode-extension/src/firewall/VaultStorage.ts` | `ca7a8e581ae03c32cc8564fbe7182409c0aaab7ee44c92f26da3a1b3b0f872d1` |
| `packages/vscode-extension/src/ai-boundary/BoundarySnapshot.ts` | `cbb643e2cc1c67ba3c1ab42d39c7105bb9adec5e6f12ab310e8c6b7916045276` |
| `packages/vscode-extension/src/ai-boundary/PolicyDrift.ts` | `6cd2b30cd08ba32be8dbf287c7f01cd7ce0be874e459c346b17e60b7f5e1aeb8` |
| `design-04.md` (this evidence directory) | `2e1b06ea6cb2d47870abd8d0f5420fabfff09c4fdbdf63db0cd35bce545e994c` |
| `design-05.md` (this evidence directory) | `22bd27077dfcd2748438b1b67c4fcdea77c1dfe5e7968ac35a78a5475706f2fc` |

Commands used were narrow `rg`, `rg --files`, `Get-Content` of the source/design files above, `Get-ChildItem` of this evidence directory, `Get-FileHash -Algorithm SHA256`, and the UTC clock. Read-only path guesses for `src/vault/VaultManager.ts`, `ai-boundary/DriftMonitor.ts` and `lite-vault-runtime-lease.test.ts` did not exist; one double-quoted ripgrep command failed PowerShell parsing. Those failed reads executed no tests and supplied no behavioral evidence. The only write by this review is this new evidence note.
