# API / UI / DB / SDK COVERAGE REPORT — CyberRakshak Guard

> Audit Date: June 17, 2026
> Methodology: File counting, route inspection, component audit, test coverage analysis

---

## 1. FILE INVENTORY

| Category | Count | Evidence |
|----------|-------|----------|
| API Routes (route.ts) | 84 | `find app/api -name 'route.ts'` |
| Pages (page.tsx) | 100 | `find app -name 'page.tsx'` |
| Components (.tsx) | 61 | `find components -name '*.tsx'` |
| Lib Files (.ts) | 124 | `find lib -name '*.ts'` |
| Workers (.ts) | 4 | `find workers -name '*.ts'` |
| Test Files (.ts) | 18 | `find tests -name '*.ts'` |
| Prisma Models | 110 | `grep -c '^model ' prisma/schema.prisma` |
| Prisma Migrations | 9 | `ls -d prisma/migrations/*/` |

## 2. API ROUTE COVERAGE

### Core Guard Routes
| Route | Method | Auth | Tests | Status |
|-------|--------|------|-------|--------|
| `/api/guard/input` | POST | API Key | ✅ guard.test.ts | ✅ |
| `/api/guard/output` | POST | API Key | ✅ guard.test.ts | ✅ |
| `/api/guard/analyze` | POST | API Key | ✅ guard.test.ts | ✅ |
| `/api/guard/grounding` | POST | API Key | — | 🔶 |

### Auth Routes
| Route | Method | Auth | Tests | Status |
|-------|--------|------|-------|--------|
| `/api/auth/[...nextauth]` | GET/POST | Public | ✅ auth.test.ts | ✅ |
| `/api/auth/signup` | POST | Public | ✅ auth.test.ts | ✅ |
| `/api/auth/verify-email` | POST | Public | — | 🔶 |
| `/api/auth/request-password-reset` | POST | Public | — | 🔶 |
| `/api/auth/reset-password` | POST | Public | — | 🔶 |

### Billing Routes
| Route | Method | Auth | Tests | Status |
|-------|--------|------|-------|--------|
| `/api/billing/checkout` | POST | Session | ✅ phase3.test.ts | ✅ |
| `/api/billing/activate` | POST | Session | ✅ phase3.test.ts | ✅ |
| `/api/billing/webhook` | POST | HMAC Sig | ✅ phase3.test.ts | ✅ |
| `/api/billing/cancel` | POST | Session | — | 🔶 |
| `/api/billing/reactivate` | POST | Session | — | 🔶 |
| `/api/billing/lifecycle` | GET | Session | — | 🔶 |

### Webhook Routes
| Route | Method | Auth | Tests | Status |
|-------|--------|------|-------|--------|
| `/api/webhooks` | GET/POST | Session+RBAC | ✅ webhooks.test.ts | ✅ |
| `/api/webhooks/deliveries` | GET | Session+RBAC | ✅ webhooks.test.ts | ✅ |
| `/api/webhooks/rotate` | POST | Session+RBAC | ✅ webhooks.test.ts | ✅ |
| `/api/webhooks/test` | POST | Session+RBAC | — | 🔶 |
| `/api/webhooks/replay` | POST | Session+RBAC | — | 🔶 |

### RAG Routes
| Route | Method | Auth | Tests | Status |
|-------|--------|------|-------|--------|
| `/api/rag/collections` | GET/POST | Session | — | 🔶 |
| `/api/rag/documents` | GET/POST | Session | ✅ rag-rescan.test.ts | ✅ |
| `/api/rag/documents/[id]/rescan` | POST | Session | ✅ rag-rescan.test.ts | ✅ |
| `/api/rag/documents/review` | POST | Session | — | 🔶 |
| `/api/rag/query` | POST | API Key | — | 🔶 |
| `/api/rag/chunks/acl` | GET/POST | Session | — | 🔶 |

### Agent Firewall Routes
| Route | Method | Auth | Tests | Status |
|-------|--------|------|-------|--------|
| `/api/agent-firewall/inspect` | POST | API Key | ✅ phase11.test.ts | ✅ |

### Enterprise Routes
| Route | Method | Auth | Tests | Status |
|-------|--------|------|-------|--------|
| `/api/enterprise/data-retention` | POST | Session | ✅ phase5.test.ts | ✅ |
| `/api/enterprise/data-deletion` | POST | Session | — | 🔶 |
| `/api/enterprise/saml` | GET/POST | Session | — | 🔶 |
| `/api/enterprise/scim-tokens` | GET/POST | Session | — | 🔶 |
| `/api/enterprise/security` | GET/POST | Session | — | 🔶 |
| `/api/enterprise/sso` | GET/POST | Session | — | 🔶 |

