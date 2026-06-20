# AI Compliance Evidence Vault

AI Compliance Evidence Vault packages proof that cybersecurityguard controls are enabled and working. It stores redacted evidence items, generates customer/audit-ready reports, and exports signed-style JSON evidence packages with content hashes.

## What It Does

- Collects evidence for policies, guard decisions, redactions, approvals, incidents, RAG scans, agent passports, tool-chain findings, canary leaks, red-team runs, data-flow decisions, cost controls, and custom controls.
- Stores only redacted summaries, safe metadata, hashes, statuses, risk labels, and report JSON.
- Generates security posture, incident summary, customer trust, audit export, and AI risk review reports.
- Exports report packages without raw secrets.
- Keeps all reads and writes project scoped.

## Why It Matters

Security teams need proof, not just controls. Evidence Vault helps answer customer and auditor questions about what was enabled, what was blocked, what was redacted, what required approval, and what risks remain.

## API Example

Collect a manual evidence item:

```ts
await fetch("/api/evidence/collect", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.CYBERSECURITYGUARD_API_KEY!,
  },
  body: JSON.stringify({
    evidenceType: "GUARD_DECISION",
    title: "Prompt injection blocked",
    summary: "The input guard blocked a prompt injection attempt.",
    controlName: "Prompt and output guard",
    status: "PASS",
    riskLevel: "HIGH",
    evidence: {
      decision: "BLOCK",
      riskTypes: ["PROMPT_INJECTION"],
    },
  }),
});
```

Auto-collect available evidence:

```ts
await fetch("/api/evidence/collect", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.CYBERSECURITYGUARD_API_KEY!,
  },
  body: JSON.stringify({
    autoCollect: true,
    include: ["POLICY", "GUARD_DECISION", "REDACTION", "APPROVAL"],
  }),
});
```

Generate and export a report:

```ts
const generated = await fetch("/api/evidence/report/generate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": process.env.CYBERSECURITYGUARD_API_KEY!,
  },
  body: JSON.stringify({
    reportName: "Customer trust package",
    reportType: "CUSTOMER_TRUST",
  }),
});
```

## SDK Example

```ts
import {
  collectComplianceEvidence,
  generateEvidenceReport,
  exportEvidenceReport,
} from "@cybersecurityguard/guard";

const client = { apiKey: process.env.CYBERSECURITYGUARD_API_KEY! };

await collectComplianceEvidence(client, {
  autoCollect: true,
  include: ["POLICY", "GUARD_DECISION", "AGENT_PASSPORT", "TOOL_CHAIN"],
});

const report = await generateEvidenceReport(client, {
  reportName: "AI security posture",
  reportType: "SECURITY_POSTURE",
});

await exportEvidenceReport(client, report.report.id);
```

## Dashboard Usage

Open `/dashboard/evidence-vault`.

The dashboard shows:

- Evidence items
- Control coverage
- Status and risk metrics
- Redacted evidence details
- Generated reports
- Export status

## Security Decisions

- Evidence is redacted before storage.
- Secret-like keys such as token, password, API key, cookie, and private key are replaced.
- Report exports include content hashes, not raw prompts or raw secrets.
- Project-scoped SQL is required for every item and report read.
- PDF export is optional; JSON export is always available.

## Common Mistakes

- Copying raw incident text into evidence metadata.
- Sharing evidence before resolving failed or critical controls.
- Treating auto-collected counts as a replacement for provider-specific audit evidence.
- Forgetting approval evidence for high-risk agent actions.
- Mixing evidence across projects or customers.

## Testing Examples

Run focused tests:

```bash
node_modules\.bin\tsx.cmd --test tests\evidence-vault.test.ts
```

Run the package suite:

```bash
npm test
```

## Production Notes

- Use auto-collect for periodic posture snapshots.
- Attach manual evidence for customer-specific audits.
- Generate a fresh report for each customer trust review.
- Export JSON packages for audit trails.
- Keep PDF export behind the existing report pipeline if enabled for the project.
