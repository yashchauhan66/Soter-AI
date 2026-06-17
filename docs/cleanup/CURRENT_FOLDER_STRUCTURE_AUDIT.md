# CyberRakshak Guard — Current Folder Structure Audit

Generated: 2026-06-17

## Top-Level Classification

| Path | Classification | Purpose | Production Usage | Build Dep | Can Delete | Risk |
|------|---------------|---------|-----------------|-----------|------------|------|
| `app/` | PRODUCTION_REQUIRED | Next.js App Router pages + API routes | Core app | Yes | No | — |
| `components/` | PRODUCTION_REQUIRED | React UI components | Core UI | Yes | No | — |
| `lib/` | PRODUCTION_REQUIRED | Business logic, guard engine, detectors | Core logic | Yes | No | — |
| `workers/` | PRODUCTION_REQUIRED | Background worker entrypoints | Production | Yes | No | — |
| `prisma/` | PRODUCTION_REQUIRED | Schema + migrations | Production | Yes | No (migrations) | — |
| `types/` | PRODUCTION_REQUIRED | TypeScript type declarations | Build | Yes | No | — |
| `middleware.ts` | PRODUCTION_REQUIRED | Next.js middleware (auth) | Production | Yes | No | — |
| `auth.ts` / `auth.config.ts` | PRODUCTION_REQUIRED | NextAuth configuration | Production | Yes | No | — |
| `packages/sdk/` | SDK_REQUIRED | JS/TS SDK package | SDK publishing | Yes | No | — |
| `packages/python-sdk/` | SDK_REQUIRED | Python SDK package | SDK publishing | No (Python) | No | — |
| `packages/langchain-middleware/` | SDK_REQUIRED | LangChain integration middleware | SDK publishing | No | No | — |
| `packages/llamaindex-middleware/` | SDK_REQUIRED | LlamaIndex integration middleware | SDK publishing | No | No | — |
| `packages/vercel-ai-sdk-middleware/` | SDK_REQUIRED | Vercel AI SDK middleware | SDK publishing | No | No | — |
| `integrations/wordpress-plugin/` | DEPLOYMENT_REQUIRED | WordPress integration plugin | Integration | No | No | — |
| `helm/` | DEPLOYMENT_REQUIRED | Kubernetes Helm chart | Deployment | No | No | — |
| `Dockerfile` | DEPLOYMENT_REQUIRED | Main app Docker build | Deployment | No | No | — |
| `Dockerfile.worker` | DEPLOYMENT_REQUIRED | Worker Docker build | Deployment | No | No | — |
| `docker-compose.prod.yml` | DEPLOYMENT_REQUIRED | Production compose | Deployment | No | No | — |
| `.dockerignore` | DEPLOYMENT_REQUIRED | Docker build ignore | Deployment | No | No | — |
| `.github/workflows/` | DEPLOYMENT_REQUIRED | CI/CD workflows | CI | No | No | — |
| `package.json` | PRODUCTION_REQUIRED | Root package manifest | Build | Yes | No | — |
| `package-lock.json` | PRODUCTION_REQUIRED | Dependency lock file | Build | Yes | No | — |
| `tsconfig.json` | PRODUCTION_REQUIRED | TypeScript config | Build | Yes | No | — |
| `next.config.mjs` | PRODUCTION_REQUIRED | Next.js config | Build | Yes | No | — |
| `tailwind.config.ts` | PRODUCTION_REQUIRED | Tailwind CSS config | Build | Yes | No | — |
| `postcss.config.mjs` | PRODUCTION_REQUIRED | PostCSS config | Build | Yes | No | — |
| `playwright.config.ts` | TEST_REQUIRED | Playwright E2E config | Tests | No | No | — |
| `tests/` | TEST_REQUIRED | Test suites (unit, integration, security, E2E) | Tests | No | No | — |
| `examples/` | DOCS_REQUIRED | Integration example apps | Docs/dev | No | Partial | LOW |
| `docs/` | DOCS_REQUIRED | Documentation | Docs | No | Partial | LOW |
| `README.md` | DOCS_REQUIRED | Project README | Docs | No | No | — |
| `.env.example` | DEPLOYMENT_REQUIRED | Env template | Deployment | No | No | — |
| `.gitignore` | PRODUCTION_REQUIRED | Git ignore rules | Build | No | No | — |

