# SoterAI IDE Guard — Marketplace Readiness Report

**Date:** 2026-07-07
**Extension:** SoterAI IDE Guard v0.2.0
**Publisher:** soterai

---

## Marketplace Copy

### Headline
**SoterAI IDE Guard — Enterprise AI Coding Security for VS Code**

### Short Description
Protect secrets, prompts, MCP tools, terminal commands, and AI coding context locally before they reach AI. Enterprise-grade AI security with local-first architecture.

### Features
- **Secret Detection & Redaction** — Detects API keys, tokens, credentials, and sensitive data in code and prompts
- **AI Safe Mode** — Blocks risky AI operations with three protection levels
- **Local AI Broker** — Routes AI traffic through local inspection on 127.0.0.1
- **AI Context Firewall** — Gates and audits what AI tools can see
- **Protected Workspace Mode** — Auto-protects .env, .pem, credentials, and sensitive files
- **AI Activity Sentinel** — Background monitor for high-risk file changes and AI activity
- **AI Permission Center** — Granular control over what AI can access
- **MCP Tool Firewall** — Scans, classifies, and controls MCP tool permissions
- **Memory Poisoning Guard** — Detects prompt injection in repo instruction files
- **AI Dependency Guard** — Checks AI-suggested packages for typosquatting and risk
- **Enterprise Risk Dashboard** — Unified risk view with explainable scores
- **10 Policy Packs** — Pre-built configs for Personal, Startup, Enterprise, Finance, Healthcare, and more
- **Canary Leak Detection** — Plants fake secrets and detects if AI outputs them
- **Terminal Firewall** — Checks terminal commands for exfiltration and dangerous patterns
- **AI Memory Inspector** — Shows what AI tools accessed during sessions
- **Extension Risk Scanner** — Heuristic risk analysis of installed VS Code extensions

### Limitations (Honest)
- SoterAI cannot block other VS Code extensions from reading files they already have access to
- SoterAI fully enforces protection only for traffic routed through the Local AI Broker
- AI Context Firewall controls what SoterAI-built context includes, not what other extensions read
- No extension can claim 100% security — SoterAI provides defense-in-depth
- Cloud features require explicit opt-in; all scanning works fully offline by default

### Install Guide
1. Install from VS Code Marketplace
2. Open a workspace
3. Run `SoterAI: Enable Protected Workspace Mode` for one-click hardening
4. Run `SoterAI: Start Local AI Broker` for AI traffic inspection
5. Run `SoterAI: Open Enterprise Risk Dashboard` to see your risk posture

### Tags
ai-security, ai-coding, prompt-injection, secret-scanning, mcp-security, cursor, copilot, claude, local-ai, data-leakage, vscode-security, developer-security, ai-agent-security, ai-safe-mode, enterprise-security, ai-activity-sentinel, protected-workspace, mcp-firewall, dependency-guard, policy-packs, risk-dashboard

---

## Technical Checklist

| Check | Status |
|-------|--------|
| package.json valid | PASS |
| All commands registered | PASS |
| All webviews use CSP | PASS |
| HTML escaping on all content | PASS |
| No eval() in new code | PASS |
| No raw secrets in output | PASS |
| Tokens in SecretStorage | PASS |
| Broker loopback-only | PASS |
| Fail-closed on errors | PASS |
| Typecheck passes | PASS |
| No false security claims | PASS |
| Limitations documented | PASS |
| Privacy audit passes | PASS |
| Performance targets met | PASS |

---

## Release Readiness

| Item | Status |
|------|--------|
| Extension compiles | PASS |
| All commands visible | PASS |
| All features working | PASS |
| Privacy audit passed | PASS |
| Performance targets met | PASS |
| No P0/P1 bugs | PASS |
| Docs updated | PASS |
| Limitations honest | PASS |

**MARKETPLACE READINESS: PASS**
