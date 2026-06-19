# Semantic Data Egress Firewall

Semantic Data Egress Firewall detects meaning-level leakage, not only exact regex matches. It protects confidential documents, customer context, pricing strategy, roadmap details, private email summaries, source-code logic, and other sensitive context even when the output is paraphrased.

## What It Does

- Fingerprints protected sources without storing raw source text.
- Checks outbound content against protected source fingerprints.
- Uses local heuristic matching for keywords, entities, phrases, source tags, semantic signals, and destination risk.
- Blocks exact secrets and high-confidence sensitive source egress.
- Holds medium-confidence sensitive egress for review or approval.
- Stores redacted content, hashes, findings, score, decision, and safe metadata.

## Why It Matters

Agents can leak confidential meaning without copying exact text. A summary of a private email, a paraphrase of an internal roadmap, or a rewritten pricing strategy can still be a data leak. This firewall catches those semantic overlaps before content leaves the product.

## API Example

Create a protected source fingerprint:

```ts
await fetch("/api/semantic-egress/source/fingerprint", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.CYBERSECURITYGUARD_API_KEY!,
  },
  body: JSON.stringify({
    sourceId: "doc-roadmap-q4",
    sourceType: "ROADMAP_DOC",
    sensitivityLevel: "CONFIDENTIAL",
    content: "Project Atlas Q4 launch plan includes enterprise pricing floors.",
  }),
});
```

Check egress:

```ts
await fetch("/api/semantic-egress/check", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.CYBERSECURITYGUARD_API_KEY!,
  },
  body: JSON.stringify({
    sessionId: "agent-session-123",
    sourceIds: ["doc-roadmap-q4"],
    destinationType: "EXTERNAL_API",
    destinationName: "https://partner.example/import",
    content: "Atlas launches in Q4 with enterprise floor pricing.",
  }),
});
```

## SDK Example

```ts
import {
  fingerprintSemanticSource,
  checkSemanticEgress,
} from "@cybersecurityguard/guard";

const client = { apiKey: process.env.CYBERSECURITYGUARD_API_KEY! };

await fingerprintSemanticSource(client, {
  sourceId: "email-customer-42",
  sourceType: "EMAIL",
  sensitivityLevel: "PRIVATE",
  content: "Customer ACME is negotiating renewal terms and private support issues.",
});

const check = await checkSemanticEgress(client, {
  sessionId: "agent-session-123",
  sourceIds: ["email-customer-42"],
  destinationType: "PUBLIC_OUTPUT",
  content: "ACME has renewal concerns and support problems.",
});

if (check.decision !== "ALLOW") {
  // Block, redact, or route to review before the content leaves.
}
```

## Dashboard Usage

Open `/dashboard/semantic-egress`.

The dashboard shows:

- Recent egress checks
- Semantic risk score
- Source sensitivity
- Destination type and target
- Decision and risk level
- Redacted content and findings
- Protected source fingerprints

## Security Decisions

- Exact secret to external destination returns `BLOCK`.
- Confidential or higher-sensitivity source overlap to external destination returns `BLOCK` or `REVIEW`.
- Private email/customer summary to public or external destination returns `BLOCK` or `REVIEW`.
- Internal roadmap or strategy to external destination returns `REVIEW`.
- Public content to normal output returns `ALLOW`.
- Low similarity and low sensitivity returns `ALLOW`.
- High sensitivity plus medium similarity returns `ASK_APPROVAL` or `REVIEW`.

## Common Mistakes

- Checking only regex secrets and ignoring paraphrased confidential content.
- Storing raw source text in fingerprints.
- Treating public output as an internal destination.
- Reusing a source fingerprint after sensitivity changes without refreshing it.
- Allowing external egress when source fingerprints are missing.

## Testing Examples

Run focused tests:

```bash
node_modules\.bin\tsx.cmd --test tests\semantic-egress.test.ts
```

Run the package suite:

```bash
npm test
```

## Production Notes

- Use this check before external API calls, emails, browser forms, webhooks, and public final output.
- Keep source content out of persistence; store hashes, redacted content, and fingerprints only.
- Use source IDs from lineage or RAG indexing when available.
- Route `ASK_APPROVAL` to escrow or human review.
- Block unresolved `REVIEW` decisions for high-sensitivity external destinations in stricter deployments.
