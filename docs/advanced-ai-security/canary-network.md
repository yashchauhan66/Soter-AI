# Canary Network (Prompt Injection Canary Network)

## What it does
The **Canary Network** creates protected-context **canary tokens** and detects when those tokens leak into risky locations such as:
- Agent output (final text)
- Tool-call content
- Emails and API requests
- Browser form submissions
- Memory writes
- Any other configured integration output path

When a leak is detected, the system:
- **Blocks** the action (fail-safe)
- Persists a **dedicated leak event** (`CanaryLeakEvent`) with **redacted content only**
- Records a security audit event (`AgentActionLog`) without storing raw secrets/tokens

## Why it matters
Regex-based secret scanners catch many credential formats, but prompt-injection style leakage can:
- Exfiltrate system prompts / RAG text via paraphrase
- Bypass naive “exact token” match patterns
- Leak protected content through intermediate steps (tools, forms, API payloads)

Canaries provide **high-signal** leak detection because the token is only placed in protected contexts. If it reappears in external-facing outputs or tool payloads, it strongly indicates a leakage path.

## APIs

### 1) Create canary token
**POST** `/api/canary/create`

**Example**
```bash
curl -X POST "https://YOUR_DOMAIN/api/canary/create" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "scope": "SYSTEM_PROMPT",
    "label": "prod"
  }'
```

### 2) Check content for canary leaks (persist leak events)
**POST** `/api/canary/check`

**Example**
```bash
curl -X POST "https://YOUR_DOMAIN/api/canary/check" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "sessionId": "agent_sess_123",
    "location": "agent_output",
    "content": "Agent output: CYBERGUARD_CANARY_AbCdEf... "
  }'
```

### 3) List canary tokens
**GET** `/api/canary/tokens`

**Example**
```bash
curl -H "x-api-key: YOUR_API_KEY" \
  "https://YOUR_DOMAIN/api/canary/tokens?project=YOUR_PROJECT_ID"
```

### 4) List leak events
**GET** `/api/canary/leaks`

**Example**
```bash
curl -H "x-api-key: YOUR_API_KEY" \
  "https://YOUR_DOMAIN/api/canary/leaks?project=YOUR_PROJECT_ID"
```

### 5) Disable a canary token
**POST** `/api/canary/:id/disable`

**Example**
```bash
curl -X POST "https://YOUR_DOMAIN/api/canary/<CANARY_TOKEN_ID>/disable" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{ "reason": "Disabled by admin investigation" }'
```

## SDK example
This repo currently implements canary functionality primarily via internal `lib/agent-firewall/mvp3.ts` helpers and the `/api/canary/*` routes. Use those routes from your SDK/server integration.

Pseudo-example:
```ts
import { createCanary, checkCanaryContent } from "@/lib/agent-firewall/mvp3";

// 1) create canary token (server-side)
const canary = createCanary({ scope: "SYSTEM_PROMPT", label: "prod" });

// 2) when you have candidate output content, call /api/canary/check
// Never store raw canary tokens beyond what the canary mechanism requires.
const result = checkCanaryContent(candidateContent, [
  { id: canaryId, tokenHash: canary.tokenHash, tokenLabel: canary.tokenLabel, scope: canary.scope },
]);
```

## Dashboard usage
**Dashboard page:** `/dashboard/canary-network`

What you can do:
- View **active/inactive canary tokens**
- View **leak events** with **redacted content**
- Disable specific canary tokens (tenant/project scoped)

## Security decisions
- **Disabled/unknown tokens**: do not trigger active persistence (fail-safe behavior is preserved)
- **Leak detected in protected output**: **BLOCK** + event persisted (`CanaryLeakEvent`)
- **Persistence safety**:
  - store **only redacted content** (`contentRedacted`)
  - do **not** persist raw canary tokens or token hashes into leak events

## Common mistakes
1. **Logging canary tokens** or raw content that includes them  
   - Only persist sanitized/redacted content.
2. **Returning token hashes** to the client  
   - The UI/API should not expose token hashes.
3. **Skipping auth/tenant checks**
   - Every canary API route must enforce `authenticateAgentFirewall`.

## Testing examples
- Unit tests already cover `createCanary`, `hashCanaryToken`, and `checkCanaryContent`.
- Added Feature 7 API source-safety tests ensure:
  - dedicated `CanaryLeakEvent` insertion exists
  - `sanitizeLogText(body.content)` is used for persistence
  - token hashes are not returned/exposed by list routes

## Production notes
- Treat canary leak events as **security incidents**.
- Keep the blast radius small:
  - disable only the relevant canary token when investigating false positives
- Ensure audit retention aligns with your compliance needs.
