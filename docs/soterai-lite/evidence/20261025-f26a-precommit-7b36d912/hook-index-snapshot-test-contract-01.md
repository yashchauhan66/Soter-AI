# F26a additive hook index snapshot test contract

This is test authoring under the existing F26a work card and implementation plan, not a replacement plan. Root alone implements production and runs baseline/current gates. No test, compiler/build, Git, hook, editor, child or network execution by this author.

The new `packages/vscode-extension/src/__tests__/hookIndexSnapshot.test.ts` contains 20 Windows cases. It dynamically checks the missing additive export so the pre-implementation baseline can report test assertion failures without importing a nonexistent named export.

Required synchronous API in `history-hooks/CheckedHookIndex.ts`:

```ts
captureHookIndex(root: string, indexPath: unknown): Readonly<{
    indexFile: string;
    indexSha256: string;
    indexIdentity: string;
    entries: readonly StagedEntry[];
}> | undefined
```

The snapshot and entries are frozen. The SHA256 hashes the complete exact admitted index bytes. Identity is a lowercase 64-hex digest, stable across unchanged observations and sensitive to file/ancestor identity as well as bytes. A snapshot grants no genuine metadata capability. Explicit invalid/missing selectors never fall back. Existing strict selector, canonical-path, link, DIRC/checksum, mode, stage and entry-count checks apply without requiring Git metadata preparation or reading worktree bodies.

Genuine `prepareCheckedHookIndex` descriptors additionally expose readonly `indexSha256` and `indexIdentity` matching a capture of the same snapshot. Old descriptor observations remain immutable after drift, and `available()` remains withdrawn after bytes are restored or an equal-byte replacement occurs.

Cases cover exact SHA/frozen shape/non-capability; stable reads; v2/v3 empty indexes; explicit absolute/relative alternative selection; byte drift; equal-byte atomic file replacement; `.git` replacement preserving the same index inode; `.git` and root junction aliases; hardlinks; missing selectors; hostile selectors without coercion; outside/noncanonical/ADS/short aliases; invalid checksum/unsupported DIRC/stages/modes/extensions; path collisions and 129-entry refusal; no metadata factory or child launch; no worktree-body reads; genuine descriptor parity; sticky byte drift; and sticky identity drift.

Fixtures construct bounded synthetic SHA1 DIRC bytes manually and retain unique temporary roots. No Git binary or real repository is used. Atomic replacement retains an exact separate copy of the old synthetic bytes. All moves validate both absolute paths remain inside the explicitly named fixture root. Windows junctions exercise actual directory symlink rejection without requiring file-symlink privileges. Original external/symlink target bytes stay intact. No normal profile or user secret is accessed.

Read counters wrap synchronous `readFileSync`/`openSync` for named synthetic paths, with restoration in `finally`; they are specific observations rather than a universal filesystem no-read claim. The metadata/spawn guards similarly restore in-memory functions in `finally`. They do not change production files.

Exact production and existing-test beforebytes are retained in `hook-index-snapshot-preproduction-01/`. `hook-index-snapshot-author-freeze-01.json` binds the test, contract, those snapshots and syntax-only receipt. These are prepared evidence, not a missing-API baseline result or any behavior PASS. Root must run the baseline before production, retain its raw failure, then implement the additive API/readonly descriptor fields and run current verification.
