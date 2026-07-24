# SoterAI IDE Guard

**Local-first AI security guard for VS Code.** SoterAI IDE Guard scans code,
selections, terminal commands, git changes, and AI prompts for secrets, PII,
prompt injection, and insecure AI-generated code - entirely on your machine.
Nothing leaves your computer unless you explicitly connect to SoterAI Cloud.

## Features

- **Scan Current File / Selection / Workspace** - detect leaked secrets, PII, prompt injection, unsafe instructions, and risky patterns with a redacted report.
- **Redact Selection for AI** - copy a safe version of selected text before using it in an AI assistant. Raw secrets are not copied.
- **Scan Before AI Prompt** - paste a prompt, scan it locally, and get an allow / redact / block verdict plus a safe prompt to copy.
- **Scan Git Changes** - scan staged and unstaged diffs for secrets and sensitive files before commit.
- **Check Terminal Command** - flag destructive, remote-exec, credential-exposing, or suspicious shell commands before you run them.
- **Review Selected AI Code** - surface likely vulnerabilities in AI-generated code inside a hardened webview.
- **Local AI Broker** - authenticated loopback-only OpenAI/Anthropic-compatible routing with request/response scanning, redaction, canary blocking, and **SSE streaming** (`stream: true`) with scan-before-forward output protection.

- **Secret Broker** - replaces raw secrets with scoped `soterai://secret/...` references so AI sees structure and approved operations, not values.
- **AI Safe Mode** - Developer, Strict, and Enterprise protection overlays for SoterAI-routed workflows.
- **AI Memory Inspector** - hashes, decisions, redacted evidence, and file metadata showing what SoterAI brokered or built for AI.
- **Security Dashboard** - risk score, latest findings, privacy mode, policy status, and local secret privacy proof.

## Privacy & Security

- **Local-first by default.** Detection, redaction, policy checks, and secret reference creation run locally in the extension host.
- **No raw secrets leave the extension by default.** Reports, webviews, telemetry, logs, clipboard output, hash caches, broker records, and exported views are designed to avoid raw secret material.
- **Secret broker privacy proof.** `SoterAI: Local Privacy Status`, `SoterAI: Preview What AI Will See`, and `SoterAI: Open Privacy Guarantee` explain what stays local without displaying raw secrets.
- **Redacted, opt-in telemetry only.** Telemetry is off by default. When enabled, it uses minimized event metadata, not raw content or tokens.
- **Cloud tokens stay in VS Code SecretStorage.** Provider and cloud credentials are stored locally through VS Code's secret APIs and are never logged.

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
| `SoterAI: Quick Start` | Choose privacy mode, policy pack, and first scan flow. |
| `SoterAI: Check Extension Health` | Show version, privacy mode, token configured yes/no, workspace trust, policy status, and last scan without secrets. |
| `SoterAI: Local Privacy Status` | Show the local-only privacy proof without raw secrets, prompts, files, or PII. |
| `SoterAI: Open Privacy Guarantee` | Explain exactly what SoterAI does not receive by default. |
| `SoterAI: Preview What AI Will See` | Show the redacted AI context before copying or sending it. |
| `SoterAI: Build Safe Prompt for AI` | Convert sensitive context into a safe prompt with secret references. |
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
| `soterai.dependencyGuard.osvMode` | `ask` | `ask` / `always` / `never` — whether Dependency Guard may query public OSV (`api.osv.dev`) for package name+version advisories. Heuristics always run locally. Advisory only. |
| `soterai.liveScan.enabled` | `true` | Inline VISIBILITY_ONLY diagnostics (regex/heuristic; no ML in the VSIX). |

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
