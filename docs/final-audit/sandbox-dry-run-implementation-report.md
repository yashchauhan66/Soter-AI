# Agent Sandbox Dry-Run Feature 5 Implementation Report

Date: 2026-06-19

Scope: Feature 5, "Agent Sandbox Dry-Run" for cybersecurityguard.

## Executive Summary

Implemented a project-scoped dry-run simulator that predicts effects before real agent execution. The feature supports common risky action classes, stores redacted simulation records, returns fail-closed decisions, exposes authenticated APIs, adds a dashboard view, SDK helpers, docs, and focused regression tests.

## Files Changed

- `prisma/schema.prisma`
- `prisma/migrations/20260619050000_agent_sandbox_dry_run/migration.sql`
- `lib/dry-run/index.ts`
- `lib/dry-run/server.ts`
- `app/api/dry-run/simulate/route.ts`
- `app/api/dry-run/[id]/route.ts`
- `app/api/dry-run/session/[sessionId]/route.ts`
- `app/dashboard/dry-run/page.tsx`
- `components/dashboard/DashboardSidebar.tsx`
- `packages/sdk/src/dry-run.ts`
- `packages/sdk/src/index.ts`
- `package.json`
- `docs/advanced-ai-security/sandbox-dry-run.md`
- `tests/dry-run.test.ts`

## Database Model Added

- `AgentDryRun`
- Enums:
  - `AgentDryRunType`
  - `AgentDryRunDecision`

Dry-run rows are indexed by project/session, decision, and dry-run type.

## APIs Added

- `POST /api/dry-run/simulate`
- `GET /api/dry-run/[id]`
- `GET /api/dry-run/session/[sessionId]`

All routes use the existing advanced-security `x-api-key` authentication path and project-scoped SQL.

## SDK Exports Added

- `simulateAgentAction`
- `getDryRun`
- `getDryRunSession`

The SDK uses `x-api-key` headers, matching the existing API authentication pattern.

## Dashboard Added

- `/dashboard/dry-run`
- Added "Dry-run" to the Agent security sidebar group.
- Shows recent simulations, decision/risk metrics, redacted simulated payloads, and predicted effects.

## Dry-Run Handlers Added

- Email send/draft
- Browser form submit
- Terminal command
- File write/delete
- API call
- Payment
- Package install
- Database write
- Custom/unknown effect

## Security Rules Added

- Dry-run never executes the real action.
- Critical effect returns `BLOCK`.
- High-risk effect returns `REQUIRE_APPROVAL`.
- Safe low-risk effect returns `SAFE_TO_EXECUTE`.
- Unknown/custom effect returns `REVIEW`.
- Secret exfiltration blocks.
- `rm -rf`, delete commands, and `curl | bash` block.
- File operations outside workspace block.
- External API with private or PII data blocks.
- State-changing actions such as email, form submit, and file write require approval unless policy later relaxes them.
- Simulated payloads and metadata are sanitized before persistence.
- Cross-project access is denied by project-scoped lookups.

## Known Limitations

- Package install script risk is modeled from command/package shape only; it does not query the package registry.
- File path safety is conservative and string-based; runtime integrations should still enforce workspace boundaries at executor level.
- The simulator authorizes or blocks execution but does not run external tools.
- Repository-wide diff hygiene is still blocked by unrelated pre-existing conflict markers and unmerged/index-conflict entries outside Feature 5.
- Root `npm run build` was not run per user instruction.

## Production Readiness

Feature 5 is ready for user build verification. Prisma validation, Prisma client generation, root typecheck, SDK typecheck, lint, focused Feature 5 tests, and the full package test suite passed.

## Remaining Work

- Run root `npm run build` when ready.
- Run Playwright E2E after a fresh production build exists.
- Clean unrelated merge/conflict-marker state before final commit or release packaging.
- Continue with Feature 6.
