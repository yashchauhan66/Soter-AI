# VS Code Extension Final Execution Rules

Readiness score may increase only after real code changes, real tests, real VS Code runtime proof, real VSIX package inspection, real security validation, or real marketplace evidence. Documentation alone cannot increase readiness.

Additional launch rules:

- Do not claim a feature is complete unless implementation, tests, and verification evidence exist.
- Do not store or log raw secrets, API keys, prompts, private file contents, or sensitive scan payloads by default.
- Do not scan outside the active VS Code workspace unless the user explicitly chooses it.
- Respect VS Code Workspace Trust. Untrusted workspaces must not trigger active scanning or network calls.
- Experimental or partially verified features must remain behind feature flags or be marked Labs/Hidden.
- Marketplace claims must be backed by package, test, runtime, security, or documentation evidence.
