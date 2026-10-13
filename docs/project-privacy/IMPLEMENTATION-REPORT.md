# Project privacy implementation and verification

Date: 2026-10-11. Starting branch/commit: `security-hardening` / `8ef3aeb54f4019f4ee815a844443995176a656f0`. These are uncommitted local changes; package version remains 0.6.3. No installation, publication, deployment or live IDE reload was performed.

## Result and claim

FACT (local source, tests and build, 2026-10-11): the project safe-reader workflow is implemented and its local verification passes. It adds file restrictions, one native editor review per safe read, dotenv names with every value masked, wholly masked sensitive-file views, a fixed read terminal, revocation and a themed privacy page. Tests exercise actual product modules/command adapters with synthetic files and a VS Code stub.

INFERENCE: the full five-part request remains PARTIAL. A sibling extension, Cline's own tools or a native process is not compelled to use this reader. Original files retain their OS accessibility. Project scope alone cannot supply the missing isolation or mandatory network boundary.

**Claim sentence:** SoterAI now supplies reviewed, masked project-file views through its own managed reader; it does not establish that Cline, other extensions or native terminals cannot read or send project originals. Selected-architecture G1-G6 remain UNTESTED, the full claim remains BLOCKED, release remains WITHHELD and deployment remains DEFERRED.

| User requirement | Delivered in source | Status for the full requirement |
|---|---|---|
| Secrets unreadable to AI | Shared credential-path exclusion in default managed collection; explicit sensitive markings; safe views | PARTIAL: direct original-file and buffer access remain outside mediation |
| Easy arbitrary-file restrictions | Project privacy page and Explorer actions reuse saved add-only denies | PARTIAL: managed denies are not OS access denial for Cline/native processes |
| Approval plus masking | One exact saved-file/policy review; dotenv names only; other sensitive content wholly withheld; ordinary-file redaction; managed reader terminal | PARTIAL: Cline's own terminal/read tools are not integrated; unknown private text in ordinary files can remain |
| Professional UI/UX | Responsive themed page, fixed actions, visible coverage, metadata table, keyboard/focus and accessibility structure | IMPLEMENTED LOCALLY: native-host UX, screen-reader use and enterprise usability remain UNTESTED |
| Every project leak surface | Strengthened managed read and paste/reveal paths | INCOMPLETE: source history, copies, original buffers, OS clipboard/capture, unmanaged output and independent uploads remain gaps |

## Changed product and test files

FACT (working-tree inspection, 2026-10-11):

- New `src/project-privacy/`: `SafeFileView.ts`, `ProjectFileAccess.ts`, `SensitiveRestrictions.ts`, `ReadTerminal.ts`, `commands.ts`, `panel.ts`.
- `src/ai-boundary/BoundarySnapshot.ts`: use the shared sensitive-path list; add policy-revision and protected-region checks for the explicit approved route. Existing default denied reads still return omitted content.
- `src/extension.ts`, `src/webview/ControlPanelViewProvider.ts`, `package.json`: register seven commands, add sidebar/Explorer entries and the machine-scoped restricted feature flag. One new core palette entry contains the workflow; other actions stay advanced/hidden.
- `src/advanced/commands.ts`, `src/clipboard/ClipboardGuard.ts`, `src/secret-broker/commands.ts`: withhold risky original-paste/reveal overrides while project privacy is enabled and recheck the setting after review.
- New `src/__tests__/project-privacy.test.ts`; additions to `clipboard-boundary.test.ts` and `phase5-final-review.test.ts`; command-palette contract updated in `extension.test.ts`.
- `README.md` and generated `docs/vscode-extension-readiness.md`: describe the local workflow and update actual manifest counts. Planning, guide, Cline research, reports and raw verification evidence are under `docs/project-privacy/`.

Paths above are relative to `packages/vscode-extension/` except the explicitly named repository `docs/` paths. No broker, MCP server, OS policy or host-probe source was changed. An MCP file-read adapter for Cline was not registered.

## Verification

FACT (local runs, 2026-10-11):

| Check | Actual result | Evidence |
|---|---|---|
| Focused safe-reader and real managed override controls | 41 passed, 0 failed | [focused-tests-final.log](evidence/20261011-reader-v1/focused-tests-final.log) |
| Full extension unit suite | 667 discovered; 665 passed, 0 failed, 2 skipped; exit 0 | [extension-tests-final.log](evidence/20261011-reader-v1/extension-tests-final.log) |
| `npm run lint` / TypeScript | Pass; exit 0. In this repository lint delegates to `tsc --noEmit` | [typecheck-final.log](evidence/20261011-reader-v1/typecheck-final.log) |
| Production extension/broker/MCP build | Pass; exit 0 | [build.log](evidence/20261011-reader-v1/build.log) |
| Headless Edge rendering of actual privacy template | Dark/light 1280 px and dark 420 px: no horizontal page overflow; 7 buttons; keyboard sends one fixed action; duplicate actions disabled; zero page errors | [ui-visual-check-completed.log](evidence/20261011-reader-v1/ui-visual-check-completed.log) |
| Final working-tree whitespace and historical-evidence checks | Recorded separately after report generation | [integrity-check.log](evidence/20261011-reader-v1/integrity-check.log) |

