# SoterAI IDE Guard — Privacy & Security Audit

**Date:** 2026-07-07
**Auditor:** SoterAI Security Architecture
**Scope:** VS Code Extension, Local AI Broker, Enterprise Features

---

## Audit Scope

Search all outputs for raw sensitive data:
- Logs
- Reports
- Memory exports
- Ledger entries
- Broker events
- Dashboard data
- Temp files
- VSIX bundle
- Webview HTML

---

## Searched Patterns

| Pattern | Category | Found in Outputs | Status |
|---------|----------|-----------------|--------|
| `sk-test-soter-canary` | OpenAI Key | No | PASS |
| `AKIAIOSFODNN7EXAMPLE` | AWS Key | No | PASS |
| `postgresql://user:password` | Database URL | No | PASS |
| `ghp_soterai` | GitHub Token | No | PASS |
| `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9` | JWT Token | No | PASS |
| `Bearer <token>` | Broker Token | No | PASS |

---

## Security Checks

### 1. No Raw Secret in Webview
| Check | Status |
|-------|--------|
| DashboardPanel uses escapeHtml() on all data | PASS |
| No raw secrets in webview HTML | PASS |
| CSP enforced (`default-src 'none'`) | PASS |
| `enableScripts: false` on info webviews | PASS |
| Nonce-based CSP on dashboard | PASS |

### 2. No Token in Logs
| Check | Status |
|-------|--------|
| Broker token stored in SecretStorage | PASS |
| Broker token never logged | PASS |
| Broker token never shown in webview | PASS |
| Broker token never in exported reports | PASS |
| Provider API key in SecretStorage only | PASS |

### 3. No Unsafe CORS
| Check | Status |
|-------|--------|
| Broker binds to 127.0.0.1 only | PASS |
| Broker rejects browser origins | PASS |
| CORS disabled by default | PASS |

### 4. Protected Endpoints Auth Required
| Check | Status |
|-------|--------|
| /health endpoint public | PASS |
| /version requires bearer token | PASS |
| /v1/* endpoints require bearer token | PASS |
| /v1/ai/* endpoints require bearer token | PASS |
| Wrong token returns 401 | PASS |

### 5. No eval() in New Code
| Check | Status |
|-------|--------|
| No eval() calls in sentinel/* | PASS |
| No eval() calls in permissions/* | PASS |
| No eval() calls in workspace-guard/* | PASS |
| No eval() calls in mcp-firewall/* | PASS |
| No eval() calls in memory-guard/* | PASS |
| No eval() calls in dep-guard/* | PASS |
| No eval() calls in policy-packs/* | PASS |
| No eval() calls in enterprise/* | PASS |

### 6. No Unsafe innerHTML
| Check | Status |
|-------|--------|
| All webview HTML built with escapeHtml() | PASS |
| No string interpolation of user data into script tags | PASS |
| Webview HTML uses template literals with escaped values | PASS |

### 7. CSP Enforcement
| Check | Status |
|-------|--------|
| `default-src 'none'` on all webviews | PASS |
| Script-src uses nonce | PASS |
| No remote resource loading | PASS |
| style-src 'unsafe-inline' only (safe) | PASS |

### 8. Sensitive File Protection
| Check | Status |
|-------|--------|
| .env files auto-detected | PASS |
| .pem files auto-detected | PASS |
| id_rsa files auto-detected | PASS |
| .npmrc files auto-detected | PASS |
| .aws/credentials auto-detected | PASS |
| Repo instruction files detected | PASS |

### 9. Data Storage
| Check | Status |
|-------|--------|
| Tokens in SecretStorage (encrypted) | PASS |
| Events in globalState (local) | PASS |
| No cloud transmission by default | PASS |
| Ledger entries contain only redacted data | PASS |
| Reports contain only redacted data | PASS |

### 10. Fail-Closed Behavior
| Check | Status |
|-------|--------|
| Unknown command returns 404 | PASS |
| Invalid token returns 401 | PASS |
| Oversized body returns 413 | PASS |
| Rate limit exceeded returns 429 | PASS |
| Unsafe response blocked (422) | PASS |
| Streaming not supported (fail-closed) | PASS |

---

## Code Review Findings

### No Issues Found
- All new modules use consistent escapeHtml() pattern
- All webview content is CSP-hardened
- No secrets stored in plain text
- No tokens exposed in any output
- All user input is validated
- All file access uses VS Code API (sandboxed)

### Recommendations
1. Consider adding rate limiting to Sentinel event recording
2. Consider adding event compression for long-running sessions
3. Consider adding export encryption for sensitive reports

---

## Verdict

**PASS** — No raw secrets found in any output. All security checks pass. CSP enforced. Tokens protected. Fail-closed behavior confirmed.
