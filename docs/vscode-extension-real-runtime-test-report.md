# VS Code Extension — Real Runtime Test Report

**Package:** soterai-ide-guard v0.1.0
**Date:** 2026-07-09
**Test environment:** PENDING (requires VS Code host)  
**Release evidence:** EVIDENCE REQUIRED; no real-host pass is claimed by this report.

## Test Results

### Activation & Loading

| # | Test | Result | Notes |
|---|---|---|---|
| 1 | Extension activates on `.soterai-policy.json` | ⏳ | |
| 2 | Extension activates on any workspace | ⏳ | |
| 3 | Activation time <500ms | ⏳ | |
| 4 | No activation errors in output panel | ⏳ | |

### Command Palette

| # | Test | Result | Notes |
|---|---|---|---|
| 5 | All 100 commands appear in Command Palette | ⏳ | |
| 6 | Commands are categorized correctly | ⏳ | |
| 7 | No duplicate commands | ⏳ | |

### UI Components

| # | Test | Result | Notes |
|---|---|---|---|
| 8 | Activity Bar icon visible | ⏳ | |
| 9 | 3 Tree Views render in sidebar | ⏳ | |
| 10 | Status bar items appear (5+) | ⏳ | |
| 11 | Dashboard webview opens | ⏳ | |
| 12 | Enterprise dashboard opens | ⏳ | |

### Core Scanning

| # | Test | Result | Notes |
|---|---|---|---|
| 13 | Scan current file | ⏳ | |
| 14 | Scan selection | ⏳ | |
| 15 | Scan workspace risk | ⏳ | |
| 16 | Scan before AI prompt | ⏳ | |
| 17 | Redact selection for AI | ⏳ | |
| 18 | Check terminal command | ⏳ | |
| 19 | Scan git changes | ⏳ | |

### Security Features

| # | Test | Result | Notes |
|---|---|---|---|
| 20 | Policy creation/editing | ⏳ | |
| 21 | Vault migration | ⏳ | |
| 22 | Cloud connection | ⏳ | |
| 23 | Local AI broker start/stop | ⏳ | |
| 24 | Sentinel enable/disable | ⏳ | |
| 25 | Memory guard scan | ⏳ | |

### Error Handling

| # | Test | Result | Notes |
|---|---|---|---|
| 26 | Invalid API key shows error | ⏳ | |
| 27 | Rate limit shows warning | ⏳ | |
| 28 | Offline mode works | ⏳ | |
| 29 | No console errors | ⏳ | |
| 30 | Extension deactivates cleanly | ⏳ | |

### Performance

| # | Test | Result | Notes |
|---|---|---|---|
| 31 | Activation time <500ms | ⏳ | |
| 32 | Memory usage <50MB | ⏳ | |
| 33 | No memory leaks on repeated scans | ⏳ | |

### Security Verification

| # | Test | Result | Notes |
|---|---|---|---|
| 34 | Output panel shows no secrets | ⏳ | |
| 35 | No tokens in webview HTML | ⏳ | |
| 36 | Vault values encrypted at rest | ⏳ | |
| 37 | Clipboard redaction works | ⏳ | |

## Summary

| Category | Passed | Failed | Pending |
|---|---|---|---|
| Activation & Loading | 0 | 0 | 4 |
| Command Palette | 0 | 0 | 3 |
| UI Components | 0 | 0 | 5 |
| Core Scanning | 0 | 0 | 7 |
| Security Features | 0 | 0 | 6 |
| Error Handling | 0 | 0 | 5 |
| Performance | 0 | 0 | 3 |
| Security Verification | 0 | 0 | 4 |
| **Total** | **0** | **0** | **37** |

## Environment

- **OS:** PENDING
- **VS Code version:** PENDING
- **Node.js version:** PENDING
- **Extension version:** 0.1.0
- **VSIX size:** 210 KB

## Sign-off

- [ ] All 37 runtime tests pass
- [ ] No console errors
- [ ] No secret leakage
- [ ] Performance acceptable
- [ ] Ready for marketplace submission
