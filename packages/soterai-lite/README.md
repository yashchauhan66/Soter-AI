# SoterAI Secret Guard

**Check secrets before your next AI prompt.**

## [Install in VS Code →](https://marketplace.visualstudio.com/items?itemName=soterai.soterai-ide-guard)

## [Download from Open VSX →](https://open-vsx.org/extension/soterai/soterai-ide-guard)

## Open VSX IDEs: [Antigravity](https://soterai.in/extensions/ide?editor=antigravity#editors) · [Kiro](https://soterai.in/extensions/ide?editor=kiro#editors) · [Windsurf](https://soterai.in/extensions/ide?editor=windsurf#editors) · [VSCodium](https://soterai.in/extensions/ide?editor=vscodium#editors)

Manual VSIX installation: **[Cursor](https://soterai.in/extensions/ide?editor=cursor#editors)** and **[other compatible desktop editors](https://soterai.in/extensions/ide?editor=other#editors)**, where supported.

**[Choose your IDE on SoterAI →](https://soterai.in/extensions/ide)**

**0.7.1 preview · Windows x64 · VS Code 1.85 or later**

Local scanning and reviewed copy need **no SoterAI account or AI provider key**. Install separately in each editor you use.

---

Scan code and logs for recognized secrets. Review redacted context before sharing with AI. Use an optional encrypted vault to keep approved values recoverable.

[Quick start](#quick-start) · [Installation](#install) · [User guide](https://github.com/yashchauhan66/Soter-AI/blob/main/packages/soterai-lite/USER-GUIDE.md) · [Privacy](https://github.com/yashchauhan66/Soter-AI/blob/main/packages/soterai-lite/PRIVACY.md)

## What you can do

| Your next task | Start with SoterAI |
| --- | --- |
| Check code before sharing it | Scan the current file and review findings for recognized credentials and supported sensitive patterns. |
| Ask AI about an error | Prepare reviewed code, environment or debug context with recognized secrets redacted. |
| Review project credentials | Inspect selected files and approve optional vault migration with encrypted recovery. |
| Understand your setup | Open the workspace dashboard for local controls, settings, broker status and coverage. |

## Quick start

1. **Open a local Windows project.** Use a test folder and synthetic values for your first check. Trust a workspace only if you trust its contents.
2. **Open the dashboard.** Press `Ctrl+Shift+P` and run `SoterAI: Open Control Panel`.
3. **Try a scan.** Run `SoterAI: Run Safe Demo Scan`, or use `SoterAI: Scan Current File` on the file you have open.
4. **Review before copying.** On a finding, open the lightbulb and choose **Preview sanitized lines before copying**. Inspect the preview, then choose **Copy reviewed text** when it is suitable to share.

You can scan and prepare reviewed context without configuring an AI provider. Preparing or copying context leaves the source file unchanged; you choose where to paste it.

### Keep the useful context. Review the sensitive parts.

An illustrative example using a **documentation-only password**:

**Before review**

```text
DB_PASSWORD="BlueMango7!"
Error: database connection refused (ECONNREFUSED).
```

**Reviewed context**

```text
DB_PASSWORD="[REDACTED]"
Error: database connection refused (ECONNREFUSED).
```

Marker text can vary. Check the names, paths and private business information that remains. Editing the source or preview requires a fresh review.

## Your workspace dashboard

The Control Panel brings four useful views together:

- **Overview:** local controls, warnings, broker status and your next action.
- **Controls:** what each control does and whether it is available.
- **Settings:** scanning, notifications, vault, privacy and AI connections.
- **Coverage:** managed routes and checks still needing verification.

The Protection Center retains saved restrictions, activity and detailed coverage. Status reflects observed setup; verify your assistant's actual route separately.

## Optional encrypted vault

Vault migration starts with a **file-specific review**. Approved values become placeholders, with encrypted recovery outside the normal workspace. A names-only environment example is created or retained; existing examples are preserved.

**Migration changes the file on disk.** Applications reading it receive placeholders. Review how your app loads secrets first; the documented **Vault App** workflow has specific CommonJS and dependency requirements.

Cancellation preserves the source. Raw-value restoration needs a separate disclosure review. Keep encrypted records and the profile's SecretStorage key until recovery is verified.

[Vault, application loading and recovery →](https://github.com/yashchauhan66/Soter-AI/blob/main/packages/soterai-lite/USER-GUIDE.md#advanced-workflows)

## AI connections and coverage

Local scans and reviewed copy work without AI accounts. Optional adapters and the local broker support **version-specific configurations** for tools such as Cline, Claude Code, Codex and Gemini. Verify the route you use.

| Workflow | Current scope |
| --- | --- |
| Local scans and reviewed context | Check recognized secrets without provider setup. |
| Managed gateway | Checks supported bounded requests and outputs actually routed through it. |

**Coverage currently marks live AI-tool routes as Uncovered.** Setup and broker self-tests do not prove assistant coverage. Cached tasks, native tools and direct provider traffic can remain outside verified controls.

Advanced workflows include checked Windows shells, Git/history reviews, isolated Docker tasks and portable vault recovery. Cloud connection and policy sync are unavailable in this preview.

[Supported integrations and their requirements →](https://github.com/yashchauhan66/Soter-AI/blob/main/packages/soterai-lite/USER-GUIDE.md#supported-integrations)

## Install

**Store name:** SoterAI Secret Guard · **Publisher:** `soterai` · **Extension ID:** `soterai.soterai-ide-guard`

This README describes the **0.7.1 Windows x64 preview**, also known in source as SoterAI Lite. Registry links may serve an older version until this candidate is published. Use a maintainer-provided VSIX when the required preview is unavailable.

### VS Code

Open the [Marketplace listing](https://marketplace.visualstudio.com/items?itemName=soterai.soterai-ide-guard), choose **Install Pre-Release** when available, and finish installation in VS Code.

Optional terminal shortcut:

```sh
code --install-extension soterai.soterai-ide-guard --pre-release
```

### Antigravity, Kiro, Windsurf, VSCodium and Cursor

[Open the SoterAI IDE installation page](https://soterai.in/extensions/ide#editors), choose your editor and follow its steps. In Antigravity, use the editor window. For Kiro, use the desktop IDE.

### Install a VSIX manually

1. Open [SoterAI on Open VSX](https://open-vsx.org/extension/soterai/soterai-ide-guard). Choose the required version and **Windows x64 / `win32-x64`** where offered, then **Download**.
2. In your chosen IDE, press `Ctrl+Shift+P` and run **Extensions: Install from VSIX…**. Select the saved `.vsix` file without unzipping it.
3. Reload if prompted, check the installed version in Extensions and follow [Quick start](#quick-start).

No repository clone or Node.js setup is required. Installation does not verify every editor version or protect its built-in AI assistant. Linux, macOS, remote and virtual workspaces are outside this preview's tested scope.

[Installation, updates and troubleshooting →](https://github.com/yashchauhan66/Soter-AI/blob/main/packages/soterai-lite/USER-GUIDE.md#installation-and-updates)

## Privacy and scope

- Scanning runs locally by default. Unknown secrets and unmarked private information can remain; review output before sharing.
- Configured provider requests can reach your provider. Cloud and telemetry preferences do not disable that route.
- Original buffers, unmanaged terminals, other extensions and independent uploads remain outside these controls.
- Encrypted storage does not create an OS boundary against same-user software. Redaction cannot undo an earlier disclosure.

[Privacy and data handling](https://github.com/yashchauhan66/Soter-AI/blob/main/packages/soterai-lite/PRIVACY.md) · [Recovery and removal](https://github.com/yashchauhan66/Soter-AI/blob/main/packages/soterai-lite/USER-GUIDE.md#recovery-and-removal)

## Documentation and support

[Changelog](https://github.com/yashchauhan66/Soter-AI/blob/main/packages/soterai-lite/CHANGELOG.md) · [Report an issue](https://github.com/yashchauhan66/Soter-AI/issues) · [Product overview](https://soterai.in/vscode-ai-security)

For support, include your IDE name and version, SoterAI version, and sanitized reproduction steps. Omit secrets.

**Preview status:** this candidate is not release-ready or independently reviewed. Real-provider routes, broader platforms, release provenance and required human acceptance remain publication gates. Local checks do not establish enterprise certification or universal protection.

Free local use is subject to the [Business Source License 1.1](https://github.com/yashchauhan66/Soter-AI/blob/main/packages/soterai-lite/LICENSE.md), which is not an OSI-approved open-source license. The VSIX includes `THIRD-PARTY-NOTICES.md` and an offline software inventory (`SBOM.cdx.json`).
