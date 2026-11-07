# F26a pre-commit contract and test protocol

**PREPARED / STATIC-ONLY / NOT-EXECUTED; independence LOW.** This supplements existing F26a in `IMPLEMENTATION-PLAN.md:94` and `FEATURE-QUEUE.json:841`. F25 remains the only active production card until both byte barriers. This document authoring changed no production/test file, queue, ledger, Git configuration, hook or profile. No Git, test, build, scanner, hook installation or network operation ran. The earlier memo `20261024-f26a-prepared-readonly-01/findings-01.md` remains applicable. Proposed names, limits and cases below are suggestions for the existing card, not a replacement plan or acceptance evidence.

## Requirement and implementation boundaries

Original MASTER U7 at lines79–82 requests optional pre-commit/pre-push installation and PSReadLine exclusion. U8 at83–85 supplies additive denies, owner relaxation and drift constraints. F26a must finish before F26b and F26c. Frozen LS-27 specifically includes an existing hook, public commit, blocked declared staged fixture, cancellation, reviewed restoration and immediate loss of coverage on removal. F26a alone cannot complete LS-27 because pre-push remains separate. The existing no-push instruction persists, including local pushes; no push is proposed here.

Source observations checked during this preparation:

- `scanners/continuousGuards.ts:78` builds a separate regex/grep scanner over a diff and turns Git errors into apparent clean output. Its installer at233 replaces an existing hook with a plaintext sibling backup. Marker substring ownership, first local config lookup and the old shallow tests do not meet F26a. Preserve these before bytes and establish failing regressions before replacing this route. The copy-script command must not remain an unflagged route around the new contract.
- `security/SafeGit.ts:33` always forces `core.hooksPath=<job>/empty-hooks`. `history/HistoryGitProcess.ts:100` uses that prefix. Both are suitable patterns for private read-only scanner children; **neither is the positive owner commit path**. `createSafeGit.run` uses timeout termination and deletes its job on disposal; those lifecycle operations are unsuitable unchanged under the current retained/no-signals constraints.
- `terminal/CheckedGitMetadata.ts:125` supplies a WeakSet capability, pinned Windows Git2.53.0.windows.1, ordinary metadata/index checks and sticky recapture. It rejects worktrees, includes and unsupported formats. It binds the default `.git/index`; it cannot silently represent Git's temporary effective index during a path-limited commit or `commit -a`. Its index validator currently checks framing/checksum but is not a full staged-entry mode/stage/path parser. Preserve its existing read-only contract; add a separate hook/effective-index capability.
- `history/GitHistoryProtocol.ts:75` validates exact `cat-file --batch` framing, expected OID/size and SHA1 object identity. `HygieneAnalysis.ts`, `HygieneCandidatePolicy.ts`, family parsers and `RegisteredSecretMatcher` are canonical detection authorities. `ai-boundary/gitDiff.ts` and a partial history scan are not commit-admission decisions.
- `broker/EncryptedBackupSink.ts` stores AES-GCM recovery outside the workspace with a SecretStorage key. Its retrieval can create a missing key. A hook transaction must still fail missing/corrupt-key restoration, verify encrypted write/readback, persist PREPARED before mutation, and guard exact owned generations. `ClaudeAdapterPolicy.ts` provides useful single-use review/backup/recovery semantics; its vendor-specific paths and state merging are not reusable hook authority.
- `VaultManager.createGatewayRegistry` at370 requires current owning editor/SecretStorage/policy context. A standalone hook has no such authority automatically. Do not persist vault values to hook files/environment/argv or imply registered-value coverage from an empty matcher.

## Smallest defensible implementation contract

Prefer a standalone, finite, canonical heuristic/provider scanner for F26a, explicitly **without registered-value coverage**. Use `RegisteredSecretMatcher([])` for its canonical provider/entropy/encoding decisions, plus the canonical private hygiene/source/config-family analyzer appropriate to each supported content unit. This avoids a new value registry, editor availability dependency and value transport. Low-entropy opaque registered-value detection is outside this proposed scope; label it plainly. If the actual work card instead claims registered-value matching, implement a live private registry lease and its native pre-registration differential before making that claim.

