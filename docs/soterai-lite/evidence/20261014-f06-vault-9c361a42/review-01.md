# F06 design review 01

Scope: read-only review of frozen design and pre-F06 source. Same-lineage independence **LOW**. No tests, native host, real secrets, normal profile, or production edits were performed. This review is not execution evidence.

Reviewed identities (SHA-256):

- design-01.md: `98c292716eb8ced020867a2c66d5ee62a3b7e492ae79c86c4718e8bef97a7dee`
- VaultManager.ts: `a50ed9e610aa5923ea3e7595db7d390cf69365805aaeb80d39c9c3dfa6994c24`
- SecureEditorModel.ts: `9879ce8857567f7f2d70c028946189da0388c900507e75950c86521a53acd881`
- WorkspacePathGuard.ts: `84793782ca8a8840040a25f964fc4e3e6fc4697549a24bf3d9bf4180e5bd86f8`

The frozen design directly covers current manager deficiencies: value-fragment previews, permissive key creation, unbounded reads, relative-source restoration, unbound backup contents, copied example comments/unsupported lines, and missing manager-owned review. These are current-source facts, not claims about forthcoming implementation.

## Narrow implementation guards

1. **Preserve original dotenv representation for restoration.** SecureEditorModel.readOwnerValue decodes double-quoted backslash-n/backslash-r; applyOwnerValue can choose a different quoting representation. Existing restorePlaceholders performs literal substitution. Combining decoded values with literal replacement can change the source structure. Store the exact original replacement span privately, separately from the logical value, or restore through a representation-aware model. Assert exact-byte round trips for escaped-newline double quotes, literal multiline quotes, duplicate names, inline comments and CRLF. Root has confirmed the planned private replacementText approach and generation checkpoint original image; it is not yet verified.

2. **Keep whole-vault recovery images coherent.** A generation checkpoint containing complete vault before/after images must not overwrite later entries belonging to another file or project. If unfinished generation A exists, either withhold other global mutations until reviewed recovery completes A, or validate a merge that preserves unrelated later entries. Root has confirmed the planned exclusive global pending pointer that blocks any other mutation; it is not yet verified. Test interruption after vault commit, attempted mutation B, then recovery A. B must be withheld or its entries retained.

3. **Keep safe examples independent of original lines.** Existing generateEnvExample copies comments and unsupported lines. Use only supported parsed field names with empty values; deduplicate names and omit comments, suffixes and multiline contents. Unsupported parse fallback must not be mistaken for an editable environment field. Constant MASKED previews must not derive fragments, length or value hashes.

4. **Treat uncertain lock ownership as live.** Stale recovery requires proof that its owning process is dead. Access-denied, unsupported or malformed ownership observations cannot establish death. Retain conservative withholding and do not terminate processes. Canonical storage, bounded reads, issued-generation/source/root validation, verified key readback and immutable checkpoint readback remain necessary at implementation acceptance.

No additional design-scope blocker was identified beyond these guards. F06 implementation, fault baselines, actual SecretStorage/native restart and matching artifact acceptance remain pending. This review neither certifies OS key custody nor protection from arbitrary same-user processes.
