# Agent Permission Manifest

## What it does
A per-agent allow/approval/block manifest that merges with the project policy. The **most restrictive rule wins**. Managed via:
- `GET /api/agent/manifest`
- `POST /api/agent/manifest`
- `PUT /api/agent/manifest/:id`
- `DELETE /api/agent/manifest/:id`

## Why it matters
Policy lives at the project level, but each agent needs different powers. A read-only research agent and an email-sending assistant should not share permissions. The manifest scopes capability to the agent without weakening the global policy.

## Manifest example
```json
{
  "agent": "openclaw",
  "allowedTools": ["browser.read", "calendar.read"],
  "approvalRequired": ["gmail.send", "browser.submit_form", "filesystem.write"],
  "blocked": ["terminal.run", "filesystem.delete", "filesystem.read.env"],
  "allowedDomains": ["gmail.com", "calendar.google.com"],
  "blockedDomains": [],
  "allowedWorkspaceDirs": ["./agent-workspace"],
  "blockedFilePatterns": [".env", "*.pem", "id_rsa"],
  "dataPolicy": { "externalSecrets": "BLOCK", "externalPII": "ASK_APPROVAL", "failClosed": true }
}
```

## SDK example
```ts
await firewall.upsertManifest({ agent: "openclaw", manifestJson: manifest });
```

## Security behavior
- Merge order: project policy ∩ manifest, taking the more restrictive decision per tool/domain/pattern.
- A `blocked` tool stays blocked even if the action looks safe.
- An `approvalRequired` tool forces `ASK_APPROVAL`.
- A `blockedFilePatterns` match (e.g. `.env`) forces `BLOCK`.
- An `allowedDomains` match can *reduce* risk but never overrides a block.

## Common mistakes
- Expecting `allowedDomains` to override a `blocked` tool — it cannot. Restrictive always wins.
- Listing a tool in both `allowedTools` and `blocked` — block takes precedence.

## Test examples
- Blocked tool blocks even when the action looks safe.
- `approvalRequired` tool asks for approval.
- Allowlisted domain reduces risk.
- Blocked file pattern `.env` blocks.
- Most restrictive rule wins on conflict.