The standalone route still needs **live owner flag authority**. Proposed machine/restricted/default-false flag: `soterai.lite.historyHooks.preCommit`. Repository configuration cannot enable it. An installer-time true bit or mutable receipt alone is insufficient. Select and test one concrete authority before production: a reviewed exact isolated owner-profile setting source with strict bounded JSONC/effective-value semantics, or a live owning-editor service. Missing/ambiguous/stale authority blocks. Do not replace this native requirement with a mocked `enabled()` test. Default false, config withdrawal, uninstall and restart must have explicit behavior. A disabled installed wrapper may block until reviewed restoration; it must not claim active scanning or silently restore weaker protection.

Suggested internal interfaces, never value-bearing public command results:

```ts
interface CheckedHookOwner {
  readonly root: string;
  readonly executable: string; // fixed pinned Git
  readonly hooksDirectory: string; // effective reviewed owner path
  readonly generation: string;
  available(): boolean; // sticky owner/root/policy/config/runtime/file recapture
}
interface CheckedEffectiveIndex {
  readonly identity: string; // private digest + file identity
  readonly entries: readonly StagedEntry[]; // private path/mode/OID/stage
  available(): boolean;
}
type HookDecision = Readonly<{
  status: "ALLOW" | "BLOCK" | "UNAVAILABLE" | "STOP_UNCONFIRMED";
  reason: "clean" | "candidate" | "authority" | "unsupported" | "limit";
  inspected: number; // bounded count; no path/value/snippet/OID dump
}>;
interface PreparedHookPlan {
  preview(): HookPreview; // operation + semantic changes, no old script bytes
  apply(deps: HookTransactionDeps, signal?: AbortSignal): Promise<HookResult>;
}
// Private scanner/controller functions; exact schemas, no arbitrary args.
prepareHookOwner(root, ownerAuthority, enabled): Promise<CheckedHookOwner | undefined>;
captureEffectiveIndex(owner, inheritedIndexPath): Promise<CheckedEffectiveIndex | undefined>;
inspectStagedTree(owner, index, analyze, now): Promise<HookDecision>;
canReleaseHookDecision(owner, index, decision): boolean;
restoreHook(receipt, deps, signal?): Promise<HookResult>;
```

Require opaque capability identity, exact key/prototype/accessor validation and single-use plans. `HookResult` can follow APPLIED/RESTORED/CANCELLED/CHANGED/UNAVAILABLE/ROLLED_BACK/INCOMPLETE. Separate durable receipt states PREPARED, APPLIED, WITHDRAWN and RECOVERY_REQUIRED. PREPARED alone never means installed. Public command handlers ignore caller-supplied root/path/script/content/approval arguments and obtain the single trusted local root themselves.

### Coexistence without a plaintext second copy

For a bounded supported existing LF/UTF8 `#!/bin/sh` hook, preserve its first shebang and exact remaining bytes **at the same existing path**. Insert the reviewed fixed scanner prefix immediately after the shebang. Successful scanner execution falls through into the original body exactly once; original nonzero exit continues to block. Encrypt the exact original byte snapshot before mutation. This retains the original readable code only where it already existed and creates no plaintext `.soterai-backup` sibling. The extra prefix can affect line-number-sensitive scripts; disclose that limit and refuse unsupported interpreters, shebang flags, encodings, linked files and unrecognized managed ownership. Do not shell-parse/rewrite arbitrary original commands or claim arbitrary framework compatibility. Owner review authorizes running the owner's existing hook; no new project command is introduced by the scanner.

Custom `core.hooksPath` can be supported only when the **actual effective owner path** is uniquely resolved, local, ordinary, reviewed and within an authorized root. Support the bounded local forms actually tested; clearly refuse includes/global ambiguity/outside directories instead of resetting persistent config or writing a dead `.git/hooks/pre-commit`. A separate native public control must prove the custom path really runs. If all existing hooks are simply refused, coexistence refusal is useful but does not satisfy the existing-hook execution scenario in LS-27.

