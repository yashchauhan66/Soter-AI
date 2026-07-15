# SoterAI IDE Guard

**Local-first AI security guard for VS Code.** SoterAI IDE Guard scans your code,
selections, terminal commands, git changes, and AI prompts for secrets, PII,
prompt-injection, and insecure AI-generated code — **entirely on your machine**.
Nothing leaves your computer unless you explicitly connect to SoterAI Cloud.

---

![Security Dashboard](https://raw.githubusercontent.com/yashchauhan66/Ai-Security-Guard/main/packages/vscode-extension/media/screenshots/dashboard-overview.png)

![Scan Results](https://raw.githubusercontent.com/yashchauhan66/Ai-Security-Guard/main/packages/vscode-extension/media/screenshots/scan-results.png)

![Command Palette](https://raw.githubusercontent.com/yashchauhan66/Ai-Security-Guard/main/packages/vscode-extension/media/screenshots/command-palette.png)

![Settings Panel](https://raw.githubusercontent.com/yashchauhan66/Ai-Security-Guard/main/packages/vscode-extension/media/screenshots/settings-panel.png)

---

**Demo:** Watch the extension scan a file for secrets and display findings in the Security Dashboard:

![SoterAI IDE Guard Demo](https://raw.githubusercontent.com/yashchauhan66/Ai-Security-Guard/main/packages/vscode-extension/media/screenshots/demo.gif)

---

## Features

- **Scan Current File / Selection / Workspace** — detect leaked secrets, PII, and
  risky patterns with a redacted, evidence-minimized report.
- **Redact Selection for AI** — copy a safe, redacted version of your selection to
  the clipboard before pasting it into an AI assistant. Raw secrets are never
  copied — a fail-closed safety net masks anything the detectors miss.
- **Scan Before AI Prompt** — paste a prompt, scan it locally, and get an
  allow / redact / block verdict plus a safe prompt to copy.
- **Scan Git Changes** — scan your staged + unstaged diff for secrets and flag
  sensitive files (`.env`, `*.pem`, `*.key`, credentials) before you commit.
- **Check Terminal Command** — flag destructive or remote-exec shell commands.
- **Review Selected AI Code** — surface likely vulnerabilities (SQL injection,
  etc.) in AI-generated code in a hardened webview.
- **Configure Policy** — pick local / team / enterprise mode, thresholds, cloud,
  and telemetry level from a QuickPick.
- **Security Dashboard** — risk score, latest findings, and cloud sync status.

Additional v0.2 local controls:

- **Local AI Broker** — authenticated loopback-only OpenAI/Anthropic-compatible routing with request/response scanning, redaction, and canary blocking.
- **AI Safe Mode** — Developer, Strict, and Enterprise protection overlays for SoterAI-routed workflows.
- **AI Memory Inspector** — hashes, decisions, redacted evidence, and file metadata showing what SoterAI brokered or built for AI.

## Privacy & Security

- **Local-first.** All detection and redaction runs locally in the extension host.
- **No raw secrets leave the extension.** `redactedText`, clipboard output, the
  local hash cache, telemetry events, logs, webviews, and exported reports are all
  guaranteed free of raw secret material (canary-tested — see
  `docs/ide-guard-privacy-canary-report.md`).
- **Redacted, opt-in telemetry only.** Off by default; when enabled, only
  minimized, redacted event metadata is queued — never content or tokens.
- **Cloud tokens** are stored in VS Code `SecretStorage`, never logged.

## Workspace Trust

The extension declares **limited** untrusted-workspace support:

| Capability | Trusted workspace | Restricted (untrusted) |
| --- | --- | --- |
| Local scanning & redaction | ✅ | ✅ |
| Cloud connect / token storage | ✅ | 🚫 disabled |
| Remote scan escalation | ✅ | 🚫 disabled |

Local scanning always works; cloud/token/remote features are gated behind a
trusted workspace and surfaced clearly in the dashboard.

## Commands

| Command | Purpose |
| --- | --- |
| `SoterAI: Quick Start` | Choose privacy mode, policy pack, and first scan flow. |
| `SoterAI: Check Extension Health` | Show version, privacy mode, token configured yes/no, workspace trust, policy status, and last scan without secrets. |
| `SoterAI: Open Settings` | Open VS Code settings filtered to SoterAI. |
| `SoterAI: Run Demo Scan` | Run a safe local demo against fake risky text. |
| `SoterAI: Scan Selected Text` | Scan selected prompt/text before sending it to an AI assistant. |
| `SoterAI: Scan Current File` | Scan the active file for secrets, PII, prompt injection, unsafe instructions, and insecure patterns. |
| `SoterAI: Scan Git Diff` | Scan staged and unstaged git changes locally. |
| `SoterAI: Scan MCP / Agent Tools` | Review MCP and agent tool configuration for broad or dangerous permissions. |
| `SoterAI: Review Terminal Command` | Review a command before running it; SoterAI never executes it. |
| `SoterAI: Open AI Activity Ledger` | View privacy-preserving local scan/share metadata. |
| `SoterAI: Generate Canary Token` | Create a fake canary token for leak detection tests. |
| `SoterAI: Choose Policy Pack` | Apply a built-in policy profile. |
| `SoterAI: Open Security Panel` | Open the local security dashboard. |

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

- Detection is defense-in-depth, not a guarantee that every issue will be found.
- MCP and extension risk analysis is heuristic and based on available local metadata/configuration.
- Full cloud telemetry submission is disabled until a reviewed endpoint client is added.
- SoterAI Guard is not a replacement for professional security review, secure SDLC, or incident response.

## Development

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # node --test (static manifest/contract tests)
npm run bundle      # extension + standalone local broker bundles
npm run package     # bundle + vsce package -> .vsix
```

The extension is bundled with **esbuild** into a single `dist/extension.js`
(with `@soterai/guard-core` inlined) so the packaged VSIX stays small and never
follows the symlinked monorepo.

## License

See [LICENSE](./LICENSE) (Business Source License 1.1). © SoterAI.
