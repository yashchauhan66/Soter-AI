# Advanced AI Security — MVP 1 Implementation Plan

Scope: **MVP 1 only** — Context Lineage Firewall + Agent Blast Radius Simulator.
Do not start MVP 2 (Memory Poisoning, MCP Drift) or MVP 3 (Legal Boundary) until MVP 1 tests + build pass.

## Reuse (no duplicate systems)
- Auth + rate limit + tenant isolation: `authenticateAgentFirewall` from `lib/agent-firewall/server.ts` (wraps `authenticateApiKeyRequest`, `x-api-key`).
- Detection: `analyzeText` from `lib/guard/analyze.ts` (PII, India PII, secrets, injection).
- Redaction / log safety: `sanitizeLogText`, `sanitizeMetadata` from `lib/guard/logSafety.ts`.
- JSON + errors: `jsonResponse`, `apiError` from `lib/apiResponse.ts`; route helper `routeError`.
- DB: `db` from `lib/db.ts`, raw SQL `$executeRaw`/`$queryRaw` like the agent-firewall routes.
- Hashing: `createHash("sha256")` (content hashes; never store raw secrets).

## Pure logic libs (testable, no DB)
- `lib/advanced-security/lineage.ts`
  - `hashContent(content)` — sha256 hex.
  - `classifyContentFindings(content)` — wraps analyzeText, returns redactions/safeContent/risk flags.
  - `decideContextFlow(input)` — source trust/sensitivity × destination → decision/riskLevel/reason/safeContent/redactions/incidentType.
- `lib/advanced-security/blastRadius.ts`
  - `simulateBlastRadius(input)` — capabilities → score 0-100, riskLevel, findings, recommendations.
  - `runBlastRadiusScenario(input, scenarioName)` — scenario-weighted score.

## DB models (prisma + migration `20260618210000_advanced_security_mvp1`)
ContextSource, ContextFlow, LineageIncident, AgentRiskProfile, BlastRadiusSimulation. Strict projectId on every row + indexes. Store `contentHash` + `contentRedacted` only.

## API routes (x-api-key auth, project-scoped)
- POST `/api/lineage/source/register`
- POST `/api/lineage/flow/check`
- GET  `/api/lineage/session/[sessionId]`
- GET  `/api/lineage/incidents`
- POST `/api/blast-radius/simulate`
- POST `/api/blast-radius/scenario`

## Dashboard (existing style: ProjectSwitcher, requireProjectPermission, safeRows)
- `/dashboard/lineage` — sources, flows, incidents, filters, badges.
- `/dashboard/blast-radius` — risk profiles, scores, recommendations.
- Sidebar: new "Agent security" group linking both.

## SDK (`packages/sdk`) — MVP1 subset only
`registerContextSource`, `checkContextFlow`, `getLineageSession`, `listLineageIncidents`, `simulateBlastRadius`, `runBlastRadiusScenario`. Add `createCybersecurityGuardClient` alias. (MCP/legal/memory SDK methods deferred to MVP2/3.)

## Env (.env.example)
`CYBERSECURITYGUARD_LINEAGE_ENABLED`, `CYBERSECURITYGUARD_BLAST_RADIUS_ENABLED` (+ `CYBERGUARD_` aliases).

## Tests — `tests/advanced-security-mvp1.test.ts`
Lineage 1-10 + Blast Radius 41-50 (pure-function level), plus PDF/no-raw-secret assertions. Wire into `npm test`.

## Docs
`docs/advanced-ai-security/context-lineage-firewall.md`, `docs/advanced-ai-security/blast-radius-simulator.md`.
Final reports updated at end of full effort; MVP1 section documented now.

## Decision rules (lineage, most-restrictive-wins)
1. destinationTrustLevel BLOCKED → BLOCK.
2. secret in content + external destination → BLOCK.
3. SYSTEM_PROMPT/PRIVATE_CONTEXT source → FINAL_OUTPUT/external → BLOCK.
4. CONFIDENTIAL/SECRET + external/unknown destination → BLOCK.
5. REGULATED + external → ASK_APPROVAL (policy may BLOCK).
6. RAG_DOCUMENT confidential + untrusted/unknown TOOL → BLOCK.
7. UNTRUSTED/MALICIOUS source influencing TOOL/LLM → BLOCK (malicious) / REVIEW (untrusted).
8. PII + external → ASK_APPROVAL.
9. ≥2 confidential sources to external → REVIEW + MULTI_STEP_EXFILTRATION incident.
10. PUBLIC→trusted, INTERNAL→internal → ALLOW.
