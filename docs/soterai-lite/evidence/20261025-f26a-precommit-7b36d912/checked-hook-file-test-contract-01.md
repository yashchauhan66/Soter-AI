# F26a checked hook file test contract

Existing F26a card/plan only. `src/__tests__/checkedHookFile.test.ts` contains exactly14 grouped Windows cases. The author has not executed tests, compiler/build, Git, hooks, production code or native editor work. No normal user configuration/history, operating-system settings or ACLs are changed. Root must run and retain the missing-module baseline before implementing production.

## API and authority

Synchronous `prepareCheckedHookFile(root:string,hooksRelative:string,enabled:()=>boolean): CheckedHookFile|undefined` returns a frozen genuine capability `{root,file,read,write}`. `isCheckedHookFile` checks private capability identity before touching caller properties. `read()` returns a frozen private snapshot `{bytes:Buffer|undefined,mode:number|undefined,identity:64hex}` or unavailable. Buffers are independent private copies, not frozen typed arrays. Mode is the actual observed `stat.mode & 0o777`; absence has undefined bytes/mode.

`write(expected,bytes,mode):boolean` is synchronous compare-and-swap for this exact selected leaf. Snapshots belong to one capability and one admitted observation; clones/proxies/another capability's snapshot grant no write and must cause zero filesystem I/O. A successful CAS consumes the old snapshot, including an equal-byte/mode replacement. Mutating a returned expected byte buffer does not manufacture authority.

Only admitted actual Buffer payloads up to98304bytes and integer modes0..0777 are present next states. Explicit absent next state requires both bytes and mode undefined, and only removes the selected leaf under a genuine matching snapshot. Missing ordinary hook parents may be created only during write; reads and preparation do not create them. No recursive cleanup or directory deletion is allowed. Undo does not require borrowed Git metadata: synthetic index contents are deliberately inert non-DIRC bytes so the utility cannot accidentally depend on scanner metadata admission.

## Fourteen grouped cases

1. Default, nested custom and `.git/custom-hooks` absence reads are frozen and create no missing parent.
2. Existing binary reads are bounded private copies with exact actual mode and stable unchanged identity.
3. Capability WeakSet identity refuses structural clones/accessors/proxies without traps.
4. Useful create/replace/explicit exact undo changes only the selected leaf, retains created parent directories and preserves metadata/worktree sentinels.
5. Existing private original bytes and observed mode survive reviewed replace and restore.
6. Foreign/same-path-other-capability/cloned/proxied snapshots refuse with zero I/O; caller-mutated expected bytes cannot write.
7. Byte drift, actual Windows read-only mode drift and equal-byte atomic replacement make earlier snapshots stale; unknown owner edits remain intact.
8. Equal-byte CAS and later restored original bytes do not revive an old snapshot.
9. Disabled/throwing guard withdraws access and remains sticky on recovery/reenable.
10. Captured root replacement or `.git` junction replacement withdraws the old capability.
11. Parent junctions, an aliased root and hardlinked leaf refuse without modifying their synthetic targets.
12. Exactly98304binary bytes are useful; oversized/nonBuffer/proxy buffers, invalid mode combinations and oversized existing files refuse.
13. Invalid root/relative selector/absolute/traversal/ADS/device/control/short-name/expansion/coercion inputs refuse without creating a fallback hook.
14. Successful writes leave no sibling original backup or staging file; a selected-hook edit injected at the owned exclusive stage causes refusal, preserves that unknown edit and removes only the matching generated stage. A post-rename guard withdrawal returns false without a fabricated no-mutation claim.

Root confirmed that an unsafe existing leaf/ancestor may cause either preparation refusal or a capability whose read refuses; tests accept both safe timing choices. Tests compare actual Windows mode bits and a real writable-to-read-only transition, rather than demanding POSIX permission/ACL semantics. The read-only fixture mode is restored in `finally`; no real file mode is altered. File-symlink privilege is not requested: actual Windows junctions cover ancestor reparse rejection, and hardlinks cover linked leaf refusal.

## Staging and failure observations

The unit race observer wraps only builtin synchronous filesystem calls in memory and restores them in `finally`. When the implementation exclusively creates its generated stage in the selected directory, the observer writes a synthetic unknown edit to the selected fixture hook. It observes string `wx` or equivalent O_CREAT/O_EXCL open flags, or a same-directory writeFileSync wx creation. The test requires that this transition actually occurred, so a negative result before staging cannot false-pass the race.

Only a known generated staging file may be unlinked by failure cleanup. No unrelated marker, original source, outside target or fixture directory may be deleted. On a successful CAS the selected directory contains only its expected hook and preexisting marker; there is no plaintext sibling backup of the original. Original hook content exists only in private snapshot bytes and the intentionally selected original/restore path, not a utility-created backup file.

The separate late-withdraw observer disables the caller guard immediately after the target rename. It requires a false result and withdrawn read authority, while accepting that the target may already hold generated bytes. This is a cooperative last-check limit; the caller's policy/recovery layer must handle owned rollback or INCOMPLETE. The utility does not receive a restoration flag bypass. A restoration caller must provide its separately authorized root guard.

All future runtime filesystem mutations stay inside explicitly named retained synthetic fixture containers. Both endpoints of test renames are checked against that container. Only `write(undefined,undefined)` explicitly undoes a matching selected leaf; fixtures are otherwise retained. No Git process, fake Git invocation, normal profile or credential is involved.

## Custody

`checked-hook-file-preproduction-01/` retains exact selector/pin source context and the authored test. `checked-hook-file-author-freeze-01.json` records those bytes,14 declared cases, absence of CheckedHookFile production, and this contract. Authoring/case-count/hash checks are not behavior or static compiler PASS evidence. Root owns baseline/current execution and production changes.
