# IDE extensions and CLI Guard roadmap

## Shared architecture

VS Code, Cursor, Windsurf-compatible surfaces, JetBrains IDEs, and CLI Guard should share a small protocol package rather than duplicate policy logic. Each integration obtains a signed organization policy bundle, keeps a last-known-good offline cache, submits audit metadata, and renders the same actions: allow, warn, redact, rewrite, block, and approval.

The integration boundary is explicit. Browser extension code does not control native editors. Enterprise installation and non-removal use official Chrome/Edge policy, VS Code extension management, JetBrains administrative tooling, and MDM/software management only.

## VS Code and Cursor-compatible extension

Create `apps/vscode-extension` using official VS Code extension APIs. Cursor compatibility should be validated against the same VSIX rather than assumed.

- Commands scan selection, active editor, clipboard paste into AI chat, and files before an explicit AI-share action.
- A chat participant/tool wrapper scans AI prompts where the host API permits it. Unsupported third-party chat extensions are not silently intercepted.
- Workspace trust and Git metadata classify private repository code without uploading repository contents.
- `.env`, private keys, API keys, config snippets, production logs, customer identifiers, database schemas, and auth/security code receive destination and department-specific actions.
- A terminal command preview warns on destructive or privileged AI-generated commands before the user runs them.
- Diagnostics, CodeActions, notifications, and approval views explain decisions and offer a safe redacted/re-written version.
- The extension communicates with the control plane directly or with the Local Agent over authenticated loopback IPC.

## JetBrains plugin

Create `apps/jetbrains-plugin` in Kotlin using PSI/document and tool-window APIs.

- Actions on selected code and files call the shared scan protocol.
- An AI chat tool window supplied by Soter enforces prompts; integrations with other AI plugins are implemented only through documented extension points.
- Run configurations and terminal command previews surface warnings without covertly modifying IDE execution.
- Project VCS remotes, ignored sensitive files, and project trust contribute metadata-only classification.

## CLI Guard

Create `apps/cli-guard` as an explicit wrapper:

```text
soter guard --destination ollama -- your-agent-command --flags
soter scan --destination openai-compatible < prompt.txt
```

It scans stdin, selected files, command arguments, tool calls where supported, and streamed responses. It refuses recursive proxy loops, never captures unrelated shell history, and returns documented exit codes for allow/warn/block/approval. CI mode is non-interactive and fails according to organization policy.

## Policy scenarios to ship first

- Engineering: block `.env`, API keys, and private keys; approval for private-repository source and auth/security code; redact production logs; block customer data in logs; warn on schemas.
- Support: redact email/phone, rewrite ticket text, block payment information, and warn on internal notes.
- HR/Finance: block salary and bank details, redact employee IDs, and require approval for contracts.

## Verification matrix

Every integration must test clean input, source code, `.env`, secrets, private keys, production stack traces, customer data, offline cached policy, expired policy behavior, strictest-action precedence, device heartbeat, audit privacy, tenant authorization, and a transparent disable/uninstall path.