Guarded transaction order: obtain owner approval over a value-free semantic diff; recheck identities; store and readback encrypted original/absence snapshot and applicable mode; persist PREPARED; recheck no new destination; write new generation; exact readback; persist APPLIED. Rollback/undo only if current bytes equal that exact owned generation. Changed owner content is preserved and recovery remains INCOMPLETE. Restore original absence as well as original content/mode. Keep recovery evidence after successful restoration. Receipt/hash details remain private; UI does not expose original hook content or unkeyed content fingerprints.

### Effective staged tree and finite child protocol

Suggested simple scope: inspect the full proposed staged tree, not worktree files and not a pretty diff. Initial commit works without a HEAD lookup. Deletion naturally contributes no staged blob. Bound the route to128 entries plus a129th sentinel,64KiB each blob,1MiB admitted raw bytes,256KiB index listing,8KiB stderr and60s total monotonic time; cap parser/matcher work using existing canonical limits. Charge raw admission before decoding failures; cap contexts as well as deduplicated OIDs. A larger/binary/unsupported tree is UNAVAILABLE, never clean or partial ALLOW. This conservative scope may block a commit because of unchanged staged-tree content; state that cost. If a changed-only scope is chosen instead, it needs a separately tested exact cached raw-diff grammar and unborn-tree comparison; do not silently substitute one scope for the other.

Read `GIT_INDEX_FILE` **as path data supplied by the actual Git hook invocation**. Resolve its documented/tested relative form against the hook's verified root; require an ordinary bounded index in the reviewed `.git` directory with no parent/link/ADS escapes. Support an alternate/temporary index only when that exact file is validated and bound throughout the scanner; otherwise refuse. Never fall back to `.git/index`. Native `commit -a` and path-limited controls determine the supported cases; unknown names/layouts remain unsupported. Do not assume a particular temporary-index filename from memory.

Proposed finite Git operations are version, `ls-files --stage -z` against the captured effective index, bounded object-size admission and `cat-file --batch` by exact40-hex OIDs. Parse NUL-delimited paths, stage0 only, regular100644/100755 modes and exact SHA1 object bodies; reject symlink/submodule/unmerged/duplicate/conflicting entries, malformed framing, unrequested/trailing responses and missing objects. Preserve per-path parser context even for a shared OID. Private read-only children use safe no-hook/no-fsmonitor/no-textconv/no-filter/no-credential/no-lazy-fetch/no-network settings; no staging command, conversion, source execution or lazy fetch. This requires a new exact operation grammar, not an arbitrary-args option on `HistoryGitProcess`.

Suggested packaging: a dedicated `git-hook-worker.js` built from production source. Lite currently builds exactly3 runtimes in `scripts/build.cjs`; a fourth runtime requires deliberate build/provenance/VSIX inclusion and inspector/readiness updates. Do not load extension.js as if `vscode` existed in an external Node process. Use the already installed reviewed Code executable in Electron Node mode only after actual compatibility/pin checks; no Node install/download. The launcher must scrub startup preloads **before** Node starts, not merely delete NODE_OPTIONS inside an already running worker. A fixed reviewed Git-distribution `env.exe -i` invocation is one possible launch mechanism; it adds a tool pin/native gate. Pass only fixed OS paths plus the captured effective-index path; no credential/registry values. Keep the original hook's own environment unchanged by using child-only environment clearing.

Every child observes actual close plus both EOFs; retain jobs and streams. Withdrawal clears private buffers/results, never sends a signal or destroys a pipe; ownership stays busy until actual closure. ALLOW is released only after completed analysis and final owner/config/policy/runtime/index recapture. A filesystem race after final check is still a cooperative same-user limitation, not an atomic OS commit boundary.

## Meaningful tests to author after F25 barriers

All cases below are NOT-RUN. Establish before-implementation failures, retain original assertions and exact before bytes, then implement one feature. Tests should target the boundaries rather than mirror string construction.

