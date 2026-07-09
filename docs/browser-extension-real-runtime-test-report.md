# Browser Extension — Real Runtime Test Report

**Package:** @soterai/extension v0.1.1
**Date:** 2026-07-09
**Test environment:** PENDING (requires Chrome host)

## Test Results

### Installation & Loading

| # | Test | Result | Notes |
|---|---|---|---|
| 1 | Extension loads unpacked | ⏳ | |
| 2 | Service worker starts | ⏳ | |
| 3 | No errors in chrome://extensions | ⏳ | |

### Popup

| # | Test | Result | Notes |
|---|---|---|---|
| 4 | Popup opens | ⏳ | |
| 5 | Enrollment form displays | ⏳ | |
| 6 | Status displays when enrolled | ⏳ | |
| 7 | Sync button works | ⏳ | |

### Side Panel

| # | Test | Result | Notes |
|---|---|---|---|
| 8 | Side panel opens | ⏳ | |
| 9 | Scan results display | ⏳ | |
| 10 | Latest findings show | ⏳ | |

### Context Menu

| # | Test | Result | Notes |
|---|---|---|---|
| 11 | Right-click menu appears on AI sites | ⏳ | |
| 12 | "Scan with Soter" works | ⏳ | |
| 13 | Side panel opens after scan | ⏳ | |

### Prompt Interception

| # | Test | Result | Notes |
|---|---|---|---|
| 14 | ChatGPT prompt intercepted | ⏳ | |
| 15 | Claude prompt intercepted | ⏳ | |
| 16 | Gemini prompt intercepted | ⏳ | |
| 17 | Perplexity prompt intercepted | ⏳ | |
| 18 | Generic editor intercepted | ⏳ | |
| 19 | Overlay shows on findings | ⏳ | |
| 20 | Bypass button works | ⏳ | |

### File Upload

| # | Test | Result | Notes |
|---|---|---|---|
| 21 | .env file blocked | ⏳ | |
| 22 | Secret file blocked | ⏳ | |
| 23 | Safe file allowed | ⏳ | |

### Response Scanning

| # | Test | Result | Notes |
|---|---|---|---|
| 24 | AI response annotated | ⏳ | |
| 25 | Risk attribute set | ⏳ | |

### Policy & Enrollment

| # | Test | Result | Notes |
|---|---|---|---|
| 26 | Enrollment with valid code | ⏳ | |
| 27 | Enrollment with invalid code | ⏳ | |
| 28 | Policy sync works | ⏳ | |
| 29 | Policy HMAC verified | ⏳ | |
| 30 | Emergency lockdown | ⏳ | |

### Background

| # | Test | Result | Notes |
|---|---|---|---|
| 31 | Heartbeat sends | ⏳ | |
| 32 | Alarm fires (15 min) | ⏳ | |
| 33 | Audit events sent | ⏳ | |

### Error Handling

| # | Test | Result | Notes |
|---|---|---|---|
| 34 | No console errors | ⏳ | |
| 35 | Invalid API key error | ⏳ | |
| 36 | Rate limit warning | ⏳ | |
| 37 | Offline mode | ⏳ | |

### Multi-Tab & Persistence

| # | Test | Result | Notes |
|---|---|---|---|
| 38 | Multi-tab support | ⏳ | |
| 39 | Restart persistence | ⏳ | |
| 40 | Token survives restart | ⏳ | |

### Security

| # | Test | Result | Notes |
|---|---|---|---|
| 41 | No token in console | ⏳ | |
| 42 | No raw text in storage | ⏳ | |
| 43 | No DOM breakage | ⏳ | |
| 44 | CSP enforced | ⏳ | |

## Summary

| Category | Passed | Failed | Pending |
|---|---|---|---|
| Installation & Loading | 0 | 0 | 3 |
| Popup | 0 | 0 | 4 |
| Side Panel | 0 | 0 | 3 |
| Context Menu | 0 | 0 | 3 |
| Prompt Interception | 0 | 0 | 7 |
| File Upload | 0 | 0 | 3 |
| Response Scanning | 0 | 0 | 2 |
| Policy & Enrollment | 0 | 0 | 5 |
| Background | 0 | 0 | 3 |
| Error Handling | 0 | 0 | 4 |
| Multi-Tab & Persistence | 0 | 0 | 3 |
| Security | 0 | 0 | 4 |
| **Total** | **0** | **0** | **44** |

## Environment

- **OS:** PENDING
- **Chrome version:** PENDING
- **Extension version:** 0.1.1
- **Manifest:** V3

## Sign-off

- [ ] All 44 runtime tests pass
- [ ] No console errors
- [ ] No token leakage
- [ ] No DOM breakage
- [ ] All AI tools work
- [ ] Ready for store submission
