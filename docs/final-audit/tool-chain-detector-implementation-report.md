# Tool Chain Attack Detector Feature 3 Implementation Report

Date: 2026-06-19

Scope: Feature 3 only, "Tool Chain Attack Detector" for cybersecurityguard. Feature 4 was not started.

## Executive Summary

Implemented a project-scoped detector for dangerous multi-tool agent sequences. The feature records tool chain sessions, checks each tool step against prior steps, creates findings for risky chains, blocks critical exfiltration or privilege escalation paths, and exposes API, dashboard, SDK, docs, and tests.

## Files Changed

- `prisma/schema.prisma`
- `prisma/migrations/20260619030000_tool_chain_attack_detector/migration.sql`
- `lib/tool-chain/index.ts`
- `lib/tool-chain/server.ts`
- `app/api/tool-chain/session/start/route.ts`
- `app/api/tool-chain/step/check/route.ts`
- `app/api/tool-chain/session/[sessionId]/route.ts`
- `app/api/tool-chain/findings/route.ts`
- `app/dashboard/tool-chain/page.tsx`
- `components/dashboard/DashboardSidebar.tsx`
- `packages/sdk/src/tool-chain.ts`
- `packages/sdk/src/index.ts`
- `package.json`
- `docs/advanced-ai-security/tool-chain-detector.md`
- `tests/tool-chain.test.ts`

## Database Models Added

- `ToolChainSession`
- `ToolChainStep`
- `ToolChainFinding`
- Enums:
  - `ToolChainSessionStatus`
  - `ToolChainDecision`
  - `ToolChainFindingType`

The tables are indexed by project, session, status, decision, finding type, and creation/update time. Steps and findings cascade when a session is deleted.

## APIs Added

- `POST /api/tool-chain/session/start`
- `POST /api/tool-chain/step/check`
- `GET /api/tool-chain/session/[sessionId]`
- `GET /api/tool-chain/findings`

All routes use the existing advanced-security `x-api-key` authentication path and project-scoped queries.

## SDK Exports Added

- `startToolChainSession`
- `checkToolChainStep`
- `getToolChainSession`
- `getToolChainFindings`

The SDK uses `x-api-key` headers, matching the existing API authentication pattern.

## Dashboard Added

- `/dashboard/tool-chain`
- Added "Tool chain" to the Agent security sidebar group.
- Shows chain timeline, source to action to destination, risk, decisions, blocked chains, review holds, findings, involved steps, and recommended fixes.

## Security Rules Added

- Safe isolated reads return `ALLOW`.
- Private/confidential reads followed by external send return `BLOCK`.
- Confidential RAG routed to unknown tools returns `BLOCK`.
- Memory read followed by external post returns `BLOCK`.
- File read followed by email send returns `ASK_APPROVAL` or `BLOCK` based on sensitivity.
- Terminal execution followed by network post returns `CRITICAL` `BLOCK`.
- System prompt or secret context reaching final output returns `CRITICAL` `BLOCK`.
- Untrusted browser page influencing a tool call returns `REVIEW`.
- Changed MCP tool followed by high-risk action returns `CRITICAL` `BLOCK`.
- Metadata is sanitized before persistence and raw API keys/secrets are not stored.
- Session and finding reads are scoped to `auth.project.id`.

## Known Limitations

- The detector is deterministic and rule-based. It is intentionally conservative and can be extended with richer lineage or model-assisted classification later.
- Repository-wide `git diff --check` still fails because unrelated pre-existing conflict markers remain in files such as `.env.example`, `docs/bug-stabilization/*`, integration docs, example READMEs, and `packages/sdk/README.md`.
- The repository still has unrelated unmerged/index-conflict entries outside Feature 3. They were not resolved as part of this feature.
- Playwright E2E was not run because the configured server uses `npm run start`, which depends on a production build.
- Root `npm run build` was not run per user instruction.

## Production Readiness

Feature 3 is ready for user build verification. Prisma validation, Prisma client generation, root typecheck, SDK typecheck, lint, focused Feature 3 tests, and the full package test suite passed.

## Remaining Work

- Run root `npm run build` when ready.
- Run Playwright E2E after a fresh production build exists.
- Clean unrelated merge/conflict-marker state before final commit or release packaging.
- Start Feature 4 only after explicit confirmation.
