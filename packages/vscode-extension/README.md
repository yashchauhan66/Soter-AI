# SoterAI IDE Guard

**Local-first AI security guard for VS Code.** SoterAI IDE Guard scans your code,
selections, terminal commands, git changes, and AI prompts for secrets, PII,
prompt-injection, and insecure AI-generated code — **entirely on your machine**.
Nothing leaves your computer unless you explicitly connect to SoterAI Cloud.

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

`SoterAI: Scan Current File`, `Scan Selection`, `Scan Workspace Risk`,
`Redact Selection for AI`, `Scan Before AI Prompt`, `Scan Git Changes`,
`Check Terminal Command`, `Review Selected AI Code`, `Configure Policy`,
`Open Security Panel`, `Connect to / Disconnect Cloud`, `Export Local Risk Report`.

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