### SCIM v2 Routes
| Route | Method | Auth | Tests | Status |
|-------|--------|------|-------|--------|
| `/api/scim/v2/Users` | GET/POST | SCIM Token | — | 🔶 |
| `/api/scim/v2/Users/[id]` | GET/PUT/DELETE | SCIM Token | — | 🔶 |
| `/api/scim/v2/Groups` | GET/POST | SCIM Token | — | 🔶 |
| `/api/scim/v2/Groups/[id]` | GET/PUT/DELETE | SCIM Token | — | 🔶 |
| `/api/scim/v2/Schemas` | GET | SCIM Token | — | 🔶 |
| `/api/scim/v2/ServiceProviderConfig` | GET | SCIM Token | — | 🔶 |

### SSO Routes
| Route | Method | Auth | Tests | Status |
|-------|--------|------|-------|--------|
| `/api/sso/saml/login` | GET | Session | — | 🔶 |
| `/api/sso/saml/acs` | POST | SAML | — | 🔶 |
| `/api/sso/saml/metadata` | GET | Public | — | 🔶 |
| `/api/sso/saml/test` | POST | Session | — | 🔶 |

### Other Routes
| Route | Method | Auth | Tests | Status |
|-------|--------|------|-------|--------|
| `/api/health` | GET | Public | — | ✅ |
| `/api/projects` | GET/POST | Session | ✅ phase2.test.ts | ✅ |
| `/api/projects/policy` | GET/PUT | Session | ✅ phase2.test.ts | ✅ |
| `/api/projects/badge` | POST | Session | — | 🔶 |
| `/api/api-keys` | GET/POST | Session | ✅ phase2.test.ts | ✅ |
| `/api/logs` | GET | Session | ✅ phase2.test.ts | ✅ |
| `/api/exports` | POST | Session | ✅ phase3.test.ts | ✅ |
| `/api/badge/[slug]` | GET | Public | — | 🔶 |
| `/api/admin/actions` | POST | Admin | ✅ phase3.test.ts | ✅ |
| `/api/redteam/run` | POST | Session | ✅ phase10.test.ts | ✅ |
| `/api/reports` | GET/POST | Session | — | 🔶 |
| `/api/siem` | POST | API Key | — | 🔶 |

## 3. TEST COVERAGE ANALYSIS

### Test Files (18 total)
| Test File | Tests | Pass | Fail | Coverage Area |
|-----------|-------|------|------|---------------|
| `auth.test.ts` | ~15 | ✅ | 0 | Auth, signup, session |
| `guard.test.ts` | ~25 | ✅ | 0 | Guard engine, redaction, PII, secrets |
| `guard/safety-regression.test.ts` | ~10 | ✅ | 0 | Safety regression |
| `guard/safety-round2-regression.test.ts` | ~15 | ✅ | 0 | Round 2 safety |
| `guard/multi-turn-safety.test.ts` | ~8 | ✅ | 0 | Multi-turn safety |
| `integrations/integration-kit.test.ts` | ~12 | ✅ | 0 | SDK integration |
| `security.test.ts` | ~10 | ✅ | 0 | Security controls |
| `webhooks.test.ts` | ~12 | ✅ | 0 | Webhook signing, HMAC |
| `phase2.test.ts` | ~20 | ✅ | 0 | Projects, API keys, policy, logs |
| `phase3.test.ts` | ~25 | ✅ | 0 | Billing, RBAC, audit, Razorpay |
| `phase4.test.ts` | ~10 | ✅ | 0 | Email, detectors |
| `phase5.test.ts` | ~20 | ✅ | 0 | Enterprise, retention, KMS |
| `phase6.test.ts` | ~15 | ✅ | 0 | Enterprise readiness |
| `phase9.test.ts` | ~10 | ✅ | 0 | Agency, partner |
| `phase10.test.ts` | ~10 | ✅ | 0 | Red team, benchmarks |
| `phase11.test.ts` | ~15 | ✅ | 0 | Competitive gaps, firewall |
| `rag-rescan.test.ts` | ~10 | ✅ | 0 | RAG document rescan |
| `e2e/critical-flows.spec.ts` | — | ❌ TIMEOUT | — | Playwright E2E (blocked) |
| **TOTAL** | **205** | **205 PASS** | **0 FAIL** | — |

### SDK Test Coverage
| SDK | Tests | Pass | Fail |
|-----|-------|------|------|
| JS/TS SDK | 10 | 10 | 0 |
| Python SDK | 42 | 35 | 6 (async — missing pytest-asyncio) |

## 4. DB SCHEMA COVERAGE

