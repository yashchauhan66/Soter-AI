# cybersecurityguard — Canary Network (Prompt Injection Canary Network) Implementation Report

## Executive summary
Implemented the **Canary Network** persistence + observability for cybersecurityguard by adding:
- Dedicated DB persistence for canary leaks: `CanaryLeakEvent`
- API endpoints for listing tokens and leak events and disabling canary tokens
- Dashboard page at `/dashboard/canary-network`
- Updated canary leak checking to persist **redacted-only** leak content (no raw canary tokens)

This ensures canary-based leak detection does not leak secrets into logs/DB responses and stays tenant/project isolated.

## Files changed
- `prisma/schema.prisma`
  - Added `enum CanaryLeakLocation`
  - Added `enum CanaryLeakDecision`
  - Added model `CanaryLeakEvent`
- `app/api/canary/check/route.ts`
  - Persists `CanaryLeakEvent` on leak detection using `sanitizeLogText(body.content)`
- `app/api/canary/tokens/route.ts`
  - Lists canary tokens (never returns tokenHash)
- `app/api/canary/leaks/route.ts`
  - Lists leak events (returns `contentRedacted` only)
- `app/api/canary/[id]/disable/route.ts`
  - Tenant/project scoped disable: `CanaryToken.active = false`
- `app/dashboard/canary-network/page.tsx`
  - Dashboard UI for canary tokens and leak events + disable action
- `app/dashboard/canary-network/actions.ts`
  - Server action to disable a canary token + audit log entry
- `tests/canary-network-feature7.test.ts`
  - Static API source-safety checks for guards and redaction safety
- `docs/advanced-ai-security/canary-network.md`
  - Feature documentation and API usage examples

## Database models added/updated
### Added
- `CanaryLeakEvent`
  - `projectId`
  - `canaryTokenId?` (FK-like reference; nullable)
  - `sessionId?`
  - `location`
  - `contentRedacted` (`@db.Text`)
  - `decision` (`CanaryLeakDecision`)
  - `riskLevel`
  - `reason` (`@db.Text`)
  - `createdAt`

### Enums
- `CanaryLeakLocation`
- `CanaryLeakDecision`

## APIs added/updated
### Updated
- `POST /api/canary/check`
  - On leak detection:
    - updates `CanaryToken.triggeredAt`
    - inserts `CanaryLeakEvent` with **redacted-only** persisted content:
      - `contentRedacted = sanitizeLogText(body.content)`
    - returns guard result

### Added
- `GET /api/canary/tokens`
  - Lists tokens without exposing `tokenHash`
- `GET /api/canary/leaks`
  - Lists leak events, includes only `contentRedacted`
- `POST /api/canary/:id/disable`
  - Tenant/project scoped disable; fail-closed on missing token

## SDK exports added
No SDK exports were added in this run.
Canary functionality is provided via existing `lib/agent-firewall/mvp3.ts` helpers and the `/api/canary/*` routes.

## Dashboard pages added
- `/dashboard/canary-network`
  - Shows:
    - active canary tokens and last trigger time
    - leak events timeline (redacted content only)
  - Provides disable action for tokens

## Documentation added
- `docs/advanced-ai-security/canary-network.md`

## Security rules enforced
- **Never store raw secrets/tokens** in DB leak events:
  - `CanaryLeakEvent.contentRedacted` is derived via `sanitizeLogText(body.content)`
- **Never expose token hashes**:
  - tokens listing route does not select `tokenHash`
- **Tenant/project isolation**
  - all canary API routes enforce `authenticateAgentFirewall`
  - disable route updates only by `projectId` + `id`

## Known limitations
- SDK export functions for canary network are not added in this run (per repository “already has canary folder” constraint).
- Dashboard “disable” action persists an `AgentActionLog` entry, but no dedicated `Canary`-audit model was introduced beyond existing logging.

## Production readiness
**High readiness** for canary leak persistence + observability:
- DB schema + persistence exists
- listing and disabling are tenant-scoped
- redaction safety is implemented at persistence time

## Remaining work
- Add full end-to-end tests (runtime) for API + dashboard flows if the repo has an E2E harness for these routes.
- Create `docs/final-audit/canary-network-test-report.md` (test report) in the next step.
