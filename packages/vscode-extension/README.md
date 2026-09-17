# SoterAI IDE Guard — Safer AI Coding, Local by Default

**Protect secrets, prompts, agent tools, terminal commands, and AI coding context before they become security incidents — in the editor you already use.**

<p>
  <img src="https://img.shields.io/badge/LOCAL--FIRST-Enabled-F96403?style=for-the-badge" alt="Local-first protection" />
  <img src="https://img.shields.io/badge/ACCOUNT-Not_Required-202830?style=for-the-badge" alt="No account required" />
  <img src="https://img.shields.io/badge/API_KEY-Not_Required-202830?style=for-the-badge" alt="No API key required for local scanning" />
  <img src="https://img.shields.io/badge/PRICE-Free-202830?style=for-the-badge" alt="Free extension" />
</p>

Scan locally · Redact sensitive context · Guard supported AI traffic — no account, no cloud, no API key required.

## See it in action

![SoterAI catches a secret before it reaches AI](https://soterai.in/marketplace/screenshots/soterai-secret-caught-before-ai.gif)

*Recorded from the real playground with the real detection engine (synthetic test secret, BLOCK verdict). Regenerate: `node scripts/marketing/generate-readme-gif.mjs`.*

---

## 🚀 Install — Pick Your Editor

**One click, inside your editor.** These links open the extension panel in your editor and install directly. Free, no account.

| Editor | Direct Install | Command line |
| :--- | :--- | :--- |
| **VS Code** | **[Install now →](vscode:extension/soterai.soterai-ide-guard)** | `code --install-extension soterai.soterai-ide-guard` |
| **Cursor** | **[Install now →](cursor:extension/soterai.soterai-ide-guard)** | `cursor --install-extension soterai.soterai-ide-guard` |
| **Windsurf / Devin** | **[Install now →](windsurf:extension/soterai.soterai-ide-guard)** | `windsurf --install-extension soterai.soterai-ide-guard` |
| **Kiro** | **[Install now →](kiro:extension/soterai.soterai-ide-guard)** | `kiro --install-extension soterai.soterai-ide-guard` |
| **Antigravity** | **[Install now →](antigravity:extension/soterai.soterai-ide-guard)** | `antigravity --install-extension soterai.soterai-ide-guard` |
| **VSCodium** | **[Install now →](vscodium:extension/soterai.soterai-ide-guard)** | `codium --install-extension soterai.soterai-ide-guard` |

> **Windsurf rebrand note:** Windsurf is now Devin. If the link above does not open, try the alternative: [devin:extension/soterai.soterai-ide-guard](devin:extension/soterai.soterai-ide-guard)

### Install from inside your editor

Open **Extensions** with `Ctrl+Shift+X` (`Cmd+Shift+X` on macOS), search for
**SoterAI IDE Guard**, and select **Install**. In VS Code, you can also open
Quick Open with `Ctrl+P` / `Cmd+P` and paste:

```text
ext install soterai.soterai-ide-guard
```

> **Install the authentic extension**
>
> **Name:** SoterAI IDE Guard - AI Security & Secret Protection · **Publisher:** `soterai` ·
> **Extension ID:** `soterai.soterai-ide-guard`

### Offline / manual installation

For offline or restricted environments, download the `.vsix` from
[Open VSX](https://open-vsx.org/extension/soterai/soterai-ide-guard) or the
[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=soterai.soterai-ide-guard), then choose
**Extensions → Install from VSIX…**. After installation, select the **SoterAI
Guard shield** in the Activity Bar.

> **Cannot find it in editor search?** Use the direct links above, the
> [Marketplace](https://marketplace.visualstudio.com/items?itemName=soterai.soterai-ide-guard), or
> [Open VSX](https://open-vsx.org/extension/soterai/soterai-ide-guard). Registry search results
> can take time to refresh after a release.

<div align="center">

[Website](https://soterai.in) ·
[Docs](https://soterai.in/vscode-ai-security) ·
[Support](https://soterai.in/support) ·
[Report an issue](https://github.com/yashchauhan66/Soter-AI/issues) ·
[Source](https://github.com/yashchauhan66/Soter-AI)

</div>

## ✅ 60 seconds after install — do these 3 things

Open **SoterAI Guard → Control Panel**:

1. Run `SoterAI: Run Safe Demo Scan` to see a real local verdict using built-in
   test data—without exposing your code.
2. Run `SoterAI: Protect Workspace Secrets` to preview sensitive files and
   replace only approved values with safe local placeholders.
3. Run `SoterAI: Secure Installed AI Tools (One Click)` to review supported AI
   client routing changes. Every approved rewrite gets an encrypted backup
   outside your workspace and can be reversed with
   `SoterAI: Undo AI Tool Security Changes`.

**Local scanning is already enabled when you install.** These first steps need
no account, cloud connection, or provider API key.

## Your AI security posture, in one view

See active controls, request checking, editor warnings, known gaps, and the
current data boundary without leaving your editor.

![SoterAI Control Panel showing five active controls, active request checking, local data boundary, and zero known gaps in the detected workspace state](https://soterai.in/marketplace/screenshots/control-panel-protection.png)

## Know your protection at a glance

| Surface | What SoterAI does | Coverage |
| --- | --- | --- |
| Files, selections, clipboard, and git changes | Scans locally for secrets, PII, prompt injection, and risky code; offers redacted output | **Local detection and redaction** |
| Supported AI requests routed through the local broker | Checks content before forwarding and scans supported responses | **Blocks on the routed path** |
| Protected workspace context built by SoterAI | Excludes protected files before SoterAI builds AI context | **Blocks on the SoterAI-built path** |
| Raw integrated terminal | Detects supported risky commands after shell execution begins and directs you to the checked terminal | **Warns / monitors** |
| Controlled terminal | Allows a bounded set of fixed-argument, read-only commands after pre-execution checks | **Blocks unsupported commands** |
| MCP and agent configuration | Detects broad process execution, remote endpoints, embedded credentials, and risky configuration | **Detection only unless routed through a supported guard** |
| Other extensions’ private network calls | Cannot be intercepted by a VS Code extension API | **Not controlled** |

The Control Panel always shows the current **data boundary**, active controls,
known gaps, and one recommended next action. Green protection labels are reserved
for paths SoterAI technically controls.

## See it inside VS Code

Real extension-host captures using test data only.

### Find a secret without exposing it in the result

![SoterAI reports a secret finding and offers a redacted copy](https://soterai.in/marketplace/screenshots/secret-scan-result.png)

### Check selected context before sharing it with AI

![SoterAI scan-selection result in VS Code](https://soterai.in/marketplace/screenshots/scan-selection-result.png)

### Turn on local request protection

![SoterAI Safe Mode enabled in VS Code](https://soterai.in/marketplace/screenshots/safe-mode-enabled.png)

## Features

- **Control Panel** - one sidebar view with instant-apply toggles for Safe Mode, Protected Workspace, Live Scan, Sentinel, and the MCP firewall, plus Emergency Lockdown. A live **Data boundary** receipt says whether data stays local, cloud actions are available, or optional redacted metadata is enabled. Every coverage badge is resolved from the capability registry — a protection is only labelled `ENFORCED` when it is actually broker-gated, otherwise `MONITORED`.
- **Secure My AI (one click)** - finds the AI tools already installed (Cline, Claude Code, Copilot, Continue, Aider, and generic `.env` / shell profiles) and routes them through the local broker so prompts are scanned before they leave. Every rewritten file is backed up first, encrypted, outside your workspace — and `SoterAI: Undo AI Tool Security Changes` puts every original back in one click.
- **Scan Current File / Selection / Workspace** - detect leaked secrets, PII, prompt injection, unsafe instructions, and risky patterns with a redacted report.
- **Live inline scanning + Quick Fixes** - supported files are scanned as you type; findings appear as native diagnostics with lightbulb fixes (redact in place, copy a safe version of the line, move secrets to the vault).
- **Redact Selection for AI** - copy a safe version of selected text before using it in an AI assistant. Raw secrets are not copied.
- **Scan Before AI Prompt** - paste a prompt, scan it locally, and get an allow / redact / block verdict plus a safe prompt to copy.
- **AI Egress Firewall** - one local choke point for anything you are about to send to an AI tool: `ALLOW` / `REDACT` / `ASK` / `BLOCK`, with a redacted copy offered when secrets are present. Re-runs the detectors over **de-obfuscated** variants (zero-width unicode, homoglyphs, leetspeak, letter-spacing, reversal, base64), so smuggled injection that slips past a single-pass regex still scores. Also destination-aware: content heading to a non-allowlisted host escalates, and secret-bearing content heading to a **vector database** is blocked outright because an embedded leak is durable, not transient.
- **Git pre-commit secret hook** - installs a hook that blocks a commit containing secrets. Refuses to install (with an explanation) when `core.hooksPath` is set by husky/lefthook rather than writing to a directory git ignores, and backs up any existing hook.
- **Screen-share risk check** - warns when files that would expose secrets on a shared screen are open, matching on basename and on credential directories (`.ssh`, `.aws`, `.gnupg`, `.kube`, `.docker`) and key material.
- **Scan Git Changes** - scan staged and unstaged diffs for secrets and sensitive files before commit.
- **Check Terminal Command** - flag destructive, remote-exec, credential-exposing, or suspicious shell commands before you run them.
- **Review Selected AI Code** - surface likely vulnerabilities in AI-generated code inside a hardened webview.
- **Local AI Broker** - authenticated loopback-only OpenAI/Anthropic-compatible routing with request/response scanning, redaction, canary blocking, and **SSE streaming** (`stream: true`) with scan-before-forward output protection.
- **Bounded local protocols** - broker JSON responses and MCP stdio frames are capped at 1 MiB. Oversized MCP frames are discarded through their newline so later valid checks remain synchronized.
- **Secret Broker** - replaces raw secrets with scoped `soterai://secret/...` references so AI sees structure and approved operations, not values.
- **AI Safe Mode** - Developer, Strict, and Enterprise protection overlays for SoterAI-routed workflows.
- **AI Memory Inspector** - hashes, decisions, redacted evidence, and file metadata showing what SoterAI brokered or built for AI.
- **Security Dashboard** - risk score, latest findings, privacy mode, policy status, and local secret privacy proof.

## Privacy & Security

- **Local-first by default.** Detection, redaction, policy checks, and secret reference creation run locally in the extension host.
- **No raw secrets leave the extension by default.** Reports, webviews, telemetry, logs, clipboard output, hash caches, broker records, and exported views are designed to avoid raw secret material.
- **Secret broker privacy proof.** `SoterAI: Local Privacy Status`, `SoterAI: Preview What AI Will See`, and `SoterAI: What Stays Local?` explain what stays local without displaying raw secrets.
- **Redacted, opt-in telemetry only.** Telemetry is off by default. When enabled, it uses minimized event metadata, not raw content or tokens.
- **Opt-out purges pending metadata.** Turning SoterAI telemetry off, returning to local privacy mode, disabling cloud, or disabling editor telemetry immediately clears SoterAI's in-memory telemetry queue.
- **Cloud tokens stay in VS Code SecretStorage.** Provider and cloud credentials are stored locally through VS Code's secret APIs and are never logged.
- **Config backups are encrypted and kept out of your workspace.** When "Secure My AI" rewrites a config, the pre-rewrite copy is encrypted (AES-GCM, key in VS Code SecretStorage) and stored in the extension's global storage — never as a plaintext sibling file that `.gitignore` would miss. If the backup cannot be written, the rewrite does not happen.
- **A repository cannot turn its own protection off.** The 26 safety-relevant settings are `machine`-scoped and declared as restricted in untrusted workspaces, so a checked-in `.vscode/settings.json` cannot disable a guard or repoint the broker at another endpoint.
- **The packaged artifact is inspected, not assumed safe.** Release CI rejects unexpected source, tests, maps, logs, `.env` files, dependencies, duplicate/unsafe archive paths, missing runtime bundles, and oversized archives. It records a SHA-256 and exact entry inventory, then generates a deterministic CycloneDX 1.6 SBOM with a SHA-256 component for every file that actually ships. Integrity evidence and the SBOM are not claimed to be a cryptographic signature.
- **Broker ingress fails closed.** Request bodies are capped, declared oversize is rejected before reading, compressed and ambiguous framing is refused, and malformed UTF-8 is never replacement-decoded into apparently valid JSON.

### What Leaves Your Machine?

| Data | Local mode default | Cloud/hybrid with explicit setup |
| --- | --- | --- |
| Raw API keys, tokens, private keys, `.env` values | Never sent | Never sent by default; secret broker uses scoped references |
| Raw file contents and prompts | Never sent | Redacted/minimized checks only unless you explicitly enable a trusted cloud feature |
| Telemetry | Off | Redacted metadata only, controlled by `soterai.telemetry.redactedEvents` |
| Vaulted secrets | Stored locally through VS Code `SecretStorage` / encrypted vault | Not uploaded by SoterAI IDE Guard |
| AI context | Redacted text, hashes, metadata, and secret references | Same local-first contract unless a trusted cloud feature is explicitly configured |

Use `SoterAI: Local Privacy Status` anytime to show a user-safe report that contains no API keys, prompts, secrets, raw files, private keys, database URLs, or PII.

## Workspace Trust

The extension declares **limited** untrusted-workspace support:

| Capability | Trusted workspace | Restricted workspace |
| --- | --- | --- |
| Local scanning and redaction | yes | yes |
| Cloud connect / token storage | yes | disabled |
| Remote scan escalation | yes | disabled |

Local scanning always works. Cloud, token, and remote features are gated behind a trusted workspace and surfaced clearly in the dashboard.

## Commands

| Command | Purpose |
| --- | --- |
| `SoterAI: Open Control Panel` | The single screen: every protection toggle, honest coverage badges, and Emergency Lockdown. |
| `SoterAI: Quick Start` | Choose a value-first next step: demo scan, workspace secret protection, AI-tool routing, or the local privacy promise. |
| `SoterAI: Check Extension Health` | Show version, privacy mode, token configured yes/no, workspace trust, policy status, and last scan without secrets. |
| `SoterAI: Local Privacy Status` | Show the local-only privacy proof without raw secrets, prompts, files, or PII. |
| `SoterAI: What Stays Local?` | Explain exactly what SoterAI does not receive by default. |
| `SoterAI: Preview What AI Will See` | Show the redacted AI context before copying or sending it. |
| `SoterAI: Build Safe Prompt for AI` | Convert sensitive context into a safe prompt with secret references. |
| `SoterAI: Open Settings` | Open VS Code settings filtered to SoterAI. |
| `SoterAI: Run Safe Demo Scan` | Run a safe local demo against fake risky text. |
| `SoterAI: Scan Selection` | Scan selected prompt/text before sending it to an AI assistant. |
| `SoterAI: Scan Before Sending to AI` | Run the egress firewall over the selection (or clipboard) and get an allow / redact / ask / block decision before you paste into any AI chat. |
| `SoterAI: Scan Current File` | Scan the active file for secrets, PII, prompt injection, unsafe instructions, and insecure patterns. |
| `SoterAI: Scan Git Changes` | Scan staged and unstaged git changes locally. |
| `SoterAI: Scan MCP Configs` | Review MCP and agent tool configuration for broad or dangerous permissions. |
| `SoterAI: Check Terminal Command` | Review a command before running it; SoterAI never executes it. |
| `SoterAI: Install Git Pre-Commit Secret Hook` | Block commits containing secrets. Refuses (and explains) when husky/lefthook owns `core.hooksPath`. |
| `SoterAI: Check Screen-Share Risk` | Warn about open files that would expose secrets on a shared screen. |
| `SoterAI: Open Report` | One list of every local report — coverage, what AI saw, agent tool permissions, risk score — with a one-line description each. |
| `SoterAI: Open AI Access Ledger` | View privacy-preserving local scan/share metadata. |
| `SoterAI: Generate Local Canary Secret` | Create a fake canary token for leak detection tests. |
| `SoterAI: Apply Policy Pack` | Apply a built-in policy profile. |
| `SoterAI: Emergency Lockdown (Revoke All Capabilities)` | Revoke everything at once; `SoterAI: Unlock Protection After Lockdown` reverses it, and the panel offers it as the primary action while locked. |

The palette shows the core workflows by default. Older command names still work —
they stay registered for keybindings, tasks and other extensions — but they no
longer occupy a second palette row next to the command they forward to, and the
individual report commands are now listed inside `SoterAI: Open Report`. Enable
`soterai.showAllCommands` to see the full advanced surface.

## Where SoterAI appears while you work

You do not have to remember to open the Command Palette. The checks are on the
surfaces where the risk actually happens:

| Where | What you get |
| --- | --- |
| Right-click a selection in the editor → **SoterAI** | Scan Selection, Scan Before Sending to AI, Redact Selection for AI, Review Selected AI Code |
| Right-click a file in the Explorer → **SoterAI** | Scan File, Add File to Protected List |
| Source Control view toolbar | Scan Git Changes before you commit |
| SoterAI Guard sidebar toolbars | Scan Workspace Risk, Open Settings, Getting Started |
| `Ctrl+Alt+V` / `Cmd+Alt+V` | Safe Paste — scans the clipboard, then pastes the safe version |
| `Ctrl+Alt+S` / `Cmd+Alt+S` | Scan Before Sending to AI — checks the selection, or the clipboard if nothing is selected |

Both keybindings only apply while an editor has focus, so they never shadow a
shortcut you use elsewhere in VS Code.

## Your AI agent can ask SoterAI before it acts

SoterAI contributes three tools an AI agent can call, so the check happens inside
the agent's own loop instead of in a sidebar the agent cannot see:

| Tool | What it answers |
| --- | --- |
| `soterai_scan_text` | Does this text contain secrets, prompt injection or a jailbreak attempt? Returns a redacted copy when it holds a secret. |
| `soterai_check_command` | Is this shell command destructive or credential-stealing? |
| `soterai_check_dependency` | Is this package a typosquat, unpinned, or installed by piping a download into a shell? |

In VS Code chat and Copilot agent mode they appear as tools automatically. Other
MCP clients get the same three from a bundled MCP server, which VS Code offers to
agent mode without you editing any config.

**These tools are advisory.** They answer questions an agent chooses to ask.
SoterAI cannot force an agent to ask, and no extension API lets it intercept what
an agent does on its own — so every result states that limit in full rather than
implying the action was blocked.

They need a recent editor. SoterAI keeps its VS Code `^1.85.0` floor so Cursor,
Windsurf, Kiro and Antigravity stay supported, and on a host without the language
model tool API it registers nothing instead of pretending.
`SoterAI: Show Runtime Capability Summary` reports which surfaces are live on the
editor you are actually using.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `soterai.privacyMode` | `local` | `local`, `cloud`, or `hybrid`. Local mode uses local detectors only. |
| `soterai.cloud.enabled` | `false` | Enables configured cloud features in trusted workspaces only. |
| `soterai.cloud.baseUrl` | `https://api.soterai.in` | Cloud API base URL. |
| `soterai.policy.mode` | `local` | Local/team/enterprise policy mode. |
| `soterai.scan.remoteEscalation` | `never` | Remote escalation mode for redacted/minimized high-risk scans. |
| `soterai.scan.maxFileSizeKb` | `256` | Maximum file size for local scans. |
| `soterai.scan.maxWorkspaceFiles` | `1000` | Maximum files checked during workspace scans. |
| `soterai.scan.excludeGlobs` | common build/binary folders | Patterns excluded from workspace scans. |
| `soterai.dependencyGuard.osvMode` | `ask` | `ask` / `always` / `never` — whether Dependency Guard may query public OSV (`api.osv.dev`) for package name+version advisories. Heuristics always run locally. Advisory only. |
| `soterai.liveScan.enabled` | `true` | Inline VISIBILITY_ONLY diagnostics (regex/heuristic; no ML in the VSIX). |
| `soterai.protection.enabled` | `true` | Master switch for the central protection state. |
| `soterai.sentinel.enabled` | `false` | AI activity sentinel; `soterai.sentinel.retentionDays` bounds local retention. |
| `soterai.mcpFirewall.strictMode` | `false` | Stricter verdicts for MCP / agent tool configuration. |
| `soterai.broker.port` | `47321` | Loopback port for the local AI broker. |

Settings that can disable a protection or change where your data goes are
**machine-scoped**: they are read from your user/machine settings only, and a
value set in a repository's `.vscode/settings.json` is ignored. Scan budgets
(`maxFileSizeKb`, `maxWorkspaceFiles`, `excludeGlobs`) and palette visibility
stay workspace-configurable, because none of them can weaken a guard.

## Supported Files


SoterAI focuses on developer text formats: JavaScript, TypeScript, Python,
Markdown, MDX, text, JSON, YAML, `.env`-style files, MCP configuration, and
agent prompt/config files. Binary files and oversized files are skipped.

## API Key Setup

Cloud and broker provider tokens are stored with VS Code `SecretStorage`. Use
`SoterAI: Connect to SoterAI Cloud` or the broker configuration commands only
in trusted workspaces. Local privacy mode does not require an API key and does
not make network calls.

## Troubleshooting

- If commands do not appear, run `SoterAI: Quick Start` from the Command Palette.
- If a file is skipped, check `soterai.scan.maxFileSizeKb` and exclude globs.
- If cloud setup is disabled, verify VS Code Workspace Trust is enabled.
- If the VSIX was installed manually, reload VS Code after installation.

## Known Limitations

- Detection is defense-in-depth, not a guarantee that every issue will be found. Detectors are **regex/heuristic** in the packaged extension — no ONNX/ML model ships in the VSIX.
- **Live scan** is `VISIBILITY_ONLY`: squiggly diagnostics after content exists; it does not block send-to-AI or other extensions.
- **Terminal review** is `DETECTION_ONLY` unless you use the broker **controlled terminal** allowlist route (`STRONG_ENFORCEMENT` for fixed-argv read-only commands only).
- **MCP and extension risk analysis** is config/metadata heuristic (`DETECTION_ONLY`). The MCP gateway engine exists in guard-core but is **not wired** into the packaged extension (`UNKNOWN_NOT_TESTED` until routed).
- **DepGuard** is `DETECTION_ONLY`: local heuristics always; optional online OSV advisory lookup (`soterai.dependencyGuard.osvMode`) with explicit consent. Not a full SCA product; cannot block installs outside SoterAI-reviewed commands.
- **Broker streaming** is `STRONG_ENFORCEMENT` only for traffic routed through the loopback broker. Partial tokens already flushed before a late block cannot be recalled (honest residual risk).

- Full cloud telemetry submission is disabled until a reviewed endpoint client is added.
- SoterAI Guard is not a replacement for professional security review, secure SDLC, or incident response.
- Universal claims (full terminal/MCP/network enforcement for arbitrary agents) are **UNSUPPORTED** without an OS-level broker/sandbox.


## Development

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # node --test static manifest/contract tests
npm run bundle      # extension + standalone local broker bundles
npm run package     # bundle + vsce package -> .vsix
```

The extension is bundled with esbuild into a single `dist/extension.js`
(with `@soterai/guard-core` inlined) so the packaged VSIX stays small and never
follows the symlinked monorepo.

## License

See [LICENSE](./LICENSE) (Business Source License 1.1). Copyright SoterAI.
