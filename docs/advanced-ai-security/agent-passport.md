# AI Agent Identity & Session Passport

## What It Does

Agent Passport gives each AI agent a project-scoped identity and a short-lived session passport before it can use tools. A passport binds an agent identity to a session id, allowed tools, blocked tools, approval-required tools, allowed and blocked domains, data scopes, memory scopes, expiry, risk score, and a policy snapshot.

## Why It Matters

AI agents should not be anonymous tool callers. A compromised prompt, RAG document, browser page, or MCP tool can try to drive an agent into unsafe actions. Passports make the runtime prove who the agent is, what session it belongs to, and what it is allowed to do before risky action checks continue.

## API Example

All endpoints use `x-api-key`.

```ts
const identity = await fetch("/api/agent/identity/create", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-api-key": process.env.CYBERSECURITYGUARD_API_KEY! },
  body: JSON.stringify({
    name: "support-rag-agent",
    agentType: "RAG_AGENT",
    defaultPolicy: {
      allowedTools: ["rag.search", "browser.read"],
      approvalRequiredTools: ["gmail.send"],
      blockedTools: ["terminal.run", "filesystem.delete"],
      allowedDomains: ["help.example.com"],
      dataScopes: ["support:read"],
      memoryScopes: ["session"]
    }
  })
}).then((res) => res.json());

const passport = await fetch("/api/agent/passport/issue", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-api-key": process.env.CYBERSECURITYGUARD_API_KEY! },
  body: JSON.stringify({ agentIdentityId: identity.id, ttlSeconds: 1800 })
}).then((res) => res.json());

const decision = await fetch("/api/agent/passport/validate", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-api-key": process.env.CYBERSECURITYGUARD_API_KEY! },
  body: JSON.stringify({
    sessionId: passport.sessionId,
    passportToken: passport.passportToken,
    tool: "rag.search",
    action: "search",
    target: "https://help.example.com/docs"
  })
}).then((res) => res.json());
```

## SDK Example

```ts
import {
  createAgentIdentity,
  issueAgentPassport,
  validateAgentPassport,
  revokeAgentPassport,
  getAgentPassport
} from "@cybersecurityguard/guard";

const client = {
  apiKey: process.env.CYBERSECURITYGUARD_API_KEY!,
  baseUrl: process.env.CYBERSECURITYGUARD_BASE_URL
};

const identity = await createAgentIdentity(client, {
  name: "browser-agent",
  agentType: "BROWSER_AGENT",
  defaultPolicy: {
    allowedTools: ["browser.open", "browser.read"],
    approvalRequiredTools: ["browser.submit_form"],
    blockedDomains: ["malicious.example"]
  }
});

const passport = await issueAgentPassport(client, {
  agentIdentityId: String(identity.id),
  ttlSeconds: 900
});

const check = await validateAgentPassport(client, {
  sessionId: String(passport.sessionId),
  passportToken: String(passport.passportToken),
  tool: "browser.submit_form",
  action: "submit_form",
  target: "https://example.com/form"
});

if (check.decision !== "ALLOW") throw new Error(check.reason);

await getAgentPassport(client, String(passport.sessionId));
await revokeAgentPassport(client, { sessionId: String(passport.sessionId) });
```

## Dashboard Usage

Open `/dashboard/agent-passports` to review agent identities, active sessions, passport status, allowed and blocked tools, domain scope, risk score, expiry, and audit events. Active passports can be revoked from the table.

## Security Decisions

- Unknown agent or missing passport: `BLOCK`
- Disabled or quarantined identity: `BLOCK`
- Expired passport: `BLOCK` and marked expired
- Revoked passport: `BLOCK`
- Blocked tool: `BLOCK`
- Approval-required tool: `ASK_APPROVAL`
- Tool outside the allowed list: `BLOCK`
- Blocked domain: `BLOCK`
- Domain outside an allowlist: `ASK_APPROVAL`
- High-risk tool without approval policy: `BLOCK`

## Common Mistakes

- Do not store the raw `passportToken`; store it in a runtime secret store only if needed.
- Do not log the raw `passportToken`, API key, cookies, environment values, or tool payload secrets.
- Do not reuse one passport across projects or tenants.
- Do not create long-lived passports for browser, terminal, payment, or MCP agents.
- Do not place high-risk tools only in `allowedTools`; put them in `approvalRequiredTools`.

## Testing Examples

```bash
tsx --test tests/agent-passport.test.ts
npx prisma validate
npm run typecheck
npm test
```

The focused tests cover identity creation logic, passport issue policy, valid validation, expiry, revocation, disabled agents, blocked tools, allowed tools, cross-project denial semantics, dashboard route existence, hash safety, and guard API route preservation.

## Production Notes

Use short TTLs, rotate API keys, keep `API_KEY_PEPPER` or `AUTH_SECRET` stable, and wire approval-required decisions into the existing approval workflow before executing high-impact actions. High-risk and critical actions should fail closed when validation cannot complete.