The focused suite is a subset of the full suite, not 41 additional passing tests. It includes cancellation, stale file/policy/project/identity snapshots, revocation, timeout, disabled flag, duplicate requests, metadata-only receipts, sensitive masking, persistent deny retention and public positive controls. The multiline dotenv regression ensures assignment-looking value text never becomes a released name.

The two skipped tests could not create Windows symlinks (`EPERM: operation not permitted, symlink`): an outside-workspace file link and an internal link/output target. The Windows junction test passed. The skipped assertions remain UNTESTED; no Windows feature or privilege setting was changed to enable them.

FACT (retained initial run, 2026-10-11): the first full-suite run had 659 passed, 5 failed and 2 skipped out of 666. Four failures concerned generated/readme counts after adding commands/settings; one concerned ungated new commands. The manifest visibility was corrected, a single intentional core entry was added to the palette contract, and documentation was regenerated. Initial evidence remains at [extension-tests.log](evidence/20261011-reader-v1/extension-tests.log). Final security assertions were not relaxed to obtain a pass.

FACT (retained visual-check diagnostics, 2026-10-11): the first inline visual harness used an invalid named import from a CommonJS module. A second harness rendered three layouts but reused the same JavaScript global context, so its final action assertion failed. The completed check uses a fresh page for each template and verifies runtime errors and keyboard dispatch. Both failed logs remain as `ui-visual-check-initial.log` and `ui-visual-check-final.log`. No product source was changed to accommodate the visual harness.

Screenshots use synthetic project/path metadata: [dark desktop](evidence/20261011-reader-v1/privacy-dark-1280.png), [light desktop](evidence/20261011-reader-v1/privacy-light-1280.png), [narrow layout](evidence/20261011-reader-v1/privacy-dark-420.png). These are browser-template checks with a mocked editor API, not screenshots or approval evidence from live VS Code/Cline.

## Artifact identities and historical separation

FACT (SHA-256 computed locally, 2026-10-11):

| Bundle | New local production SHA-256 |
|---|---|
| extension.js | `8ee14f9798011270eab9794c31e9f348eabd552b60952e8e08c381c05ce74206` |
| local-ai-broker.js | `6c07093d81243f0063bfd8d51b3d23a162cd3b4375c312c75b59e95f8239a397` |
| soterai-mcp-server.js | `6d5e1199d509139387e542e91faad02b790e692415416bd7eb5510a6e6ecc486` |

The new extension bundle has not been loaded or tested in a live host. The broker and MCP hashes are unchanged. The previous three bundles were preserved in `evidence/20261011-reader-v1/pre-change-bundles/`; the previous extension hash is `ca6a3e027cb881449d94410e82edb9e65503ee29165069f48b1f26780730338b`. [Bundle hashes](evidence/20261011-reader-v1/bundle-hashes.json) and [source/evidence checksums](SHA256SUMS.txt) identify this local change.

The existing suite appended synthetic results to tracked `packages/vscode-extension/artifacts/phase2/results.jsonl`. Its generated output was saved as `unit-generated-phase2-results.jsonl` in this new evidence directory. The original 76,990-byte prefix, including its Windows line endings, was validated against starting HEAD and restored byte-for-byte from that saved output; its Git diff and modified status are empty. Its restored SHA-256 is `3191295ab69a2f35b069a8b6bab94ac5a4c9670fd19708cfa81ab7d21fe1c9e3`. Phase 0-5 historical host reports and A0 evidence were not rewritten. Their outcomes apply to their recorded artifacts, not this newly built extension.

## Rollback and what remains unprotected

FACT (source and unit controls, 2026-10-11): setting `soterai.projectPrivacy.enabled` false withdraws the new reader routes and clears their previews while retaining saved denies. Legacy risky original/reveal options return to their prior settings. Reverting source is needed to roll back the added shared sensitive-path exclusion; the flag does not remove that conservative default exclusion. No original files or OS settings were migrated, so no plaintext restoration or OS rollback is needed. Revocation cannot retract content already released, copied or transmitted.

INFERENCE / UNTESTED LIMITS: same-user modification of settings/storage, hostile sibling extensions, original open buffers/tabs, direct filesystem access, unrestricted child processes, Git objects and old copies, inherited secrets, build/debug output, clipboard/screen capture, other MCP tools and independent egress remain outside this reader's boundary. Unknown sensitive prose is not universally detectable. A native editor modal does not prove independent user presence or authenticated agent identity.

UNTESTED: live new-bundle host behaviour, Cline 4.1.23 routing/tool integration, concurrent filesystem replacement beyond the tested snapshots, remote workspaces, native UI assistive technologies, actual mounted-compartment denial, independent policy custody, secret-key custody, mandatory egress, administrator compromise and side channels. See [Cline assessment](CLINE-ASSESSMENT.md) for version/source gaps and [the implementation plan](IMPLEMENTATION-PLAN.md) for the deferred complete-contract architecture.

The disk-full automatic-review interruption is documented with its exact message in the plan. It was resolved by clearing verified regenerable compile caches before retrying the original write; it is not a pending refusal or evidence of security coverage.
