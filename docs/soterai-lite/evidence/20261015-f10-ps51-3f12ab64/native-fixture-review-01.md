# F10 native fixture authored, not executed

Same-lineage author; LOW independence. New source:
`packages/vscode-extension/src/__tests__/host/litePowerShell51.host.ts`.
Test-only builder `build-native-host-01.cjs` and launcher `run-native-01.ps1`
are new F10 files. No native window, build, product compiler, installation or real
child was run by this author. Only JavaScript `node --check` on the builder and
PowerShell `Parser.ParseFile` on the launcher were run: both syntax-only PASS,
zero PowerShell parse errors. TypeScript semantic compilation remains NOT_RUN.

The launcher requires explicit new VSIX/runtime SHA256 identities. Before
creating a fresh isolated D: execution tree it verifies the physical VSIX hash,
compares source runtime and manifest bytes against the corresponding unique
archive entries, and hashes the native editor executable and host fixture. A
unique developer snapshot changes only the activation main to a test bootstrap;
the actual packaged runtime bytes remain unchanged. Runtime/VSIX/editor hashes
are checked again after each native phase. No normal profile is used.

Primary phase has 15 declared observations; restart has 3. The second phase uses
the same newly created isolated profile/workspace after the first window closes
itself through `workbench.action.closeWindow`. No process kill/termination,
download, login, machine change, deletion or synthetic fixture cleanup exists.
An unresolved window times out INCOMPLETE and is retained.

The host captures and delegates native `registerTerminalProfileProvider` and
`createTerminal` plus real `CustomExecution` task execution. It invokes the
captured actual registered provider callback and passes its returned
`TerminalProfile.options` to real native `createTerminal`, observes actual PTY
events, and invokes the PTY's actual finite run method. It does not substitute a
session/worker/reader/filter. Native profile picker UX is explicitly NOT_TESTED.

Declared primary checks: exact activation/profile/flag/commands; native diff
cancellation and durable configure; real profile callback/terminal; installed
PS5.1 version; whole-line refusal and caller argument isolation via the native
hidden input entrypoint; real F04 ordinary deny/approve; real migration/env names
and masks; actual PS worker registered-value masking; head/tail/search/exclusive
copy; pending approval cancellation; finite child cancellation and withdrawal;
affected F09 selected fake-value native task; profile undo plus postflow safe read
and no-original-TextDocument assertions. Restart checks prior persisted metadata
is recovered UNVERIFIED with no currently owned workers, exact retained
ciphertext/placeholder-file bytes and restored setting, then a deliberately new
actual PS worker with an id distinct from all recovered rows.

All consent is scripted through native API wrappers, not human attestation.
Public result metadata contains only fixed booleans/counts/state/constant ids,
source/ciphertext binding hashes after migration, and output byte counts. Raw
synthetic secret values are not included in result records. The fake selected
app can inspect/write/transmit its own injected value, as in the F09 contract.

Open gaps: native F10 Git metadata is not yet part of this host fixture pending
the final pinned Git API/setup from its owner. Functional10/security17 must still
run independently on the same new artifact. This host contains an affected F09
native task smoke, not the entire earlier 12-check task/debug suite. Native
profile picker, human usability/accessibility, actual external agents,
unmanaged shell reads/uploads and clean installed-VSIX lifecycle remain outside
these observations. No new protection or PASS is inferred from fixture authoring.

Suggested execution after root review/typecheck and exact package inspection:

1. Build the host once with `node build-native-host-01.cjs` via the existing
   immutable check runner; choose another explicit output name for any retry.
2. Run `run-native-01.ps1` via the existing check runner with the installed
   `CodePath`, new `HostTestsPath`, exact extracted `ExtensionRoot`, physical new
   `VsixPath`, and their explicit expected runtime/VSIX hashes. Use environment
   escalation for the required GUI/child/D: access.
3. Preserve both phase outputs, native stdout/stderr, all isolated profile files,
   driver errors, freeze and final summary. All declared observations must really
   execute; missing/failed primary aborts restart rather than fabricating PASS.
