# F26a reviewed hook restoration test contract 01

Status: TEST_ONLY_AUTHORED_UNEXECUTED_PREPRODUCTION. Existing F26a/design02 scope; no replacement plan. Root requested exactly 12 grouped private in-memory cases before the missing-module baseline. The author has not run tests, TypeScript, product/fixture code, build, Git, children, provider calls or native commands, and has not edited production, other fixtures, queue or ledger.

Target: new `packages/vscode-extension/src/history-hooks/PreCommitHookRestore.ts`, exporting `PreCommitHookRestore`. Constructor accepts `HookRecoveryReceipt` from the existing transaction module. `run(deps)` is one-shot and returns only a frozen `{status: 'RESTORED'|'CANCELLED'|'UNAVAILABLE'|'INCOMPLETE'}`.

Dependencies are `current`, asynchronous `confirm`, synchronous `read`, `backups.retrieve` only, synchronous/asynchronous `withdraw`, asynchronous `save(receipt,'ROLLED_BACK'|'INCOMPLETE')`, and synchronous guarded `write(expected,bytes,mode)`. Restore receives no backup store, key-creation, filesystem, service factory, child or provider authority. A false pre-commit feature flag is compatible with explicit current restoration authority; the fixture never supplies an installer flag or bypasses a filesystem guard.

Constructor admission must reject malformed/accessor/proxy/inherited/extra/missing fields without any dependency call. Exact fields are version1, lowercase v4 generation UUID, canonical ordinary Windows root and safe relative hooks path, lowercase32-hex backup handle, lowercase64-hex before/after digests, boolean original presence, present-only integer originalMode0..0777 and integer installed mode0..0777. Shared OwnerHookProtocol validation supplies root/relative rules.

Before review, the current snapshot must match receipt.afterDigest through shared `hookSnapshotDigest` and exact installed mode. Capture its identity before modal/awaited work; a different identity after that capture is drift even if bytes are restored. Receipt alone has no persisted inode identity: a currently exact owned installed file may supply the initial fresh identity. Unknown/edited state produces INCOMPLETE with best-effort durable evidence and no overwrite/modal/backup retrieval.

Review preview is frozen metadata only: `{operation:'restore',hookRelative:<hooksRelative+'/pre-commit'>,originalPresent}`. Review precedes retrieval, withdrawal and write. Cancellation is inert. Canonical retrieved source is exactly `JSON.stringify({version:1,present,mode,bytes})` in that declaration order; mode is null for absence, otherwise integer mode; bytes is null for absence, otherwise strict canonical base64. Reject whitespace/reordering/duplicates/extra keys/coercion/invalid encodings. Presence, mode and shared beforeDigest must match the receipt; the decoded original must pass `supportedPreCommitOriginal`, including its 64KiB/LF/interpreter/content limits. Missing/corrupt key is represented only by retrieve null; there is no replacement-key API.

Root confirmed the precise status oracles: malformed receipt is inert UNAVAILABLE; disabled/withdrawn authority before withdrawal is UNAVAILABLE; owner snapshot/identity drift is INCOMPLETE. Any uncertainty after withdrawal begins is INCOMPLETE. Current/confirm exceptions before withdrawal are sanitized as UNAVAILABLE in this fixture; retrieval/backup failures are INCOMPLETE. No exception text leaves the fixed result.

After successful review/current/read/backup validation, withdraw exactly once and await it if needed. Re-read the same expected identity/installed bytes and recheck authority before a single synchronous write. False/throw may already have mutated the file; record uncertainty and do not retry/roll back over unknown owner state. Success requires exact original bytes/mode/absence readback, durable save ROLLED_BACK, then final synchronous read/current/return RESTORED with no await. Save failure, post-save drift or final withdrawal remains INCOMPLETE. Its best-effort save may itself fail without escaping private error text.

## Frozen 12 grouped cases

1. Useful custom original restoration and default original absence, exact modes, only retrieve authority and explicit flag-off restoration authority.
2. Exact malformed receipt admission: required/extra fields, schema/version/UUID/digests/handle/modes, canonical root/relative paths, getter/proxy/inherited records; no dependency effects.
3. Pre-modal digest/mode/presence/read failure controls, no overwrite/review, and useful initial fresh-identity control.
4. Frozen metadata-only preview, strict confirmation, cancellation and disabled/nonboolean restoration authority.
5. Missing/corrupt/noncanonical/base64/presence/mode/digest mismatches and unsupported original backups; no withdrawal/write/key replacement.
6. Review/retrieve/withdraw/write/save ordering, genuinely pending asynchronous withdrawal and fresh post-withdraw expected snapshot.
7. Authority and byte/mode/identity drift after both confirmation and retrieval; no write or withdrawal.
8. Withdrawal exception and post-withdraw authority/byte/mode/identity/unknown-read drift; exactly one withdrawal, no write/retry.
9. Synchronous write false/throw before or after mutation, uncertain readback, owner edit and CAS race; preserve edits and attempt only once.
10. Durable rollback-save failures and changes during its await, plus failed best-effort INCOMPLETE save; no successful promotion/retry.
11. Paired final-read immediate withdrawal versus queued microtask withdrawal, proving the intended synchronous completion boundary without timing sleeps.
12. One-shot/concurrent review/cancelled reuse, zero dependency access on duplicate run, and sanitized early dependency exceptions.

The fixture uses only known synthetic hook text/public pin bytes and in-memory callbacks. It imports shared digest/builder helpers rather than copying their algorithms. The new restore module is imported dynamically inside each case so the root can retain an actual 12-case missing-module baseline. Static count/hash/snapshot custody is not test, compiler, runtime, encrypted-provider or native success. Root must execute the baseline before implementation, then current verification with unchanged frozen assertions.
