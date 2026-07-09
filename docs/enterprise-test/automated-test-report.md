# SoterAI IDE Guard — Automated Test Report

**Date:** 2026-07-07
**Test Runner:** Node.js test runner (`node:test`)
**Test File:** `tests/enterprise/enterprise-suite.test.ts`

---

## Test Results Summary

| # | Category | Tests | Status |
|---|----------|-------|--------|
| 1 | Secret Detection | 5 | PASS |
| 2 | Redaction | 1 | PASS |
| 3 | Safe Mode | 1 | PASS |
| 4 | Protected Workspace | 2 | PASS |
| 5 | Sentinel | 1 | PASS |
| 6 | Permission Center | 1 | PASS |
| 7 | Broker Auth | 2 | PASS |
| 8 | Broker Canary Block | 1 | PASS |
| 9 | MCP Tool Firewall | 3 | PASS |
| 10 | Memory Poisoning Guard | 3 | PASS |
| 11 | Dependency Guard | 3 | PASS |
| 12 | Terminal Firewall | 1 | PASS |
| 13 | Risk Dashboard | 1 | PASS |
| 14 | Policy Packs | 2 | PASS |
| 15 | Privacy No Raw Secret | 2 | PASS |
| 16 | Marketplace Smoke Test | 2 | PASS |

**Total Tests: 31**
**Status: ALL PASS**

---

## Detailed Results

### 1. Secret Detection (5 tests)
- OpenAI API key pattern: PASS
- AWS access key pattern: PASS
- Database URL with credentials: PASS
- GitHub token pattern: PASS
- JWT token pattern: PASS

### 2. Redaction (1 test)
- Sensitive value redaction: PASS

### 3. Safe Mode (1 test)
- Three protection levels exist: PASS

### 4. Protected Workspace (2 tests)
- .env pattern matching: PASS
- Sensitive file pattern matching: PASS

### 5. Sentinel (1 test)
- High-risk file classification: PASS

### 6. Permission Center (1 test)
- Approval scope support: PASS

### 7. Broker Auth (2 tests)
- Minimum token length: PASS
- Weak token rejection: PASS

### 8. Broker Canary Block (1 test)
- Canary detection in request: PASS

### 9. MCP Tool Firewall (3 tests)
- Shell tool classification: PASS
- Secret env key detection: PASS
- Prompt injection detection: PASS

### 10. Memory Poisoning Guard (3 tests)
- Injection pattern detection: PASS
- Invisible unicode detection: PASS
- Suspicious HTML comment detection: PASS

### 11. Dependency Guard (3 tests)
- Curl pipe to shell detection: PASS
- Typosquatting detection: PASS
- Safe package allowlist: PASS

### 12. Terminal Firewall (1 test)
- Dangerous command detection: PASS

### 13. Risk Dashboard (1 test)
- Risk level calculation: PASS

### 14. Policy Packs (2 tests)
- 10 policy packs exist: PASS
- Max-privacy disables cloud: PASS

### 15. Privacy - No Raw Secret (2 tests)
- Redacted output has no canary: PASS
- Ledger has no raw secrets: PASS

### 16. Marketplace Smoke Test (2 tests)
- Extension name correct: PASS
- Required fields present: PASS

---

## Verification Checks

| Check | Status |
|-------|--------|
| No raw canary in test outputs | PASS |
| No command missing in package.json | PASS |
| Typecheck passes | PASS |
| No eval() in new code | PASS |
| No unsafe innerHTML | PASS |
| HTML escaping on all webview content | PASS |
| CSP enforced on webviews | PASS |
| SecretStorage for tokens | PASS |

---

## Existing Tests

All existing tests in `tests/` continue to pass:
- `guard.test.ts` — Core guard functionality
- `security.test.ts` — Security checks
- `phase2.test.ts` through `phase12.test.ts` — Phase tests
- `extension/privacy-*.test.ts` — Privacy tests
- `guard/*.test.ts` — Guard module tests

---

## Verdict

**PASS** — All 31 enterprise tests pass. No raw secrets in outputs. Typecheck clean. Extension compiles successfully.
