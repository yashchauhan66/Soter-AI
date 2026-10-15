# F06 native profile-storage compatibility review 05

Result: **No concrete blocker identified in this narrow compatibility delta.** Same-lineage independence **LOW**. This reviewer read source and existing synthetic evidence only; no tests/native launch, production edits, real secrets or normal profile reads were performed. Only this immutable evidence file was added.

Reviewed production SHA-256:

- VaultManager.ts: `01bceb03557c4759237eed8b8817073a63ce62d7d8687894e493066d84317125`
- VaultStorage.ts: `ca7a8e581ae03c32cc8564fbe7182409c0aaab7ee44c92f26da3a1b3b0f872d1`
- VaultMigrationPlan.ts: `dbe3b45646d3751c927680ca31001897faa3885aca23c9ef84695f114ed94505`

## Actual observation and primary local source

Native06 existing result: `D:/SoterAI-Lite-test-profiles/f06-native-host-20261015T031750Z-a2f6007c/save-results.json`, SHA-256 `acf0f2f96bf86db13de77379827c368b3ff7e0ab46e9dbc593789b0b5a0ee448`. Actual host version is 1.141.2 and the historical runtime is `50555368f9bd2378954b0a82fef4359218abdfa6d140f3520471a3de678bfd7b`. Its value-free guard metadata records trusted=true, flag get/default/global=true, globalStorageScheme=vscode-userdata, and no authority/query/fragment. It records zero SecretStorage get/store calls and remains 1 PASS/5 FAIL. These failures are not reassigned to the corrected source or artifact.

Installed public application files inspected:

- `C:/Users/USER/AppData/Local/Programs/Microsoft VS Code/16507d91be/resources/app/out/vs/workbench/api/node/extensionHostProcess.js`, SHA-256 `66b7ab0b229750f6950fa5986b5f8c98b4c0b49cc8a0da772dc391f0ba6b9b63`. The context globalStorageUri getter delegates to `_storagePath.globalValue`; that method joins the extension id beneath environment.globalStorageHome without changing its scheme. Workspace storage uses a separate workspaceValue path.
- `C:/Users/USER/AppData/Local/Programs/Microsoft VS Code/16507d91be/resources/app/out/vs/workbench/workbench.desktop.main.js`, SHA-256 `c653e1bc84b8988b2c913c7ab3f4a7ea3b540ad94a2ac0c4ab43cae3808a0470`. The desktop extension environment receives defaultProfile.globalStorageHome. The application's own native storage-path implementation explicitly takes globalStorageHome with scheme=file before reading fsPath.

Combined with the native metadata, these facts explain why the prior file-only alive guard rejected vault commands before capture or native owner review. This is a diagnosed availability defect, not a SecretStorage failure or demonstrated secret leak.

## Trust assessment of the correction

The manager derives its physical storage path solely from the extension-owned context globalStorageUri, converting its scheme to file before obtaining fsPath. Mutation availability accepts only file or local vscode-userdata; vscode-userdata with env.remoteName is withheld, as are authority, query and fragment. Unknown provider schemes are not admitted by this change. Constructor path derivation performs no storage I/O by itself.

VaultStorage still independently requires an absolute canonical directory outside the project, validates existing ancestors before mkdir, rejects aliases, and applies bounded regular-file/nlink checks to records. The encrypted store namespace is unchanged. The correction adds no command-controlled storage URI, raw read route, plaintext fallback or automatic migration. Existing exact-key, checkpoint, source/root and disclosure guards remain.

The preserved native-storage-before-01 transcript shows V28 failing under the former guard and V29 passing for unknown provider schemes. This reviewer inspected that transcript and test source, but executed neither test. Corrected focused/full/artifact and actual current-host recovery acceptance must come from their matching root-owned receipts. No remote-host behavior, rendered-human review, OS custody or universal same-user containment is certified here.