## Clearly SAFE_TO_DELETE (No Production References)

| Path | Classification | Evidence | Risk |
|------|---------------|----------|------|
| `NUL` | SAFE_TO_DELETE | Windows artifact, empty file | None |
| `dev-audit-3000.err` | SAFE_TO_DELETE | Local dev log | None |
| `dev-audit-3000.log` | SAFE_TO_DELETE | Local dev log | None |
| `dev-chatbot-safety.err` | SAFE_TO_DELETE | Local dev log | None |
| `dev-chatbot-safety.log` | SAFE_TO_DELETE | Local dev log | None |
| `dev-real-chatbot.err` | SAFE_TO_DELETE | Local dev log | None |
| `dev-real-chatbot.log` | SAFE_TO_DELETE | Local dev log | None |
| `tmp-next-3002.err.log` | SAFE_TO_DELETE | Local dev log | None |
| `tmp-next-3002.out.log` | SAFE_TO_DELETE | Local dev log | None |
| `tmp-next-dev-3003.err.log` | SAFE_TO_DELETE | Local dev log | None |
| `tmp-next-dev-3003.out.log` | SAFE_TO_DELETE | Local dev log | None |
| `tsconfig.tsbuildinfo` | SAFE_TO_DELETE | TypeScript build cache, regenerated on build | None |
| `.next-e2e/` | SAFE_TO_DELETE | Next.js E2E test build artifact | None |
| `playwright-report/` | SAFE_TO_DELETE | Playwright HTML report artifact | None |
| `test-results/` | SAFE_TO_DELETE | Playwright test results directory | None |
| `.venv-cyberrakshak-test/` | SAFE_TO_DELETE | Python virtualenv for testing | None |
| `.venv-test/` | SAFE_TO_DELETE | Python virtualenv for testing | None |
| `packages/cyberrakshak-python/` | SAFE_TO_DELETE | Empty directory (placeholder) | None |
| `examples/express-chatbot/node_modules/` | SAFE_TO_DELETE | Committed node_modules — should be gitignored | None |
| `packages/python-sdk/cyberrakshak_guard/__pycache__/` | SAFE_TO_DELETE | Python bytecache | None |
| `packages/python-sdk/tests/__pycache__/` | SAFE_TO_DELETE | Python test bytecache | None |
| `packages/python-sdk/cyberrakshak_guard.egg-info/` | SAFE_TO_DELETE | Python egg-info build artifact | None |

## Internal-Only Docs (ARCHIVE_CANDIDATE / SAFE_TO_DELETE)

These are internal dev notes, phase checklists, and audit scratch files. Not customer-facing.

### Phase checklists & reports (all internal)
- `docs/phase2-qa-checklist.md`
- `docs/phase3-qa-checklist.md`
- `docs/phase4-qa-checklist.md`
- `docs/phase5-qa-checklist.md`
- `docs/phase6-qa-checklist.md`
- `docs/phase6-recovery-state.md`
- `docs/phase7-performance-audit.md`
- `docs/phase8-qa-checklist.md`
- `docs/phase8-production-readiness.md`
- `docs/phase9-qa-checklist.md`
- `docs/phase9-known-limitations.md`
- `docs/phase10-qa-checklist.md`
- `docs/phase10-known-limitations.md`
- `docs/phase10-recommendation.md`
- `docs/phase11-gap-audit.md`
- `docs/phase11-recommendation.md`
- `docs/production-readiness-phase5.md`
- `docs/phase-12/` (internal blocker report)

