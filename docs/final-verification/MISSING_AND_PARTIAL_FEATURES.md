# MISSING AND PARTIAL FEATURES — CyberRakshak Guard

> Audit Date: June 17, 2026
> Classification: Features that are incomplete, missing, or only partially implemented

---

## 1. MISSING FEATURES (Referenced in docs but not implemented)

| Feature | Referenced In | Status | Impact |
|---------|---------------|--------|--------|
| MCP (Model Context Protocol) Integration | Agent Firewall docs | 📄 DOCS_ONLY | Agent Firewall missing MCP tool registration |
| Load Test Infrastructure | Production readiness docs | 🚫 MISSING | No k6/artillery scripts exist |
| `npm run test:load` script | Expected in package.json | 🚫 MISSING | Script not defined |
| E2E Playwright Tests (actual execution) | `tests/e2e/critical-flows.spec.ts` exists | ❌ BROKEN | Timed out — port conflict |

## 2. PARTIAL FEATURES (Implementation exists but gaps remain)

### RAG Security
| Feature | What Exists | What's Missing | Priority |
|---------|-------------|----------------|----------|
| Safe chunk embedding | Code + DB model | Live vector DB provider not configured | MEDIUM |
| Citation UI | Component exists | No dedicated test for citation accuracy | LOW |
| Source trust score | Code exists | No E2E verification | LOW |
| Document delete/restore | Delete works | Restore flow not explicitly tested | LOW |

### Agent Firewall
| Feature | What Exists | What's Missing | Priority |
|---------|-------------|----------------|----------|
| Tool registration | Full CRUD | MCP integration missing | MEDIUM |
| Approval workflow | DB + API + UI | No E2E test for approval→execution flow | LOW |

### India PII / DPDP
| Feature | What Exists | What's Missing | Priority |
|---------|-------------|----------------|----------|
| Consent logging | DB model + API | No E2E test | MEDIUM |
| Data deletion request | API + DB | No E2E test | MEDIUM |
| Data export request | API exists | No E2E test | LOW |
| Privacy dashboard | UI page exists | Not browser-verified | LOW |

### Integration Kit
| Feature | What Exists | What's Missing | Priority |
|---------|-------------|----------------|----------|
| Python SDK async client | Code exists | 6 tests fail (missing `pytest-asyncio`) | HIGH |
| Vercel AI SDK middleware | Package exists | No dedicated test | LOW |
| LangChain JS middleware | Package exists | No dedicated test | LOW |
| LlamaIndex JS middleware | Package exists | No dedicated test | LOW |
| WordPress plugin | Valid PHP | No Docker E2E test | MEDIUM |
| Dashboard integration wizard | UI component | No E2E test | LOW |

### Billing
| Feature | What Exists | What's Missing | Priority |
|---------|-------------|----------------|----------|
| Razorpay checkout | Code + sandbox mode | Live verification blocked | HIGH (needs keys) |
| Plan cancel/reactivate | API routes exist | No tests for these endpoints | MEDIUM |
| Billing lifecycle | API route exists | No test | LOW |

### Enterprise
| Feature | What Exists | What's Missing | Priority |
|---------|-------------|----------------|----------|
| SAML SSO | Full flow implemented | Live IdP test blocked | HIGH (needs IdP) |
| SCIM Provisioning | Full SCIM v2 API | Live IdP test blocked | HIGH (needs IdP) |
| SIEM Integration | Worker + DB models | Live SIEM test blocked | MEDIUM |
| IP Allowlist | DB + API | No E2E test | LOW |
| Scheduled reports | DB + UI | No E2E test | LOW |

### Dashboard UI
| Feature | What Exists | What's Missing | Priority |
|---------|-------------|----------------|----------|
| All 100+ pages | Code implemented | Zero browser verification (Playwright failed) | HIGH |

## 3. DUPLICATE CODE

| Duplicate | Location 1 | Location 2 | Impact |
|-----------|------------|------------|--------|
| Admin phase8 forms | `components/ops/AdminPhase8Forms.tsx` | `components/phase8/AdminPhase8Forms.tsx` | Identical files (verified via diff) |
| Support ticket form | `components/ops/SupportTicketForm.tsx` | `components/phase8/SupportTicketForm.tsx` | Identical files |
| Pilot request form | `components/ops/PilotRequestForm.tsx` | `components/phase8/PilotRequestForm.tsx` | Identical files |
| Contact sales form | `components/ops/ContactSalesForm.tsx` | `components/phase8/ContactSalesForm.tsx` | Identical files |
| Feedback widget | `components/ops/FeedbackWidget.tsx` | `components/phase8/FeedbackWidget.tsx` | Identical files |
| Partner profile form | `components/ops/PartnerProfileForm.tsx` | `components/phase8/PartnerProfileForm.tsx` | Identical files |
| Onboarding wizard | `components/ops/OnboardingWizard.tsx` | `components/phase8/OnboardingWizard.tsx` | Identical files |
| Onboarding experience | `components/ops/OnboardingExperience.tsx` | `components/phase8/OnboardingExperience.tsx` | Identical files |

**Recommendation:** Consolidate `components/ops/` and `components/phase8/` into a single directory. They are 100% identical.

## 4. COMMITTED ARTIFACTS

| Artifact | Location | Impact |
|----------|----------|--------|
| `node_modules` in examples | `examples/langchain-rag-chatbot/node_modules/` | Should be gitignored |
| `node_modules` in examples | `examples/nextjs-chatbot/node_modules/` | Should be gitignored |
| `.next-e2e/` directory | Previously committed, now in .gitignore and deleted | Was committed before .gitignore update |
| `playwright-report/` | Root directory | Should be gitignored |
| `test-results/` | Root directory | Should be gitignored |

## 5. PLACEHOLDER CONTENT

| Placeholder | Location | Impact |
|-------------|----------|--------|
| Subprocessors page text | `app/subprocessors/page.tsx` — "This placeholder should be completed" | Legal/compliance gap |
| `.env.example` placeholder values | Multiple keys set to "replace" or empty | Expected for templates |
| Demo email in .env | `DEMO_USER_EMAIL="demo@cyberrakshak.dev"` | Dev-only, OK |
| `EMAIL_FROM` uses example.com | `security@example.com` | Caught by validate-env |

## 6. DOCUMENTATION-ONLY GAPS

| Doc Claims Feature | Actually Implemented? |
|-------------------|----------------------|
| Kubernetes deployment guide | Helm chart exists but not tested |
| Self-hosted deployment | Dockerfiles exist but Docker build fails (env vars) |
| OWASP LLM Top 10 coverage | Maps to detectors, partially verified |
| ISO 27001 readiness | Documentation only, no audit |
| SOC 2 readiness | Documentation only, no audit |
| Load testing | Documented as needed, not implemented |
