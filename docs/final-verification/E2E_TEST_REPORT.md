# E2E TEST REPORT — CyberRakshak Guard

> Audit Date: June 17, 2026
> Framework: Playwright (configured in `playwright.config.ts`)

---

## 1. TEST EXECUTION SUMMARY

| Command | Result | Duration | Notes |
|---------|--------|----------|-------|
| `npx playwright test` | ❌ FAILED | 120s timeout | webServer failed to start |
| `npx playwright test --reporter=line` | ❌ FAILED | 120s timeout | Port 3000 already in use |

### Error Details
```
Error: Timed out waiting 120000ms from config.webServer.
[WebServer] Port 3000 is in use by process 30372, using available port 3001 instead.
```

### Root Cause
The Playwright config specifies `webServer` to start the Next.js dev server on port 3000, but the port was already occupied by another process (likely a previous dev server instance). Playwright timed out waiting for the health check.

**This is NOT a code issue** — it's an environment configuration issue.

---

## 2. E2E TEST FILE ANALYSIS

### `tests/e2e/critical-flows.spec.ts`
- **File exists**: ✅
- **Syntax valid**: ✅ (TypeScript/Playwright format)
- **Tests defined**: The file contains critical flow tests
- **Actually executed**: ❌ Never ran (webServer timeout)

### Playwright Configuration (`playwright.config.ts`)
- **Config exists**: ✅
- **Web server configured**: Yes, port 3000
- **Timeout**: 120s for webServer startup
- **Reporters**: Configured

---

## 3. WHAT E2E WOULD VERIFY (if runnable)

Based on the test file and project structure, E2E would cover:

1. **Homepage loads** — Marketing page renders
2. **Signup flow** — User registration
3. **Login flow** — Authentication
4. **Dashboard loads** — Authenticated dashboard
5. **Guard playground** — Input/output guard testing
6. **API key creation** — Key management
7. **Project creation** — Multi-project support
8. **Policy editing** — Guard policy configuration
9. **Webhook setup** — Webhook endpoint creation
10. **Billing page** — Plan display

---

## 4. UI PAGE INVENTORY (100 pages)

### Public Pages (16)
| Page | Route | Status |
|------|-------|--------|
| Homepage | `/` | 🔶 Code-verified only |
| Pricing | `/pricing` | 🔶 Code-verified only |
| Docs | `/docs` | 🔶 Code-verified only |
| Security | `/security` | 🔶 Code-verified only |
| Trust | `/trust` | 🔶 Code-verified only |
| Privacy | `/privacy` | 🔶 Code-verified only |
| Terms | `/terms` | 🔶 Code-verified only |
| Status | `/status` | 🔶 Code-verified only |
| Changelog | `/changelog` | 🔶 Code-verified only |
| Benchmarks | `/benchmarks` | 🔶 Code-verified only |
| Case Studies | `/case-studies` | 🔶 Code-verified only |
| Contact | `/contact` | 🔶 Code-verified only |
| Contact Sales | `/contact-sales` | 🔶 Code-verified only |
| Responsible Disclosure | `/responsible-disclosure` | 🔶 Code-verified only |
| Compliance (3 pages) | `/compliance/*` | 🔶 Code-verified only |
| Subprocessors | `/subprocessors` | 🔶 Code-verified only |

### Auth Pages (4)
| Page | Route | Status |
|------|-------|--------|
| Sign In | `/signin` | 🔶 Code-verified only |
| Sign Up | `/signup` | 🔶 Code-verified only |
| Forgot Password | `/forgot-password` | 🔶 Code-verified only |
| Verify Email | `/verify-email` | 🔶 Code-verified only |

### Dashboard Pages (30+)
| Page | Route | Status |
|------|-------|--------|
| Overview | `/dashboard` | 🔶 Code-verified only |
| Projects | `/dashboard/projects` | 🔶 Code-verified only |
| New Project | `/dashboard/projects/new` | 🔶 Code-verified only |
| API Keys | `/dashboard/api-keys` | 🔶 Code-verified only |
| Logs | `/dashboard/logs` | 🔶 Code-verified only |
| Policy | `/dashboard/policy` | 🔶 Code-verified only |
| Webhooks | `/dashboard/webhooks` | 🔶 Code-verified only |
| Reports | `/dashboard/reports` | 🔶 Code-verified only |
| Billing | `/dashboard/billing` | 🔶 Code-verified only |
| RAG | `/dashboard/rag` | 🔶 Code-verified only |
| RAG Security | `/dashboard/rag/security` | 🔶 Code-verified only |
| Agent Firewall | `/dashboard/agent-firewall` | 🔶 Code-verified only |
| Privacy | `/dashboard/privacy` | 🔶 Code-verified only |
| Red Team | `/dashboard/redteam` | 🔶 Code-verified only |
| Integrations | `/dashboard/integrations` | 🔶 Code-verified only |
| Settings | `/dashboard/settings` | 🔶 Code-verified only |
| Exports | `/dashboard/exports` | 🔶 Code-verified only |
| Badges | `/dashboard/badges` | 🔶 Code-verified only |
| Supply Chain | `/dashboard/security/supply-chain` | 🔶 Code-verified only |
| Detection Feedback | `/dashboard/detection-feedback` | 🔶 Code-verified only |
| Customer Success | `/dashboard/customer-success` | 🔶 Code-verified only |
| Agency (4 pages) | `/dashboard/agency/*` | 🔶 Code-verified only |
| Enterprise (6 pages) | `/dashboard/enterprise/*` | 🔶 Code-verified only |
| Partner (3 pages) | `/dashboard/partner/*` | 🔶 Code-verified only |
| Onboarding (4 pages) | `/dashboard/onboarding/*` | 🔶 Code-verified only |

### Admin Pages (15)
| Page | Route | Status |
|------|-------|--------|
| Admin Overview | `/admin` | 🔶 Code-verified only |
| Organizations | `/admin/organizations` | 🔶 Code-verified only |
| Projects | `/admin/projects` | 🔶 Code-verified only |
| Production | `/admin/production` | 🔶 Code-verified only |
| System Health | `/admin/system-health` | 🔶 Code-verified only |
| Red Team | `/admin/redteam` | 🔶 Code-verified only |
| SIEM | `/admin/siem` | 🔶 Code-verified only |
| Supply Chain | `/admin/supply-chain` | 🔶 Code-verified only |
| KMS | `/admin/kms` | 🔶 Code-verified only |
| ML (5 pages) | `/admin/ml/*` | 🔶 Code-verified only |
| Support | `/admin/support` | 🔶 Code-verified only |
| Abuse | `/admin/abuse` | 🔶 Code-verified only |
| Privacy | `/admin/privacy` | 🔶 Code-verified only |
| Threat Intel | `/admin/threat-intel` | 🔶 Code-verified only |
| Benchmarks | `/admin/benchmarks` | 🔶 Code-verified only |
| Classifier Evals | `/admin/classifier-evals` | 🔶 Code-verified only |
| Detection Quality | `/admin/detection-quality` | 🔶 Code-verified only |
| Growth Metrics | `/admin/growth/metrics` | 🔶 Code-verified only |

---

## 5. VERDICT

**E2E Coverage: 0% verified at runtime.**

All 100+ pages are code-implemented and TypeScript-valid, but zero pages have been verified in a real browser during this audit. The Playwright test framework is configured and a critical-flows spec exists, but it could not execute due to an environment port conflict.

### To Fix E2E:
1. Ensure port 3000 is free before running Playwright
2. Or update `playwright.config.ts` to use a different port (e.g., 3099)
3. Add `--forceExit` or kill existing processes before test run
