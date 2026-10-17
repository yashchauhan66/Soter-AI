# F10 private filter and dispatch source review 02

Same-lineage reviewer `/root/evidence_adversarial_review`, independence LOW. Closing source metadata clock 2026-10-16 07:34:08 UTC. Scope: ManagedOutputFilter, ManagedOutputBinding, VaultManager.createManagedOutputFilter and CheckedPowerShellSession against frozen design03/04. Git execution, registration/profile and restart ownership are pending separate work. No tests, application/Git process, native host or build was executed by this reviewer. No production/existing-test files changed. The two explicitly requested new regression files and this note are the only writes.

## Concrete blockers at the snapshots below

**S10-01 late COPY private-guard drift:** dispatch completes/closes the private filter before awaiting its final destination BoundarySnapshot.load. The later session guard binds root/source/policy/parent but not the filter's cipher/key/pending registry state. A private registry invalidation during that await can therefore be missed before exclusive create/write. Move the final awaited destination check before filter finish, preserving the final private filter check and no await between it and guarded synchronous publication. New checkedPowerShellSessionReview.test.ts has F10-DR01 drift and F10-DR02 unchanged-copy controls using the real filter with a separate private predicate. The mutation is tied to the post-acquisition destination check, so both the old and reordered workflows reach it. No test was run by the author; root baseline/fix receipts remain required.

**S10-02 malformed complete bindings silently omit registrations:** the factory rejects partial source/root pairs, but parseVault accepts arbitrary strings and other-root exclusion compares only root string equality. Malformed complete roots/sources and source-outside-claimed-root metadata can be treated as another project or included without validating their binding. This violates the accepted strict/incomplete registry disposition. Validate canonical local URI metadata and source containment before excluding another root, without reading an original source or another project's filesystem. The root accepted this disposition. New managedOutputFilterReview.test.ts has eight malformed cases and one valid-other-root/current-mask control. Original source files intentionally do not exist. Its local Uri.parse mock only supplies the shared stub's missing query/fragment plumbing and is restored per test; it contains no protection decisions. Again no author execution occurred.

## Other inspected boundaries

The factory privately binds current raw policy and saved policy, stable canonical workspace identity, machine flags/trust/locality and configuration/key epochs. Existing cipher uses a twice-verified existing key. Current/legacy values are registered completely within F07 bounds; no current-key creation, original source read or encrypted recovery-source decryption fallback was found. Missing current vault checks retained recovery/unknown vault/write records; the empty-store synchronous guard cannot downgrade a captured cipher. The filter's private state does not serialize registrations or keys, short values conservatively mask whole nonempty channels, replacement safety is checked, and observed false/throw/cancellation is sticky.

Dispatcher canonical identities reject initial file/directory aliases and bind the list target before acquisition. Its retained guard is passed to the actual worker before spawn and protocol send and during output. This closes the dependency described in review01 at source level; the initial alias and a target swap before protocol send still need matching integration controls. No native outside-project enumeration was performed. The worker lifecycle guard now uses the session guard rather than the single-use filter.available state, avoiding a completed filter being mistaken for private drift. That known D20 correction is not a fresh result certified here.

No other high-confidence blocker was identified in this bounded review. The root's reported filter/dispatch/combined test counts were not independently rerun or recalculated. Native profile, exact packaged runtime, external tools, independent human gates and ratings remain pending.

## Separate Git design advice, not implemented acceptance

Freeze explicitly staged-only metadata, with labels that disclose no unstaged/untracked status. Fixed cached comparisons plus disabled external diff/text conversion, rename detection and submodules avoid the ordinary worktree conversion path; these option meanings are documented in [Git 2.36 diff](https://git-scm.com/docs/git-diff/2.36.0). This is an inference requiring actual pinned-runtime marker controls, not a universal callback guarantee. Keep config/includes, partial/promisor/missing-object/alternate/external gitdir cases unavailable unless explicitly proven. Verify no lazy fetch: [Git upload-pack security](https://git-scm.com/docs/git-upload-pack/2.43.4) explains that lazy fetch can execute configured commands/hooks and describes GIT_NO_LAZY_FETCH. Reuse hardened argument/environment helpers, not the existing timeout/execFile helper that can terminate children. The design needs paired synthetic configured-helper markers that remain untouched. Only official documentation was browsed; no Git operation or outbound model/application test ran.

## SHA256 snapshots before requested fixes

| Path | SHA256 |
| --- | --- |
| `packages/vscode-extension/src/terminal/ManagedOutputFilter.ts` | `fd43471bab3a3b69a2445594bd1fc5b22f6a40f5ce02d13134ffdd1683e32b2d` |
| `packages/vscode-extension/src/terminal/ManagedOutputBinding.ts` | `4b304b45e6a86c6ade886bc36805287238c3b255631afa5208d84fce41169d80` |
| `packages/vscode-extension/src/firewall/VaultManager.ts` | `7bdc89cb7ad79571c4f1bfdada05a9f65ab5e4d346cc22acb00f6307b358013a` |
| `packages/vscode-extension/src/terminal/CheckedPowerShellSession.ts` | `7e54c04fd34a85436d426e8bf1508d94d1e4f3311a25a053d80a07974bb23e60` |
| `packages/vscode-extension/src/__tests__/checkedPowerShellSessionReview.test.ts` | `b931044049e2f950a5815eeaf9e2f1aebbf0b0f55c9b6e290c726fe02ffcb4bf` |
| `packages/vscode-extension/src/__tests__/managedOutputFilterReview.test.ts` | `086d357d1ccc018e65c34de801bf27b6b6c4058fc8345bd56dbfb3ef73e4704b` |
| `design-03.md` in this evidence directory | `2e91589232672316cf573ddb6ef494e3477e9dc06abdd114434f4f0c58155c3d` |
| `design-04.md` | `b2c1a5dbccfc9edd434ac57a83791e46609130a38dc409a6a3ecc06c3544678a` |
