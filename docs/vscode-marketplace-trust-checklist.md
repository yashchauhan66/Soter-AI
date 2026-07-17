# VS Code Marketplace Trust Checklist

Use this checklist before packaging or publishing SoterAI IDE Guard.

## Marketplace Positioning

- Single purpose: local-first AI security for developer workflows.
- Clear promise: scans code, prompts, git diffs, clipboard, MCP/tool config, and terminal commands before sensitive data reaches AI.
- Default privacy mode: `soterai.privacyMode = local`.
- No raw secrets leave the extension by default.

## Manifest Trust Controls

| Control | Expected state |
| --- | --- |
| `capabilities.untrustedWorkspaces.supported` | `limited` |
| Cloud connection in untrusted workspace | disabled |
| Secret vault in untrusted workspace | disabled |
| Local scanning in untrusted workspace | enabled |
| Secret/token storage | VS Code `SecretStorage` |
| Telemetry default | off/redacted only |
| Webviews | CSP required; scripts disabled unless needed |

## User-Facing Privacy Proof

| Command | Proof |
| --- | --- |
| `SoterAI: Local Privacy Status` | Reports privacy mode, telemetry, raw reveal, raw prompt audit, active refs, and confirms no raw sensitive values are included. |
| `SoterAI: Open Privacy Guarantee` | Explains what SoterAI does not receive by default. |
| `SoterAI: Preview What AI Will See` | Shows redacted context before any AI handoff. |
| `SoterAI: Build Safe Prompt for AI` | Converts sensitive context into safe prompt text with scoped secret references. |

## Release Gate

Run before release:

```bash
npm test
npm run lint
npm run package
```

Expected evidence:

- Command registration parity passes.
- Local-first privacy README tests pass.
- Webview CSP and allowlist tests pass.
- Secret broker tests pass.
- VSIX packaging succeeds.

## Reviewer Answer

SoterAI IDE Guard processes sensitive code and prompt content locally by default. Cloud or hybrid modes require explicit configuration in a trusted workspace. Tokens are stored in VS Code `SecretStorage`. Raw secrets, raw prompts, raw file contents, private keys, database URLs, and PII are not included in privacy reports, telemetry, logs, dashboards, or webviews by default.
