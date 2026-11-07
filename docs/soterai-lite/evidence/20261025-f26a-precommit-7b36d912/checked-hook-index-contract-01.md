# F26a checked effective-index contract01

**TEST-AUTHORING / PREPARED / STATIC-ONLY / NOT-EXECUTED; LOW independence.** Parent F25 source1000/transition10 barriers are reported PASS; F26a is the sole active production card. This contract precedes the new canonical `checkedHookIndex.test.ts` baseline. It authorizes no Git child, worktree content read, object scan, hook installation, external profile, deletion, signal, network or next feature. Tests use retained synthetic directories and manually framed indexes only. No production implementation is supplied here.

Root reviewed and corrected the initial synchronous proposal before any file freeze: existing `CheckedGitMetadata` exposes no root predicate, so a caller-supplied genuine descriptor could be borrowed from another root. Preserve that shared F10 module unchanged. The new factory prepares a fresh real metadata authority **internally for the supplied root**, avoiding that inference.

```ts
export interface CheckedHookIndex {
  readonly root: string;
  readonly indexFile: string;
  readonly metadata: CheckedGitMetadata;
  readonly environment: NodeJS.ProcessEnv;
  readonly entries: readonly StagedEntry[];
  available(): boolean;
}
export function prepareCheckedHookIndex(
  root: string,
  indexPath: unknown,
  ambient: NodeJS.ProcessEnv,
  enabled: () => boolean,
): Promise<CheckedHookIndex | undefined>;
export function isCheckedHookIndex(value: unknown): boolean;
```

The aggregate is authenticated by a private WeakSet and frozen with frozen entries/rows/environment. `metadata` must be the genuine internally returned `prepareCheckedGitMetadata(root, ambient, guard)` descriptor. A structurally equal clone, accessor lookalike or Proxy is not authenticated. No caller-supplied metadata authority or mutable root replacement exists. Environment equals the exact real `metadata.environment` plus one validated absolute `GIT_INDEX_FILE`; no ambient merge, PATH, credentials, preload variables or config overrides. The existing metadata module already permits inert bounded `core.hooksPath` config: do not incorrectly reject it based on the older reconnaissance wording.

`indexPath===undefined` selects exactly `<root>/.git/index`. Otherwise require a nonempty primitive string denoting an existing regular index file inside the same ordinary `.git` directory, using either an exact canonical absolute path or a canonical root-relative slash form such as `.git/index.lock`. No fallback for missing/unsafe explicit input, no coercion, outside/UNC/drive-relative/ADS/parent/dot/empty component/backslash-relative/trailing-dot-space/short-name alias/control/device path. An actual ordinary `index.lock` is permitted; lock-like names alone do not authorize or invalidate an index. Hardlinks, junctions/symlinks, parent replacement and canonical aliases refuse. No worktree path or file body is accessed by this capability. Default index absence is UNAVAILABLE rather than an invented empty tree; an explicit existing empty-tree index is valid.

Validate a regular bounded4MiB SHA1 DIRC index, version2 or3 only. Verify the trailing20-byte SHA1 over every preceding byte, exact entry count/framing/padding, regular100644/100755 modes and stage0. Extended-entry flags/sparse/split/unknown representations are unsupported. Decode paths fatally, validate the flags' recorded path length, and derive rows through the exact current `parseStagedEntries` grammar/128-entry/256KiB listing/2048-byte path/255-unit component rules. Zero-entry indexes are supported. Unknown extensions refuse; only unique framed TREE/REUC extension records are permitted. Their opaque bounded bytes do not supply tree/blob admission authority. Reject malformed/truncated/overlapping extension lengths and trailing data rather than skipping them. The fixture does not claim arbitrary cache-tree or resolve-undo semantic validation.

Capture regular-file identity, exact SHA256 bytes, root and `.git` parent identity/canonical containment, real metadata availability and an enabled epoch. `available()` rechecks them and is sticky: enabled false, exception, metadata/config drift, effective-index byte/identity change, parent change or missing file permanently withdraws this aggregate even if old bytes/flag are later restored. A new factory is required. Disabled admission returns before index reads or metadata preparation jobs. Index changes after read/between awaits cannot return a still-available descriptor.

Manual fixtures use12-byte DIRC headers,62-byte fixed fields, UTF8 path/NUL, zero padding to8-byte entry alignment, optional framed TREE/REUC records and real SHA1 footer. Malformed selected indexes are explicit alternatives next to a valid default, so genuine shared-metadata refusal cannot obscure the new component's oracle. A different OID in the alternative plus a valid public default proves no fallback. Metadata preparation never invokes Git or reads worktree contents.

Required tests cover default/v2/v3/zero entries, exact absolute+relative alternative including index.lock, preserved case/Unicode/leading dash paths, exact sanitized environment, private capability forgery,128/129 entries, listing/index byte bounds, wrong signature/version/checksum/flags/stage/mode/name length/padding/extension, no accepted prefix, unsafe and accessor paths, missing alternative no fallback, hardlinks/junctions, source-body avoidance, disabled zero-index-read, byte/identity/config/flag withdrawal and false-to-true nonrevival. Tests do not delete retained fixtures; replacement checks archive old exact synthetic files by rename inside their checked fixture root. No real repository history or Git command runs.
