# F06 narrowed source review 03

Read-only production review, same-lineage independence **LOW**. No tests or native host executed; no production files changed. Only this immutable review file was added.

Reviewed source SHA-256:

- VaultManager.ts: `07bd28a2f91efa4313f16e6bd9f7fb132abf44e2cc91abd2f8cb9f2518e1499a`
- VaultStorage.ts: `ca7a8e581ae03c32cc8564fbe7182409c0aaab7ee44c92f26da3a1b3b0f872d1`
- VaultMigrationPlan.ts: `dbe3b45646d3751c927680ca31001897faa3885aca23c9ef84695f114ed94505`

## Addressed findings observed in this source

Initial absent storage/target checks alone map ENOENT to absence; later read failures remain unavailable. Storage ancestors and project exclusion are checked before mkdir. Public status omits both raw-value hash and hash-derived id. Standalone safe example writes use the global lock, pending barrier, key verification and fresh source checks. Original representations remain private for exact restoration; example text contains unique empty assignments only.

Damaged-source restoration is separate from strict safe completion. It authenticates the issued checkpoint/source/root, binds exact bounded bytes privately using one-to-one latin1, obtains a native plaintext-disclosure decision, rechecks reviewed source state and recognized vault images, and retains encrypted recovery on failure. Ordinary capture remains strict UTF-8. Post-source-write canonical/root/policy/result validation is present. These source observations are not execution PASS results.

## One remaining key-availability guard

At this identity, restoreFromBackup authenticates the checkpoint before its native disclosure. After the disclosure, the completed-pointer branch verifies only pending/pointer state before writeSource; its verified key is not freshly bound to the workspace mutation. Removing or replacing the SecretStorage key while that modal is pending can therefore still permit writing the captured original. The pending branch verifies key availability only after the write.

The same ordering issue exists in complete: it verifies the exact key, then awaits encrypted vault commit and fresh source reads, then mutates source/example; its next exact key check is after those workspace writes. A storage-fault fixture that removes or changes the key after vault commit can remove original plaintext before discovering unavailable recovery custody.

Required narrow correction: carry the exact verified key privately and revalidate it at the actual workspace-write decision after awaited storage work, or reauthenticate the immutable checkpoint with the current verified key before restoration. Do not regenerate keys or perform automatic plaintext rollback. Tests should hold disclosure or encrypted-vault write, remove/change the synthetic SecretStorage entry, and require no subsequent source mutation. This does not claim protection from arbitrary same-user software or an OS race veto.

No additional blocker was identified in the reviewed scope. F03/F05 behavior was not modified by this reviewer. Matching fault tests, complete suite, native restart/API probes and final artifact/source identity acceptance remain required.
