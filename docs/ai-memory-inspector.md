# AI Memory Inspector

The AI Memory Inspector answers “what did SoterAI route, scan, redact, or block?” It is an audit view, not a claim that SoterAI can observe every AI extension.

It records session identifiers, timestamps, source labels, file paths, decisions, risk categories, request/response hashes, model/provider labels, approximate content size, approval events, protected-file attempts, and canary exposure. It does not store raw prompts, responses, source content, or secrets.

Sources include broker traffic, Safe Context Builder, scan-before-prompt, manual output scans, git scans, terminal checks, and MCP scans. The current extension records broker events and Safe Context Builder events; the schema supports the remaining sources as integrations use it.

Commands:

- Open, start, end, or clear an AI Memory session
- Export a redacted AI Memory report
- Show What AI Saw or only blocked context
- Compare an AI response with protected context

The Inspector webview uses a restrictive CSP, disables scripts, escapes dynamic fields, and receives no token/provider key. Exports pass through the redactor again.

The MVP store is process-local and clears when the broker restarts. Durable encrypted history is future work. The existing extension ledger remains the durable workspace audit for extension-native context actions.