| Group | Required observable oracles |
| --- | --- |
| Owner/review | Default false and repository true produce zero discovery/key/backup/write/child calls; cancel preserves all bytes; caller approval/path ignored; false→true cannot revive a withdrawn plan; live flag-source disappearance blocks. |
| Coexistence | Default and supported custom hooksPath actually execute; duplicate/ambiguous/outside/include layouts refuse before mutation; existing public marker runs once after scan; existing exit7 still blocks; forged marker does not establish ownership. |
| Recovery | Encrypted old canary never occurs in new private store/receipt/UI/export; backup/readback/PREPARED failure precedes every write; missing/corrupt key refuses restoration; simulated write/readback/receipt faults produce exact rollback or retained RECOVERY_REQUIRED; owner edits/new files are never overwritten. |
| Staged authority | Secret staged then sanitized worktree blocks; public staged then secret worktree passes without reading that worktree; initial/deletion/rename/repeated-OID/context/zero-byte controls; temporary/relative effective index is scanned or explicit refusal, never default fallback. |
| Protocol | NUL paths with spaces/Unicode/leading dash, malformed headers and duplicate entries, stage1–3, symlink/submodule, wrong body OID/size/type, truncation/trailing data, nonzero exit/stderr/stream error all refuse without content printing. |
| Canonical scope | Supported source/config static canaries and canonical provider/encoding controls block; public constants/templates/publishable keys/near matches remain useful; same body in separate files is not concatenated; canonical exception/WITHHELD never becomes ALLOW; low-entropy opaque values explicitly remain outside standalone scope. |
| Limits/races | Exact boundary vs one-unit-over for entries/blob/raw total/protocol/work/time; invalid UTF8 still charges admitted bytes; monotonic reversal; owner/index/config/runtime changes at every await; held completed ALLOW becomes unreleasable after withdrawal. |
| Lifecycle | Setup, owner commit and scanner child roles are distinguishable; complete environment-key assertions and startup-preload canaries; parent environment unchanged; naturally delayed child retains STOP_UNCONFIRMED ownership until actual close+EOF, signals0; no timeout-kill helper. |

## Native isolated fixture protocol

Use a new retained marked synthetic repo/profile and the new exact VSIX only after current unit/compiler/full/content gates. Setup may disable hooks. **Positive owner commit must not pass a per-command empty `core.hooksPath` override.** Pin actual Git, Code runtime, launcher helper, worker, package and hook-generation bytes. Record the actual owner config origin/value using the synthetic config authority, plus scanner/existing-hook invocation witnesses. Do not execute these during preparation.

1. Install through the packaged native command and actual modal owner review. Cancel first: byte-identical config/hooks/index/HEAD and zero backup writes. Then approve: encrypted recovery and exact inserted generation observed, original existing body remains at its original path.
2. Actual ordinary public commit: exit0, both EOFs, HEAD advances, expected public tree, canonical scanner witness and original hook marker each occur once. Repeat under supported custom hooksPath with no hidden invocation override.
3. Stage a synthetic supported canary, sanitize only its worktree copy, then actual commit: nonzero, HEAD unchanged, staged bytes unchanged, worktree unchanged, scanner witness present and no canary in any exposed sink. A generic early Git failure without that witness is not a protected negative PASS.
4. Public staged/unstaged-canary control: actual commit succeeds and proposed tree remains public; track zero worktree source-content reads by the scanner. Initial, deletion and renamed controls remain useful.
5. Actual `commit -a` and path-limited commit: observe the effective index passed by Git and compare the committed result to the exact admitted snapshot, or record clear refusal/unsupported with unchanged HEAD. Never infer success from a default-index unit mock.
6. Existing hook's deliberate exit7 blocks public commit after the scanner has allowed it; exact encrypted undo restores original hook bytes/mode, then another public commit demonstrates restored original invocation. Edited-generation undo refuses and preserves new owner bytes.
7. Withdraw actual owner flag or reviewed removal: coverage/status immediately becomes unavailable, a previously held decision cannot release, and restart cannot promote PREPARED/stale state. After confirmed reviewed restoration, native public commit works through the original hook alone. Explicitly label the lost scanner coverage.

For every owned phase retain literal args, complete allowed environment keys, actual close code/both EOF/signals0, private source identity, value-free native observations, before/after allowlisted repository facts and executed fixture hashes. Existing public metadata/commit writes are the only intended Git mutations; no push, rewrite, normal-profile read, real history, process signals or remote operation. Reopen affected earlier verification if shared canonical/Git code changes. Required new VSIX, affected actual native/tool gates, safe withdrawal, ledger receipts and both local exhaustive byte barriers still belong to F26a before any F26b production.
