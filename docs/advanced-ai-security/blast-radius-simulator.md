# Agent Blast Radius Simulator

## What it does
The Blast Radius Simulator estimates how much damage an AI agent could do **if it were compromised**, from its tools, permissions, data sources, external destinations, memory access, and policies. It returns a 0–100 blast-radius score, a risk level, concrete findings, and prioritized recommendations. It can also run named compromise scenarios.

## Why it matters
Two agents with the same prompt can have wildly different risk. A read-only research agent and an agent that can run terminal commands, read credentials, and send external email are not equally dangerous. Quantifying the blast radius lets you see — and reduce — the worst case before an incident, and prove the reduction after applying controls.

## API example
```http
POST /api/blast-radius/simulate
x-api-key: cybsg_live_...

{
  "agentName": "support-agent",
  "agentType": "computer_use",
  "tools": ["gmail.read", "gmail.send", "crm.update", "filesystem.read", "browser.submit_form"],
  "permissions": { "gmail.send": "approval_required", "filesystem.delete": "blocked" },
  "dataSources": [{ "type": "EMAIL", "sensitivity": "CONFIDENTIAL" }, { "type": "CRM", "sensitivity": "REGULATED" }],
  "externalDestinations": ["unknown_websites", "email_external"],
  "memoryAccess": { "longTermMemory": true, "projectMemory": true },
  "policies": { "auditEnabled": true, "dataEgressPolicy": true }
}
```
Response:
```json
{
  "blastRadiusScore": 82,
  "riskLevel": "CRITICAL",
  "findings": ["Agent can send external email", "Agent can write or update databases", "Agent can read 2 confidential/regulated data source(s)"],
  "recommendations": ["Require approval for outbound email", "Limit database access to read-only", "Enable the memory firewall or disable long-term memory for this agent"],
  "scenarioResults": []
}
```

Run a scenario:
```http
POST /api/blast-radius/scenario
x-api-key: cybsg_live_...

{ "agentName": "support-agent", "tools": ["gmail.read","gmail.send"], "dataSources": [{"type":"CRM","sensitivity":"REGULATED"}], "scenarioName": "credential_theft" }
```
Response includes `baselineScore`, `blastRadiusScore`, `riskLevel`, and a `narrative`.

## SDK example
```ts
import { createCybersecurityGuardClient } from "@cybersecurityguard/guard";
const guard = createCybersecurityGuardClient({ apiKey: process.env.CYBERSECURITYGUARD_API_KEY! });

const result = await guard.simulateBlastRadius({
  agentName: "support-agent",
  tools: ["gmail.read", "gmail.send", "crm.update"],
  permissions: { "gmail.send": "approval_required" },
  dataSources: [{ type: "EMAIL", sensitivity: "CONFIDENTIAL" }],
  memoryAccess: { longTermMemory: true },
});
console.log(result.blastRadiusScore, result.riskLevel, result.recommendations);
```

## Dashboard usage
`/dashboard/blast-radius` lists each agent's risk profile sorted by score, with risk-level color, the findings that drove the score, and the recommended restrictions. Re-run after applying controls to show the before/after reduction.

## Security decisions (scoring)
Risk **adds**: terminal +30, credential access +35, file delete +25, payment +25, db write +20, external email +15, browser form +15, external/MCP post +15, file read +10; confidential/regulated data +20; external destinations +15; long-term/project memory +10; high-risk tools with no approval +20; no egress policy +20; no audit +10.
Risk **reduces**: high-risk tools gated by approval −15, secrets blocked −20, terminal blocked −25, workspace-limited file access −15, allowlisted external domains −10, memory firewall −10, lineage firewall −15, audit/replay −5.
Levels: 0–25 LOW, 26–50 MEDIUM, 51–75 HIGH, 76–100 CRITICAL (clamped). A tool with permission `blocked` contributes no risk.

The profile stores only configuration metadata (tool names, sensitivities, policy flags) — never raw data or secrets. All rows are project-scoped.

## Common mistakes
- Passing `policies` flags as strings — they are booleans (`{ "auditEnabled": true }`).
- Expecting `approval_required` to remove a tool's risk entirely — it discounts the no-approval penalty; only `blocked` removes the tool's weight.
- Treating the score as a guarantee — it is a relative risk estimate to prioritize hardening, not a certification.

## Test examples
- Read-only browser agent → LOW.
- Gmail read/send without approval → HIGH.
- Terminal + file delete → CRITICAL.
- Approval requirement reduces the score.
- Memory + external email increases the score.
- Recommendations are generated for risky tools.
- `credential_theft` scenario on a data-rich agent → HIGH/CRITICAL.
- Before/after policy reduction lowers the score.
- Score is always clamped to 0–100.