### Prisma Models by Category
| Category | Models | Key Tables |
|----------|--------|------------|
| User Management | 8 | User, Organization, OrganizationMember, Invite, Agency, Client, BrandingSettings, UserSession |
| Infrastructure & Security | 12 | ApiKey, GuardLog, UsageCounter, AuditExport, EmailVerificationToken, PasswordResetToken, AdminAuditLog, SecurityEvent, SsoProvider, SamlProvider, SamlLoginAttempt, IpAllowlistEntry |
| RAG & AI | 20 | RagCollection, RagDocument, RagChunk, RagScanFinding, ClassifierDataset, AiProvider, AiModel, ToolIntegration, AgentTool, ToolPermission, ToolCallLog, ToolApprovalRequest, ToolRiskPolicy, etc. |
| Red Teaming | 8 | RedTeamSuite, RedTeamScenario, RedTeamRun, RedTeamResult, BenchmarkDataset, BenchmarkExample, BenchmarkRun, BenchmarkResult |
| Billing | 5 | Subscription, Invoice, PaymentEvent, PlanChangeLog, ScheduledReport |
| Enterprise | 10 | RetentionPolicy, DataDeletionRequest, ScimToken, ScimUserMapping, ScimGroupMapping, PartnerProfile, EnterprisePilot, ConsentRecord, etc. |
| Operations | 10 | BackgroundJob, CustomerOnboarding, SupportTicket, SupportMessage, Incident, IncidentUpdate, FeedbackReview, ProductEvent, etc. |
| ML/Data | 6 | MLDataset, MLDatasetExample, MLModelVersion, MLModelEvaluation, MLModelDeployment, MLReviewQueue |
| Monitoring | 11 | SiemIntegration, SiemDelivery, ThreatIntelSource, ThreatPattern, UsageAnomaly, CostBudget, ThrottleEvent, etc. |

## 5. COMPONENT COVERAGE

### Dashboard Components (23)
| Component | Pages Using | Status |
|-----------|-------------|--------|
| DashboardShell | All dashboard | ✅ |
| DashboardSidebar | All dashboard | ✅ |
| PlanGrid | Billing | ✅ |
| ApiKeyManager | API Keys | ✅ |
| PolicyForm | Policy | ✅ |
| WebhookManager | Webhooks | ✅ |
| LogsTable | Logs | ✅ |
| RagManager | RAG | ✅ |
| IntegrationWizard | Integrations | ✅ |
| NewProjectForm | Projects | ✅ |
| ProjectSwitcher | All dashboard | ✅ |
| ReportActions | Reports | ✅ |
| RiskChart | Dashboard overview | ✅ |
| StatCard | Dashboard overview | ✅ |
| UsageCard | Dashboard overview | ✅ |
| FeedbackButtons | Logs | ✅ |
| DocumentReviewButtons | RAG | ✅ |
| ScheduledReportManager | Reports | ✅ |
| BrandingSettings | Agency | ✅ |
| WhiteLabelReportPrint | Reports | ✅ |
| SdkInstalledButton | Onboarding | ✅ |

### Guard Components (6)
| Component | Pages Using | Status |
|-----------|-------------|--------|
| PlaygroundClient | Playground | ✅ |
| DemoChatClient | Demo | ✅ |
| GuardResultCard | Playground | ✅ |
| RedactedTextView | Logs, Playground | ✅ |
| RiskBadge | Dashboard, Logs | ✅ |
| RiskScore | Dashboard | ✅ |

## 6. PACKAGES & EXAMPLES

### Packages (5)
| Package | Language | Status |
|---------|----------|--------|
| `packages/sdk` | TypeScript | ✅ Build + Tests pass |
| `packages/python-sdk` | Python | 🔶 35/42 tests pass |
| `packages/langchain-middleware` | TypeScript | 🔶 Exists, no dedicated test |
| `packages/llamaindex-middleware` | TypeScript | 🔶 Exists, no dedicated test |
| `packages/vercel-ai-sdk-middleware` | TypeScript | 🔶 Exists, no dedicated test |

### Examples (6)
| Example | Status |
|---------|--------|
| `examples/express-chatbot` | 🔸 Exists |
| `examples/langchain-rag-chatbot` | 🔸 Exists (has node_modules committed) |
| `examples/nextjs-chatbot` | 🔸 Exists (has node_modules committed) |
| `examples/python-fastapi-chatbot` | 🔸 Exists |
| `examples/python-langchain-rag` | 🔸 Exists |
| `examples/real-chatbot-test` | 🔸 Exists (newly added) |

### Integrations
| Integration | Status |
|-------------|--------|
| `integrations/wordpress-plugin` | 🔸 Valid PHP, no Docker E2E |
| `helm/cyberrakshak` | 🔸 Chart.yaml + values.yaml + templates |

## 7. COVERAGE GAPS

### No Tests For:
1. SCIM endpoints (`/api/scim/v2/*`)
2. SSO/SAML endpoints (`/api/sso/saml/*`)
3. Admin ML endpoints (`/api/admin/ml/*`)
4. Scheduled report endpoints
5. RAG query endpoint
6. Agent firewall inspect endpoint (partially tested via phase11)
7. Billing cancel/reactivate endpoints
8. Contact/support/ops endpoints
9. Onboarding endpoints
10. Feedback endpoints

### No E2E For:
1. Playwright tests (timed out — port conflict)
2. Docker build verification
3. Load/stress testing
4. Cross-browser testing
5. Mobile responsive testing
