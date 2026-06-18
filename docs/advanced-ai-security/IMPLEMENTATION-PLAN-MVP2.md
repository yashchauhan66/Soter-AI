# Advanced AI Security — MVP 2 Implementation Plan

Scope: **MVP 2 only** — Cross-Session Memory Poisoning Detector + MCP Tool Drift Monitor.
MVP 1 (Context Lineage + Blast Radius) is complete. Do not start MVP 3 (Legal Boundary) until MVP 2 tests + build pass.

## Reuse (no duplicate systems)
- Auth/rate-limit/tenant isolation: `authenticateAdvancedSecurity` (re-export of `authenticateAgentFirewall`) from `lib/advanced-security/server.ts`.
- Detection: `classifyContent` from `lib/advanced-security/lineage.ts` (wraps `analyzeText`), plus `analyzeText` directly for prompt-injection in tool descriptions.
- Redaction/log safety: `sanitizeLogText`, `sanitizeMetadata`.
- Hashing: `createHash("sha256")` for content/description/schema hashes.
- JSON + errors: `jsonResponse`, `routeError`.
- DB: raw SQL like the MVP 1 routes; `db.$queryRaw`/`$executeRaw`.

## Path / name de-confliction
- New routes live under `/api/memory/*` and `/api/mcp/*` (the agent-firewall ones are under `/api/agent/memory`, `/api/agent/mcp` — untouched).
- SDK already exports `checkMemory` (agent-firewall semantics). To avoid breaking it, the new poisoning detector is exposed as **`checkMemoryPoisoning`**, plus `storeSafeMemory`, `quarantineMemory`, `registerMcpServer`, `snapshotMcpTools`, `listMcpDrifts`. (Documented deviation from the spec's `checkMemory` name.)

## Pure logic libs (testable, no DB)
- `lib/advanced-security/memoryPoisoning.ts`
  - `analyzeMemoryContent(content, memoryType)` → { decision, riskLevel, reason, safeContent, findings[] } with finding types SAFETY_OVERRIDE | DATA_EXFILTRATION | FAKE_PERMISSION | TOOL_HIJACK | POLICY_BYPASS | IDENTITY_MANIPULATION | HIDDEN_INSTRUCTION | SECRET_IN_MEMORY | PII_IN_MEMORY.
  - `diffMemory(oldContent, newContent)` → { riskIncreased, addedInstruction, addedToolPermission, addedExternalDomain, addedHiddenInstruction }.
  - `hashMemory(content)`.
- `lib/advanced-security/mcpDrift.ts`
  - `detectCapabilities(text)` → capability list incl. auth_token_access + environment_access.
  - `riskForTool(caps, text)` → riskLevel + reasons.
  - `snapshotTool(tool)` → hashes + redacted description + caps + risk.
  - `diffSnapshots(prev, curr)` → drift[] with driftType DESCRIPTION_CHANGED | SCHEMA_CHANGED | CAPABILITY_ADDED | CAPABILITY_REMOVED | RISK_INCREASED | PROMPT_INJECTION_DETECTED | ENDPOINT_CHANGED, riskBefore/After, summary, recommendation.

## DB models (prisma + migration `20260618220000_advanced_security_mvp2`)
AgentMemoryRecord, MemoryPoisoningFinding, MemoryChangeAudit, McpServerRegistry, McpToolSnapshot, McpToolDrift. Strict projectId + indexes. Store contentHash + contentRedacted / description hashes only — never raw secrets.

## API routes (x-api-key, project-scoped)
Memory: POST `/api/memory/check`, POST `/api/memory/store`, GET `/api/memory/records`, POST `/api/memory/[id]/quarantine`, POST `/api/memory/[id]/restore`, DELETE `/api/memory/[id]`.
MCP: POST `/api/mcp/servers/register`, POST `/api/mcp/tools/snapshot`, GET `/api/mcp/drifts`, GET `/api/mcp/servers/[serverId]/tools`.

## Dashboard
- `/dashboard/memory-firewall` — records, risk, findings, quarantined, status filters.
- `/dashboard/mcp-drift` — servers, current tools, drift history, before/after, recommendations.
- Sidebar: add to existing "Agent security" group.

## Drift risk rules
New terminal_execute / file_delete / credential_access → CRITICAL. Prompt injection in description → CRITICAL. Schema adds command param → CRITICAL; adds external URL param → HIGH. Risk LOW→HIGH/CRITICAL → alert. Endpoint change → ENDPOINT_CHANGED. Quarantined server → tool use blocked (status check).

## Memory rules
Safety override / exfiltration / disable approvals / fake permission / tool hijack → QUARANTINE. Hidden instruction → REVIEW/QUARANTINE. Secret/API key/password → BLOCK or REDACT. Aadhaar/PAN/GSTIN → REVIEW/REDACT. Normal preference/fact → ALLOW. Quarantined memory never returned to agent (records endpoint excludes by default).

## Tests — `tests/advanced-security-mvp2.test.ts`
Memory 31-42 + MCP drift 11-20 at pure-function level + on-disk route/page existence. Wire into `npm test`.

## Docs
`docs/advanced-ai-security/memory-poisoning-detector.md`, `docs/advanced-ai-security/mcp-tool-drift-monitor.md`. Update final reports.

## Env
Flip `CYBERSECURITYGUARD_MCP_DRIFT_ENABLED` / `CYBERSECURITYGUARD_MEMORY_FIREWALL_ENABLED` (+ aliases) to "true".
