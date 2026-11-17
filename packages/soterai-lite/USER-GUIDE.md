# SoterAI Secret Guard user guide

[Overview](https://github.com/yashchauhan66/Soter-AI/blob/main/packages/soterai-lite/README.md) · [Privacy](https://github.com/yashchauhan66/Soter-AI/blob/main/packages/soterai-lite/PRIVACY.md) · [Changelog](https://github.com/yashchauhan66/Soter-AI/blob/main/packages/soterai-lite/CHANGELOG.md)

This guide covers the **0.7.1 Windows x64 preview**, packaged under the existing extension ID `soterai.soterai-ide-guard`. Older source files and recovery records may call it **SoterAI Lite**. The visible name changed; the extension identity and storage keys did not.

Start with local scanning and reviewed context. You do not need an AI account, Docker, a vault or a configured provider for those workflows. Optional integrations have their own requirements and approvals.

## In this guide

- [Installation and updates](#installation-and-updates)
- [Your first local check](#your-first-local-check)
- [Everyday workflows](#everyday-workflows)
- [Settings and defaults](#settings-and-defaults)
- [Supported integrations](#supported-integrations)
- [Advanced workflows](#advanced-workflows)
- [Recovery and removal](#recovery-and-removal)
- [Troubleshooting](#troubleshooting)
- [Security scope and release status](#security-scope-and-release-status)

## Installation and updates

### Requirements

| Requirement | Current scope |
| --- | --- |
| Operating system | Windows x64 (`win32-x64`) |
| Editor API | VS Code 1.85 or later (`^1.85.0` in the manifest) |
| Workspace | One local filesystem project for managed workflows |
| Trust | Local scanning is available in Restricted Mode; configuration changes, managed routes and vault operations require a trusted, supported workspace |
| Account | No SoterAI account for local scanning or preview generation |
| Unsupported environments | Linux, macOS, remote and virtual workspaces; other editors are not implied to be verified by their ability to install a VSIX |

### Choose your IDE

Choose your editor below and follow its installation steps. These instructions are bundled with the extension for offline reading; the Marketplace and Open VSX links open the available registry versions.

Use the steps for the app where you want SoterAI installed:

| Your IDE | Installation steps |
| --- | --- |
| Visual Studio Code | [VS Code](#vs-code) |
| Google Antigravity | [Antigravity](#antigravity) |
| Windsurf | [Windsurf](#windsurf) |
| Kiro | [Kiro](#kiro) |
| Cursor | [Cursor](#cursor) |
| VSCodium | [VSCodium](#vscodium) |
| Another compatible desktop editor, or no search result | [Download from Open VSX and install a VSIX](#download-from-open-vsx-and-install-a-vsix) |

**Use this identity in every IDE:**

| Field | Expected value |
| --- | --- |
| Extension name | **SoterAI Secret Guard**; older listings may say **SoterAI IDE Guard** |
| Publisher | `soterai` |
| Extension ID | `soterai.soterai-ide-guard` |
| Version described by this guide | `0.7.1` preview |
| Platform for this preview | Windows x64 (`win32-x64`) |

Open VSX is a website and extension registry used by multiple editors. On the website you can download an extension package, called a **VSIX**. Inside an editor you can search its extension store and install directly. **You do not need an Open VSX browser button that launches your IDE.** No GitHub clone, Node.js setup or terminal command is needed for these installation steps.

The instructions below describe installation routes to try in each editor. They do not certify SoterAI compatibility with every editor version. This preview requires the Windows x64 environment above and an editor with compatible VS Code APIs. Built-in AI assistants are not automatically protected by installing SoterAI.

### VS Code

1. Open the [SoterAI Marketplace listing](https://marketplace.visualstudio.com/items?itemName=soterai.soterai-ide-guard) in your browser.
2. Choose **Install Pre-Release** when available. Allow the browser to open **Visual Studio Code**, then finish installation in VS Code.
3. If the browser does not open VS Code, open VS Code yourself. Click **Extensions** in the sidebar or press `Ctrl+Shift+X`.
4. Search `soterai.soterai-ide-guard`, open the result from **soterai**, and choose **Install Pre-Release** if offered. If it is already installed on the release channel, use **Switch to Pre-Release Version** when available.
5. Reload if prompted, then [check the installation](#check-the-installation).

Optional terminal shortcut, if the `code` command is already available:

```sh
code --install-extension soterai.soterai-ide-guard --pre-release
```

That command installs into VS Code. For another IDE, follow its own steps below.

### Antigravity

1. Open **Antigravity** and your local project in its **editor window**. If you are in the Agent Manager, switch to the editor first.
2. Click **Extensions** in the editor sidebar, or press `Ctrl+Shift+X`.
3. Search `soterai.soterai-ide-guard`. If there is no result, try `SoterAI Secret Guard`.
4. Open the matching extension from publisher **soterai**, and click **Install**. Choose the pre-release option if offered for this preview.
5. Reload if prompted, then [check the installation](#check-the-installation).

**Cannot find it?** [Download the VSIX from Open VSX](#download-from-open-vsx-and-install-a-vsix), then run **Extensions: Install from VSIX...** inside **Antigravity**.

### Windsurf

1. Open **Windsurf** and a local project.
2. Click **Extensions** in the sidebar, or press `Ctrl+Shift+X`.
3. Search `soterai.soterai-ide-guard`. If needed, try `SoterAI Secret Guard`.
4. Check that the publisher is **soterai**, open the result, and click **Install**. Choose the pre-release option if offered for this preview.
5. Reload if prompted, then [check the installation](#check-the-installation).

**Cannot find it?** [Download the VSIX from Open VSX](#download-from-open-vsx-and-install-a-vsix), then run **Extensions: Install from VSIX...** inside **Windsurf**.

### Kiro

1. Open the **Kiro desktop IDE** and a local project. These steps use the IDE, not a CLI session.
2. Click **Extensions** in the sidebar, or press `Ctrl+Shift+X`.
3. Search `soterai.soterai-ide-guard`. If needed, try `SoterAI Secret Guard`.
4. Open the matching extension from **soterai**, and click **Install**. Choose the pre-release option if offered for this preview.
5. Reload if prompted, then [check the installation](#check-the-installation).

**Cannot find it?** [Download the VSIX from Open VSX](#download-from-open-vsx-and-install-a-vsix), then run **Extensions: Install from VSIX...** inside **Kiro**.

### Cursor

1. Open **Cursor** and a local project.
2. Open **Extensions** with `Ctrl+Shift+X`.
3. Search `soterai.soterai-ide-guard` or `SoterAI Secret Guard`.
4. If the matching result from **soterai** is available, click **Install**. Select the pre-release option if offered for this preview.
5. If it is unavailable in Cursor's current store, use the [Open VSX VSIX steps](#download-from-open-vsx-and-install-a-vsix) inside **Cursor** instead.
6. Reload if prompted, then [check the installation](#check-the-installation).

### VSCodium

1. Open **VSCodium** and a local project.
2. Open **Extensions** with `Ctrl+Shift+X`.
3. Search `soterai.soterai-ide-guard` or `SoterAI Secret Guard`.
4. Open the matching result from **soterai**, and click **Install**. Select the pre-release option if offered for this preview.
5. Reload if prompted, then [check the installation](#check-the-installation).

**Cannot find it?** Use the [Open VSX VSIX steps](#download-from-open-vsx-and-install-a-vsix) inside **VSCodium**.

### Download from Open VSX and install a VSIX

Use this route when the extension does not appear in your editor's store, the browser does not open your IDE, or you need a manual installation.

1. **Open the listing in a browser:** [SoterAI on Open VSX](https://open-vsx.org/extension/soterai/soterai-ide-guard).
2. **Check the package:** publisher **soterai**, extension **soterai-ide-guard**, and the version you need. This guide describes **0.7.1 preview**. If a platform selector is shown, choose **Windows x64 / `win32-x64`** for this preview.
3. **Download:** choose **Download** for that version and save the file, usually in your **Downloads** folder. Its name must end in `.vsix`. Keep it as one file; do not unzip it or download the repository's source ZIP.
4. **Open your chosen IDE:** Antigravity, Windsurf, Kiro, Cursor, VSCodium or VS Code. Install from inside that app; double-clicking the file may open a different editor.
5. **Open the Command Palette:** press `Ctrl+Shift+P`, type `Install from VSIX`, then choose **Extensions: Install from VSIX...**. If available, you can also open Extensions and use the **...** menu → **Install from VSIX...**.
6. **Select the file:** browse to Downloads, select the `.vsix`, and confirm installation. Reload the IDE if prompted.
7. **Verify:** follow [Check the installation](#check-the-installation) below.

Registry links may serve an older version until the maintainer publishes this candidate. If the required preview or Windows x64 download is missing, ask the maintainer for its VSIX and verification information. A maintainer-provided preview installs using steps 4–7. Do not use an untrusted re-upload or assume an older registry package has this guide's features.

For an offline machine, download the compatible VSIX on a connected machine and transfer that file before following steps 4–7.

### Other IDEs

For another **VS Code-compatible desktop editor**, first try its Extensions search. If the listing is unavailable and the editor supports **Install from VSIX...**, use the manual steps above. Editor policies, extension API support and platform requirements can still prevent installation or operation.

**This VS Code extension package is not an installer for every IDE.** IntelliJ IDEA, PyCharm, WebStorm, Android Studio, Eclipse, Neovim and Visual Studio (the separate IDE) need their own integrations or plugins. Do not use this Open VSX package in those products. Browser-only and remote workspaces are outside this Windows preview's supported scope.

### Check the installation

1. In the **same IDE and profile** where you installed SoterAI, open Extensions (`Ctrl+Shift+X`) and find the extension under Installed. You can also search its ID; where supported, use `@id:soterai.soterai-ide-guard`.
2. Confirm publisher **soterai**, the installed **version**, and that the extension is enabled. If the version differs from this guide, check that version's documentation before using preview workflows.
3. Open a local Windows test folder, then press `Ctrl+Shift+P` and run `SoterAI: Run Safe Demo Scan`.
4. Confirm that the demo shows a scan result. Then run `SoterAI: Protect This Project Step by Step` for the guided setup.

A working demo checks local scanning; it does not verify protection of another AI tool's traffic. Install separately in each IDE you use. Editor profiles and recovery records are separate; installing in VS Code does not establish that SoterAI is installed or configured in Windsurf, Kiro or Antigravity.

### Updates

For a store installation, check the extension's page in the IDE for an available **Update** and its version or pre-release channel. For a manually installed preview, obtain the newer compatible VSIX and repeat **Install from VSIX...**. Do not assume a manual VSIX installation will receive store updates automatically.

Do not uninstall first just to update. Keep the same extension identity and editor profile, preserve recovery records, and read the [changelog](https://github.com/yashchauhan66/Soter-AI/blob/main/packages/soterai-lite/CHANGELOG.md). Installed upgrade and recovery evidence applies to the exact package that was tested, not to every later build.

### Installation problems

| What you see | What to do |
| --- | --- |
| Open VSX has no button that opens my IDE | Use Extensions search inside the IDE, or download the VSIX and install it from the IDE's Command Palette. |
| The browser opens VS Code when I wanted another IDE | Open the intended IDE yourself and use its Extensions search or **Install from VSIX...**. |
| Searching the name finds nothing | Clear search filters; try `soterai.soterai-ide-guard` and verify publisher `soterai`. If unavailable, use the manual Open VSX download. |
| The preview version or Windows x64 download is missing | Ask the maintainer for the compatible preview VSIX. Do not assume another version or platform includes it. |
| `Ctrl+Shift+X` does not open Extensions | Use the sidebar's Extensions icon or the editor's menu; shortcuts can differ with keymaps. |
| **Install from VSIX...** is missing | Make sure you are in the desktop editor window. Check that editor's extension support and your organization's policy; this fallback requires VSIX installation support. |
| The package is incompatible with the editor | Update the editor to a version with compatible VS Code APIs. This preview needs Windows x64 and API `^1.85.0`; updating does not guarantee a fork is supported. Do not edit the package to bypass the check. |
| Installation is blocked by an organization policy | Ask your administrator to allow the extension or provide an approved installation route. |
| The extension is installed but SoterAI commands are missing | Check the active IDE/profile and that the extension is enabled. Open a local folder, reload the editor, and retry the demo. If it still fails, report the exact error and editor version. |
| `code` is not recognized | Use VS Code's Extensions panel or **Install from VSIX...**. The terminal shortcut is optional. |

For unresolved problems, use the [issue tracker](https://github.com/yashchauhan66/Soter-AI/issues) with your IDE name/version, Windows architecture, SoterAI version, installation method and the exact error. Include sanitized details only.

## Your first local check

1. Run `SoterAI: Run Safe Demo Scan` from the Command Palette. The built-in example uses synthetic content.
2. Review the result and its reasons. A verdict describes the submitted scan, not the security of the whole project or another tool's traffic.
3. Open your test file and run `SoterAI: Scan Current File`. Live scanning is also enabled by default for supported content.
4. Run `SoterAI: Protect This Project Step by Step` for the guided workflow. It shows the next available action; each change still requires its own review.

The guided project scan reads saved files using built-in secret patterns. It does not load the vault's registered values, and a saved-file result does not establish coverage of unsaved buffers.

## Everyday workflows

### Share selected code

1. Select the code you want help with.
2. Run `SoterAI: Prepare Reviewed AI Context` and choose the selected-code option.
3. Read the local preview. Check remaining names, paths and business information.
4. Choose **Copy reviewed text** only when the preview is suitable to share.
5. Paste it into the assistant you choose. That destination's privacy and retention policies apply.

This action prepares text; it does not send a provider request. Source edits, protection-setting changes or edits to the preview invalidate the earlier review.

### Share an error or stack trace

Select the relevant log excerpt and run `SoterAI: Preview Debug Context from Selection`. SoterAI filters recognized secrets and shows a preview before an explicit copy. Keep the excerpt focused on the error.

Selections and generated preview headers must fit within the 64 KiB limit. Unsupported or oversized input is withheld rather than treated as safe. Paths, hostnames and unknown private prose still need manual review.

### Explain an environment without revealing its values

Run `SoterAI: Prepare Reviewed AI Context` and choose the environment-contract option. It discards assignment values and comments, then derives suggested types and synthetic examples from variable names.

The result is a description for development, not a copy of your real environment. Variable names can also be private; review them before copying.

### Act on a live finding

Open the lightbulb on a current finding and choose **Preview sanitized lines before copying**. The preview filters the affected line or block, including other recognized secrets beside the selected finding.

- **Copy reviewed text** changes the clipboard only after your choice.
- Changed or closed source documents, edited previews and expired actions require a fresh review.
- **Review vault protection for this file** opens the existing migration review instead of blindly deleting a credential.
- Unsaved edits are not silently saved for migration.

A diagnostic or quick fix does not block another extension's direct read or network request.

### Protect secrets stored in project files

Run `SoterAI: Review Workspace Secrets`, or use the vault action on a finding. Review the detected files and proposed changes before approving anything.

Select the files to review, then approve each file in its own confirmation. **Cancel** stops the remaining batch. Repeated clicks do not queue more migration windows. Existing `.env.example` files are preserved unchanged; a second environment file does not need to overwrite that example before it can be migrated. The result states how many files completed and whether a failure stopped the remaining work.

Approved migration replaces selected recognized values in the current saved files with placeholders and keeps encrypted recovery outside the workspace. Other copies, Git history, inherited environments and values that were not detected or selected remain separate exposure paths.

After a hygiene review, you can also select a finding to review migration, generate an empty environment example, or use existing encrypted recovery. Original files are not opened automatically. A changed source invalidates the earlier review.

### Inspect protection and local checks

Run `SoterAI: Open Control Panel` or select the SoterAI activity-bar icon. The native Protection Center groups protected items, activity and coverage.

Use **Coverage → Verify my setup** to run the available synthetic local component checks. It does not start an AI tool, configure provider routing or certify live traffic. If this window does not own a healthy broker, the broker check remains `NOT_TESTED`.

Saved path and region restrictions use deny-by-default managed policy. Approved ordinary reads return a reviewed safe representation; supported sensitive dotenv reads keep values masked. Unsupported sensitive formats are withheld. Explorer badges describe saved restrictions, not OS-level file access controls.

## Settings and defaults

Open Settings (`Ctrl+,`) and search for `@ext:soterai.soterai-ide-guard`. Most users can start without changing anything.

The extension starts quietly: no automatic walkthrough, migration dialog or per-file popup. Open the SoterAI sidebar to see **Workspace secrets to review**; local editor findings remain available. Use **Open guided setup** when you want onboarding.

The sidebar's **Settings** section links to Notifications, Local scanning, Vault & recovery, Privacy, AI connections and Advanced. Everyday preferences appear first in the native Settings editor. Advanced flags appear later; their existing defaults and administrator scopes are preserved.

Optional secret-discovery notifications default to **off**. Choose **summary** for at most one compact notification per window session. This preference does not suppress explicit migration confirmations or operation errors.

| Setting | Default | Meaning |
| --- | --- | --- |
| `soterai.liveScan.enabled` | `true` | Show local diagnostics for supported content. This is visibility, not universal interception. |
| `soterai.protection.enabled` | `true` | Enable the central protection state; check actual route coverage separately. |
| `soterai.broker.autoStart` | `true` | A trusted workspace can start the bundled local broker. Provider destinations start blank. |
| `soterai.autoVaultMigration.enabled` | `true` | Discover secrets in saved files and show sidebar counts. Changing this setting takes effect immediately. Files change only after selection and confirmation. |
| `soterai.notifications.secretDetection` | `off` | Optional background discovery notifications: `off` or one `summary` per window session. Local scanning and sidebar findings stay active. |
| `soterai.lite.vaultMode` | `true` | Make optional reviewed vault workflows available. |
| `soterai.cloud.enabled` | `false` | Keep the separate optional cloud feature preference off. |
| `soterai.telemetry.redactedEvents` | `off` | Keep optional redacted-event telemetry off. |
| `soterai.showAllCommands` | `false` | Keep advanced commands out of the normal Command Palette. |

To use an advanced command mentioned below, enable **SoterAI: Show All Commands** in user Settings (`soterai.showAllCommands`). An available command still enforces its own requirements and review.

Safety-relevant machine settings cannot be enabled by a repository override. Turning a feature off preserves saved denies, ciphertext and recovery records; it does not restore raw values or erase earlier disclosures. Configured provider traffic is separate from the cloud and telemetry settings.

[Full privacy statement →](https://github.com/yashchauhan66/Soter-AI/blob/main/packages/soterai-lite/PRIVACY.md)

## Supported integrations

Integrations are optional. Installing SoterAI does not automatically route an existing assistant through it, and supported configuration is not the same as a verified live route.

| Tool or surface | Supported approach | Important limit |
| --- | --- | --- |
| Cline | Reviewed pinned package, vendor controls and applicable managed provider/safe-read routes | Default-profile setup only; changed builds and custom data/settings paths are refused |
| Claude Code | Reviewed pinned vendor controls and applicable managed routes | Unrelated native reads and independent processes remain outside the route |
| Codex IDE / Codex CLI / Gemini CLI | Reviewed dedicated or vendor configurations for supported pinned versions | A different version or configuration remains unverified until reviewed |
| PowerShell 5.1 / PowerShell 7 / cmd / Git Bash | Optional SoterAI checked-command profiles | Only the declared bounded command grammar is supported |
| Other extensions, terminals and clients | No automatic interception claim | Treat independent reads and uploads as uncovered |

The managed gateway inspects supported bounded request bodies and encodings before forwarding. Recognition can include split values within one supported request. Unsupported protocols, unknown transformations and splitting data across separate requests remain gaps.

### Configure and verify a route

1. Open the guided setup and review the tool/version compatibility it reports.
2. Choose the supported adapter. Read its proposed configuration and recovery information.
3. Configure only the provider endpoint and credentials that you intend to use. Keep credentials out of project files and issue reports.
4. Accept the reviewed changes, then inspect **Coverage** and its limitations.
5. Verify the actual tool/provider workflow separately before relying on its protection.

The current Coverage view explicitly labels Cline, Claude Code, Codex IDE/CLI and Gemini CLI **Uncovered — live route not verified here**. Local self-checks do not turn those labels into a verified live route.

**Gateway-routed** and **Vendor-controls-only** describe different integration approaches, not automatic passing statuses. An online broker, enabled setting or passing local component check is not a coverage score.

Provider setup keeps its endpoint and masked-key prompts open when focus moves to provider documentation or a password manager. Press Enter to accept an input. Escape cancels the complete form before configuration or credential writes.

### Cline setup notes

The current adapter recognizes the reviewed **4.1.25 and 4.1.26** public package hashes. A changed build or future version remains unavailable. Custom Cline data/settings-path overrides are unsupported; setup refuses before changing the default profile.

Stop active tasks before setup and start a new task afterward. Legacy provider URL overrides can take precedence over the managed route, so setup refuses nonempty or unsupported overrides. Review these in Cline itself: editing a configuration file externally does not refresh Cline's cached state.

**Reload Window withdraws the session.** Review restoration before configuring a fresh session. Repeated setup preserves an unchanged current session and its original encrypted recovery receipt; changed or expired owned configuration requires restoration. An accepted package and applied configuration still need a real current-route check.

### Checked Windows terminals

Show advanced commands, then use the appropriate SoterAI checked profile. For PowerShell 7, `soterai.lite.ps7Terminal` must be enabled; run `SoterAI: Open Checked PowerShell 7`.

The PowerShell 7 profile requires an existing standard installation and was separately tested with **PowerShell 7.6.9 Core on Windows**. It looks for `C:\Program Files\PowerShell\7\pwsh.exe`, then `%LOCALAPPDATA%\Programs\PowerShell\7\pwsh.exe`. It does not download a shell, search PATH or accept a workspace executable. Other major versions and Desktop edition are refused.

Checked profiles use a fresh environment and filtered output. Supported operations include public version/date/location, literal output, bounded directory names, reviewed safe reads and staged Git metadata. Unsupported expansions, interpreters and arbitrary interactive/native commands are refused rather than silently run unchecked.

These profiles are not an intercept layer for your normal terminal. The PowerShell 7 profile uses no shell profiles or interactive command history. Its setup and restore are separate from PowerShell 5.1; **Restore changes before removal** includes both.

## Advanced workflows

Use these only when you need them. Enable `soterai.showAllCommands` to expose their Command Palette entries.

### Private environment editor and vault apps

The optional private environment editor uses its own document model and masks values by default. Per-value reveal, reviewed save and encrypted recovery are explicit owner actions. Opening the original as ordinary text is a separate exposure path.

`SoterAI: Configure Vault App` reviews a supported Node application's source, selected values and dependency snapshot. Approved app/task/lifecycle-debug runs receive only the selected values through a scrubbed child environment. The lifecycle-debug route is not source-level debugging.

Vault apps use a captured CommonJS dependency snapshot. Supported literal relative imports and JSON dependencies are bound to approval; dependency changes require reconfiguration. Existing version 1 approvals cannot launch. Bundle other module formats into the supported contract before review.

The app executes on the host. This is not an OS sandbox, and application code receiving a value can still disclose it. Output filtering does not undo network transmission or previously written logs.

### Source, configuration, history and artifact reviews

Optional local reviews inspect supported source, configuration, Docker/Kubernetes files, Git history, build artifacts and saved logs for possible exposures. They do not execute project configuration or rewrite Git history. Unsupported or capped input stays partial, withheld or unverified.

Treat findings as review candidates, not proof that a credential is valid or has leaked. Rotate an exposed credential with its provider; deleting the local text does not revoke it.

Git hooks and PowerShell history exclusion are separate opt-in workflows. **Pre-commit (F26a) is an opt-in candidate pending native verification.** Its machine setting stays off by default. Install/resume requires owner review; existing owned-hook status and reviewed restore remain accessible. Pre-push and PSReadLine workflows have their own requirements and reviews. Enabling one does not enable all of them or establish release acceptance.

### Run an isolated AI task

Additional requirements: Docker, an already installed compatible Node image pinned by SHA-256 digest, and a working managed OpenAI-compatible provider.

1. Run `SoterAI: Run isolated AI task`.
2. Select saved public files, the installed image and the task/model.
3. Review the file snapshot, image and model before starting.
4. Run `SoterAI: Review isolated AI changes` to inspect proposed content afterward.

The guest planner and tools run with direct networking disabled. Model requests pass through this window's guarded broker. The command does not download an image, apply guest writes to your project or move Cline and other host extensions into the container. Proposed content can be copied only after review.

Cancellation or changed files, policy, credentials or operation configuration withdraws the session. The retained native runner check used a deterministic model callback; it does not establish live-provider or installed-command acceptance.

### Approve a secretless Vault operation

This optional workflow requires an owner-selected HashiCorp Vault server and an administrator who enforces the intended role and access-control policies.

`SoterAI: Configure an approved secretless operation` defines one HTTPS JSON GET, its exact resource, permitted scalar result fields, token role and expected policies. The bootstrap token uses SecretStorage. Each use requires native approval and requests a distinct, short-lived, one-use Vault service token; only checked result fields return to the guest.

Use `SoterAI: Show secretless operation status` to inspect the configuration or `SoterAI: Remove an approved secretless operation` to remove it. Setup alone does not verify a real issuer or its ACLs. The selected server receives the configured request details and controls its own logs and retention.

## Recovery and removal

**Do not delete recovery files to force a failed operation to continue.** Keep the extension installed while an owned restore is pending. Disabling or uninstalling an extension does not guarantee that cleanup code runs.

### Portable encrypted vault recovery

Use `SoterAI: Export encrypted portable vault recovery` to create a separate password-encrypted recovery file containing the vault key and encrypted records. Keep a strong generated recovery password separately. Anyone with both the file and password can recover its included values.

`SoterAI: Import encrypted portable vault recovery` authenticates the reviewed bytes. It requires an empty vault, or the matching interrupted import; it never merges into an existing vault or restores project files automatically. Losing both the original key and the recovery password is unrecoverable.

This portable export is different from the same-profile removal archive below. The removal archive does **not** contain encryption keys.

### Before uninstalling

1. Open each trusted local project where SoterAI has recorded changes.
2. Run `SoterAI: Restore changes before removal`.
3. Review the native summary. Each owned profile, editor association, adapter or hook keeps its own confirmation and recovery checks.
4. Wait for confirmed worker/broker shutdown and successful recovery archiving.
5. Keep the archive and original SecretStorage keys. Only uninstall after pending restoration is resolved.

The command copies recognized current encrypted vault recovery, legacy vault backups and encrypted configuration backups outside the extension storage folder that VS Code deletes. A missing, changed, locked, interrupted or unarchivable store leaves removal incomplete.

Checked terminal/editor settings can be restored after their feature flags are off; recovery does not enable those flags. Missing journals cannot discover unrecorded earlier edits. Cline, Claude and earlier plaintext-capable configuration backups need separate manual recovery review; this command does not decrypt or restore them.

### Recover a same-profile removal archive

This is an advanced recovery procedure. If you cannot verify every condition, preserve the files and request help rather than guessing.

The archive lives under the same editor profile:

```text
User/globalStorage/soterai-recovery/<storage-path-hash>/snapshots/<manifest-sha256>/
```

Its `manifest.json` records the original storage path and each retained file's relative name, byte count and SHA-256. The `files` folder holds encrypted bytes and source-pointer metadata. Archive creation does not export the key, decrypt values or restore originals.

To recover after reinstalling into the **same editor profile**:

1. Keep all existing files. Close every window using that profile.
2. Select the archive from the successful removal review. Verify that its directory name equals the SHA-256 of `manifest.json`.
3. Verify every listed file's byte count and SHA-256.
4. Copy only those listed files, preserving relative paths, into the original `sourceStorage` directory **only when it is absent or empty**. Never merge snapshots, follow directory links or overwrite newly created vault files.
5. Leave the archive intact. Reopen the same project/profile and use the existing owner-reviewed recovery commands if disclosure is needed.

`SoterAI: Restore File From Encrypted Backup` can restore current source-bound generations only after its disclosure review. Older unbound backups remain withheld. The original SecretStorage keys must still exist; vault and configuration backups use separate keys. An archive cannot replace lost keys.

Keep competing snapshots or stale mutation locks for manual recovery review. Direct uninstall without a successful removal review, profile deletion, disk loss and manual archive deletion are outside this preservation guarantee. Uninstall does not erase old copies or restore raw secrets.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| The registry does not show 0.7.0 | Verify the pre-release channel. Ask the maintainer for the current preview VSIX; do not assume an older listing includes it. |
| `code` is not recognized | Use **Extensions: Install from VSIX...** or the Marketplace inside VS Code. |
| An advanced command is missing | Enable `soterai.showAllCommands` in user Settings. Feature availability still depends on its requirements. |
| Setup or vault operations are unavailable | Use one supported local Windows workspace. Check trust; do not trust an unknown repository merely to bypass the restriction. |
| A preview cannot be copied | The source, settings or preview may have changed. Generate a new preview and review it again. |
| A scan is partial or `NOT_TESTED` | Treat the result as incomplete. Check supported formats and size limits rather than treating absence of findings as permission. |
| Cline setup refuses | Check the pinned version/build, default profile and legacy URL overrides. Stop active tasks; use the reviewed restore before a fresh session. |
| Reloading breaks a managed route | Reload withdraws the session. Review restoration and configure a fresh session; verify the route again. |
| PowerShell 7 is unavailable | Check the supported standard installation path and Core edition; no workspace executable or automatic download is used. |
| Restore is incomplete | Keep the extension, keys, journals and archives. Do not merge backups or delete locks. Request sanitized support. |

For additional diagnostics, show advanced commands and run `SoterAI: Check Extension Health` or `SoterAI: Local Privacy Status`.

Report problems through the [issue tracker](https://github.com/yashchauhan66/Soter-AI/issues). Include the extension version, editor/Windows version, exact command, expected behavior and a minimal synthetic reproduction. Review screenshots and logs before attaching them. Never include real tokens, passwords, private keys, vault exports or recovery passwords.

## Security scope and release status

SoterAI reduces accidental exposure through supported managed workflows. It is not an OS boundary against hostile or manipulated processes running as the same user. Other extensions' original buffers, arbitrary native reads, hardlink/junction paths outside checked readers, unmanaged shells, Git-history access outside checked routes and independent uploads can bypass the controls. SecretStorage does not isolate same-user code.

Detection and redaction have format, transformation and size limits. Filtering cannot undo an earlier transmission. Unsupported input, unavailable routes and incomplete evidence must not be presented as protection. The historical unmanaged 17-case baseline included nine confirmed leaks; it is evidence of the unmanaged boundary, not a current product detection rate.

This candidate is not release-ready or independently reviewed. Exact-package installed lifecycle, integrated real-tool/provider checks and required human evidence remain publication requirements. The optional isolated session, real Vault issuer/ACL behavior and new recovery flows each need their own current acceptance evidence. Local synthetic checks do not certify them.

Publication is an owner action after the release gates. Creating a package or improving its documentation does not publish it, validate publisher ownership or complete human/security/accessibility review.

The [Business Source License 1.1](https://github.com/yashchauhan66/Soter-AI/blob/main/packages/soterai-lite/LICENSE.md) applies. The package includes third-party notices (`THIRD-PARTY-NOTICES.md`) and `SBOM.cdx.json`. The inventory is offline metadata, not legal approval or a current vulnerability-advisory result.