### Bug stabilization & testing scratch (internal)
- `docs/bug-stabilization/` (all 11 files — internal debug logs)
- `docs/real-user-testing/` (all 12 files — internal test reports & results.json)
- `docs/testing/chatbot-real-test/` (all 10 files — internal test reports & results.json)

### Current functionality audit (internal)
- `docs/current-functionality-audit/` (all 8 files — internal inventory)

### Internal dev docs (not customer-facing)
- `docs/api-route-auth-audit-checklist.md`
- `docs/competitive-readiness.md`
- `docs/demo-script.md`
- `docs/sales-pitch.md`
- `docs/self-hosted.md` (duplicate of `docs/self-hosted-deployment.md`)
- `docs/webhook-worker.md`
- `docs/security-hardening-checklist.md`

### Stale/old test example directories
- `examples/real-chatbot-safety-test/` — internal test app, not linked in integration docs
- `examples/real-chatbot-test/` — internal test app, not linked in integration docs

## DOCS_REQUIRED (Keep — Customer/Deployment/Security)

### Integration docs (customer-facing)
- `docs/integrations/` — keep all: quickstart.md, nextjs.md, express.md, python.md, fastapi.md, rag-langchain.md, rest-api.md, cli.md, wordpress.md, botpress.md, intercom.md, whatsapp-chatbots.md, zendesk.md, API_CONTRACT.md, integration-wizard.md

### Compliance & security docs (auditor-facing)
- `docs/compliance/` — keep all (OWASP, SOC2, ISO27001, DPDP, encryption, etc.)
- `docs/security-audit/` — keep all (threat model, RBAC, secrets, RAG security, etc.)

### Operations docs
- `docs/operations/` — keep all (runbook, error-budget, SLA, billing validation)
- `docs/backup-restore.md` — keep
- `docs/kubernetes.md` — keep
- `docs/self-hosted-deployment.md` — keep

### Sales & go-to-market docs (referenced by tests)
- `docs/sales/` — keep all (referenced by phase9.test.ts, dashboard pages, README)
- `docs/growth/` — keep all (referenced by phase10.test.ts, admin layout, README)
- `docs/go-to-market/` — keep (referenced by phase9.test.ts)
- `docs/investor/` — keep (referenced by phase9.test.ts)
- `docs/launch/` — keep (launch plan is valuable)
- `docs/phase9/` — keep (referenced by README and phase9.test.ts)

### Test report artifacts in docs/integrations (borderline)
- `docs/integrations/DASHBOARD_WIZARD_TEST_REPORT.md` — internal report
- `docs/integrations/EXAMPLES_E2E_REPORT.md` — internal report
- `docs/integrations/FINAL_INTEGRATION_KIT_REPORT.md` — internal report
- `docs/integrations/INTEGRATION_TEST_REPORT.md` — internal report
- `docs/integrations/PYTHON_PACKAGE_VALIDATION_REPORT.md` — internal report
- `docs/integrations/WORDPRESS_PLUGIN_VALIDATION_REPORT.md` — internal report

## Unknown / Needs Review

| Path | Notes |
|------|-------|
| `packages/cyberrakshak-python/` | Empty directory — candidate for deletion |
| `packages/python-sdk/cyberrakshak_guard.egg-info/` | Build artifact — safe to delete |

## Summary

- **Total top-level items scanned:** 42 files + 26 directories
- **PRODUCTION_REQUIRED:** 15 items
- **SDK_REQUIRED:** 6 items
- **DEPLOYMENT_REQUIRED:** 7 items
- **TEST_REQUIRED:** 2 items
- **DOCS_REQUIRED:** ~120+ doc files (mostly keep)
- **SAFE_TO_DELETE:** 22+ items (temp files, build artifacts, venvs, pycache, committed node_modules)
- **ARCHIVE_CANDIDATE (internal docs):** 60+ internal-only doc files
