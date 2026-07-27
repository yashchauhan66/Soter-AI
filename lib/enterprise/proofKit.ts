export type ProofStatus = "READY_TO_RUN" | "NEEDS_ENVIRONMENT" | "EXTERNAL_VENDOR_REQUIRED";

export interface EnterpriseProofItem {
  id: string;
  label: string;
  status: ProofStatus;
  owner: "engineering" | "security" | "growth" | "customer";
  command?: string;
  evidencePath: string;
  passCriteria: string[];
  blocks: string[];
}

export interface ProofKitSummary {
  total: number;
  readyToRun: number;
  needsEnvironment: number;
  externalVendorRequired: number;
  readinessScore: number;
  nextActions: string[];
}

const statusWeight: Record<ProofStatus, number> = {
  READY_TO_RUN: 1,
  NEEDS_ENVIRONMENT: 0.65,
  EXTERNAL_VENDOR_REQUIRED: 0.45,
};

export const ENTERPRISE_PROOF_KIT: EnterpriseProofItem[] = [
  {
    id: "honest-benchmark",
    label: "Honest benchmark regression gate",
    status: "READY_TO_RUN",
    owner: "security",
    command: "npm run benchmark:honest && npx tsx --test tests/benchmarks/honest-benchmark.test.ts",
    evidencePath: "docs/final-enterprise-ga-baseline-results.md",
    passCriteria: ["Recall@1%FPR is at least 75%", "FPR stays within the declared budget", "Methodology is reproducible"],
    blocks: ["Security Strength", "Competitive Strength"],
  },
  {
    id: "independent-benchmark",
    label: "Independent adversarial benchmark validation",
    status: "READY_TO_RUN",
    owner: "security",
    command: "npm run benchmark:independent",
    evidencePath: "reports/INDEPENDENT-BENCHMARK-VALIDATION-2026-07-15.md",
    passCriteria: ["Dataset provenance is recorded", "Samples or full corpora are clearly labeled", "Results avoid third-party certification claims"],
    blocks: ["Security Strength", "Competitive Strength", "Enterprise Readiness"],
  },
  {
    id: "external-pentest",
    label: "External pentest vendor package",
    status: "EXTERNAL_VENDOR_REQUIRED",
    owner: "security",
    evidencePath: "docs/security/third-party-pentest-ready-pack.md",
    passCriteria: ["Scope is written", "Test accounts are prepared", "Findings have severity, owner, due date, and remediation status"],
    blocks: ["Production Readiness", "Security Strength", "Enterprise Readiness"],
  },
  {
    id: "load-proof",
    label: "Production-like load proof",
    status: "NEEDS_ENVIRONMENT",
    owner: "engineering",
    command: "npm run test:load:http",
    evidencePath: "docs/load-testing.md",
    passCriteria: ["100, 500, and 1000 concurrency runs are recorded", "p50, p95, p99, error rate, and saturation are reported", "Infrastructure profile is included"],
    blocks: ["Production Readiness", "Enterprise Readiness"],
  },
  {
    id: "razorpay-proof",
    label: "Razorpay test payment and webhook proof",
    status: "NEEDS_ENVIRONMENT",
    owner: "growth",
    command: "npm run test -- tests/billing.test.ts",
    evidencePath: "docs/razorpay-test-mode-checklist.md",
    passCriteria: ["Test payment creates an order", "Signature verification passes", "Plan activation and webhook replay are captured"],
    blocks: ["Revenue Readiness"],
  },
  {
    id: "saml-proof",
    label: "Live SAML IdP proof",
    status: "NEEDS_ENVIRONMENT",
    owner: "engineering",
    evidencePath: "docs/enterprise/okta-saml-setup-guide.md",
    passCriteria: ["SP metadata imported", "SP-initiated login succeeds", "Replay and destination checks are verified"],
    blocks: ["Enterprise Readiness", "Integration Ease"],
  },
  {
    id: "scim-proof",
    label: "Live SCIM lifecycle proof",
    status: "NEEDS_ENVIRONMENT",
    owner: "engineering",
    evidencePath: "docs/enterprise/okta-scim-setup-guide.md",
    passCriteria: ["Create, update, deactivate, and group sync are captured", "Token handling is hashed", "Tenant scope is verified"],
    blocks: ["Enterprise Readiness", "Integration Ease"],
  },
  {
    id: "tenant-isolation-proof",
    label: "Two-tenant runtime isolation proof",
    status: "NEEDS_ENVIRONMENT",
    owner: "security",
    command: "npm test",
    evidencePath: "docs/enterprise-readiness-checklist.md",
    passCriteria: ["Dashboard, API, logs, RAG, billing, webhooks, and audit paths are checked", "Cross-tenant reads fail closed", "Evidence is captured with tenant identifiers redacted"],
    blocks: ["Enterprise Readiness", "Security Strength"],
  },
  {
    id: "runtime-marketplace-proof",
    label: "Browser and VS Code runtime proof",
    status: "NEEDS_ENVIRONMENT",
    owner: "engineering",
    command: "npm run validate:marketplaces && npm run test:vscode-family",
    evidencePath: "docs/enterprise-runtime-test-report.md",
    passCriteria: ["Chrome or Edge extension is loaded from packaged build", "VS Code command works on a real workspace", "Version and screenshot evidence are recorded"],
    blocks: ["Marketplace Readiness", "User Friendliness"],
  },
  {
    id: "support-ops-proof",
    label: "Support, incident, and restore drill proof",
    status: "READY_TO_RUN",
    owner: "customer",
    evidencePath: "docs/enterprise-market-survival-plan.md",
    passCriteria: ["Escalation owner is assigned", "Incident drill has timestamps", "Restore drill result is recorded"],
    blocks: ["Production Readiness", "Market Survival", "Enterprise Readiness"],
  },
];

export function summarizeProofKit(items: EnterpriseProofItem[] = ENTERPRISE_PROOF_KIT): ProofKitSummary {
  const total = items.length;
  const readyToRun = items.filter((item) => item.status === "READY_TO_RUN").length;
  const needsEnvironment = items.filter((item) => item.status === "NEEDS_ENVIRONMENT").length;
  const externalVendorRequired = items.filter((item) => item.status === "EXTERNAL_VENDOR_REQUIRED").length;
  const rawScore = items.reduce((sum, item) => sum + statusWeight[item.status], 0);
  const readinessScore = Math.round((rawScore / total) * 100);
  const nextActions = items
    .filter((item) => item.status !== "READY_TO_RUN")
    .map((item) => `${item.label}: ${item.passCriteria[0]}`)
    .slice(0, 5);

  return { total, readyToRun, needsEnvironment, externalVendorRequired, readinessScore, nextActions };
}

export function proofKitBlocksDimension(dimension: string, items: EnterpriseProofItem[] = ENTERPRISE_PROOF_KIT): EnterpriseProofItem[] {
  return items.filter((item) => item.blocks.includes(dimension));
}
