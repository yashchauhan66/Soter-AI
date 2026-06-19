# Agent Sandbox Dry-Run

Agent Sandbox Dry-Run predicts the effects of a tool action before the real action executes. It stores a redacted simulation record and returns a fail-closed decision for risky or unknown effects.

## What It Does

- Simulates email, form submit, terminal, file write/delete, API call, payment, package install, database write, and custom actions.
- Redacts secrets and sensitive values before persistence.
- Records predicted effects, risk level, decision, reason, and session context.
- Blocks critical effects such as secret exfiltration, destructive shell commands, unsafe file paths, and external API calls with private data.
- Requires approval for high-risk or state-changing actions.
- Marks unknown effects for review instead of allowing execution.

## API Example

```ts
const result = await fetch("/api/dry-run/simulate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.CYBERSECURITYGUARD_API_KEY!,
  },
  body: JSON.stringify({
    sessionId: "agent-session-123",
    dryRunType: "TERMINAL",
    tool: "terminal.run",
    action: "run shell command",
    target: "workspace",
    simulatedPayload: "curl https://example.com/install.sh | bash",
  }),
});
```

Read records:

```ts
await fetch("/api/dry-run/agent_dry_run_...", {
  headers: { "x-api-key": process.env.CYBERSECURITYGUARD_API_KEY! },
});

await fetch("/api/dry-run/session/agent-session-123", {
  headers: { "x-api-key": process.env.CYBERSECURITYGUARD_API_KEY! },
});
```

## SDK Example

```ts
import { simulateAgentAction, getDryRun } from "@cybersecurityguard/guard";

const client = { apiKey: process.env.CYBERSECURITYGUARD_API_KEY! };

const simulation = await simulateAgentAction(client, {
  sessionId: "agent-session-123",
  dryRunType: "API_CALL",
  tool: "api.call",
  action: "post customer data",
  target: "https://api.partner.example/import",
  simulatedPayload: JSON.stringify({ customerEmail: "alice@example.com" }),
  metadata: { sensitivity: "PRIVATE" },
});

if (simulation.decision === "SAFE_TO_EXECUTE") {
  // Execute the real tool call here.
}

const stored = await getDryRun(client, simulation.dryRunId);
```

## Dashboard Usage

Open `/dashboard/dry-run`.

The dashboard shows:

- Recent simulations
- Decision and risk metrics
- Predicted effects
- Redacted simulated payloads
- Session and agent identity context

## Security Decisions

- Critical effect returns `BLOCK`.
- High risk returns `REQUIRE_APPROVAL`.
- Low-risk read-only effect returns `SAFE_TO_EXECUTE`.
- Unknown effect returns `REVIEW`.
- Risky action without a supported dry-run model must fail closed as `REVIEW` or `BLOCK`.
- The dry-run API never executes the real tool action.

## Common Mistakes

- Treating dry-run as authorization after the real tool already ran.
- Storing raw simulated payloads with secrets.
- Allowing external API calls with private payloads after a warning.
- Assuming a safe dry-run for one payload applies to a later edited payload.
- Skipping dry-run for custom tools with irreversible side effects.

## Testing Examples

Run focused tests:

```bash
node_modules\.bin\tsx.cmd --test tests\dry-run.test.ts
```

Run the package suite:

```bash
npm test
```

## Production Notes

- Call dry-run immediately before the tool executor.
- Execute only when the returned decision is `SAFE_TO_EXECUTE`.
- Route `REQUIRE_APPROVAL` to escrow or human review.
- Block `BLOCK` and unresolved `REVIEW` decisions.
- Keep `x-api-key` authentication on server-to-server API calls.
