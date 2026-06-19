# Agent Transaction Escrow

Agent Transaction Escrow holds risky or irreversible agent actions before real execution. The action can be approved, denied, edited and approved, expired, or executed once.

## What It Does

- Creates an escrow transaction for high-risk actions such as email send, form submit, payment, booking, delete, database update, publish, code push, external API post, calendar invite, or account change.
- Stores redacted original payload and a safe payload for review.
- Returns a one-time approval token at creation and stores only its hash.
- Allows approval, denial, edit-and-approve, and single execution.
- Records an audit trail for each state transition.

## Why It Matters

Autonomous agents can make irreversible changes. Escrow creates a review boundary between decision and execution so users or admins can inspect what would happen before it happens.

## API Example

```ts
const created = await fetch("/api/escrow/create", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.CYBERSECURITYGUARD_API_KEY!,
  },
  body: JSON.stringify({
    sessionId: "agent-session-123",
    transactionType: "EMAIL",
    tool: "gmail.send",
    action: "send email",
    target: "customer@example.com",
    originalPayload: "Hi customer, here is the summary...",
  }),
});
```

Approve and execute:

```ts
await fetch("/api/escrow/approve", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.CYBERSECURITYGUARD_API_KEY!,
  },
  body: JSON.stringify({ approvalToken: "esc_..." }),
});

await fetch("/api/escrow/execute", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.CYBERSECURITYGUARD_API_KEY!,
  },
  body: JSON.stringify({ approvalToken: "esc_..." }),
});
```

## SDK Example

```ts
import {
  createEscrowTransaction,
  approveEscrowTransaction,
  executeEscrowTransaction,
} from "@cybersecurityguard/guard";

const client = { apiKey: process.env.CYBERSECURITYGUARD_API_KEY! };

const escrow = await createEscrowTransaction(client, {
  sessionId: "agent-session-123",
  transactionType: "FORM_SUBMIT",
  tool: "browser.submit_form",
  action: "submit form",
  target: "https://example.com/contact",
  originalPayload: "name=Alice&message=Please contact me",
});

await approveEscrowTransaction(client, {
  approvalToken: escrow.approvalToken,
});

await executeEscrowTransaction(client, {
  approvalToken: escrow.approvalToken,
});
```

## Dashboard Usage

Open `/dashboard/escrow`.

The dashboard shows:

- Pending transactions
- Risk level
- Redacted original payload
- Safe payload
- Approve, deny, and edit-and-approve actions
- Execution state
- Audit trail

## Security Decisions

- High-risk action creates escrow.
- Critical secret exfiltration blocks instead of escrow unless a policy explicitly allows critical review.
- Approval tokens are hashed.
- Approval expires.
- Approved transaction is bound to the reviewed action.
- Edited payload is re-scanned before approval.
- Denied or expired transaction cannot execute.
- Transaction cannot execute twice.

## Common Mistakes

- Executing the action before escrow approval.
- Storing raw approval tokens.
- Storing raw secrets or private payloads in review data.
- Reusing an approval token for a different action.
- Allowing execution after expiry or denial.

## Testing Examples

Run focused tests:

```bash
node_modules\.bin\tsx.cmd --test tests\escrow.test.ts
```

Run the package suite:

```bash
npm test
```

## Production Notes

- Treat escrow execution as an authorization boundary, not as the executor itself.
- Execute only the reviewed `safePayload`.
- Keep `x-api-key` authentication on server-to-server API calls.
- Use short TTLs for approval tokens.
- Keep audit exports redacted.
