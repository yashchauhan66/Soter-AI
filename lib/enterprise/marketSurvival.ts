export type EvidenceState = "VERIFIED" | "PARTIAL" | "EVIDENCE_REQUIRED" | "BLOCKED";

export interface SurvivalGate {
  id: string;
  label: string;
  weight: number;
  state: EvidenceState;
  proof: string;
  blocker?: string;
}

export interface SurvivalScore {
  score: number;
  maxScore: number;
  grade: "ENTERPRISE_READY" | "PILOT_READY" | "CONTROLLED_BETA" | "NO_GO";
  hardBlockers: SurvivalGate[];
  requiredNextProof: string[];
}

const stateMultiplier: Record<EvidenceState, number> = {
  VERIFIED: 1,
  PARTIAL: 0.55,
  EVIDENCE_REQUIRED: 0.25,
  BLOCKED: 0,
};

export const ENTERPRISE_SURVIVAL_GATES: SurvivalGate[] = [
  {
    id: "security-benchmark",
    label: "Honest security benchmark gate",
    weight: 15,
    state: "VERIFIED",
    proof: "Local honest benchmark and market leadership security tests pass.",
  },
  {
    id: "independent-validation",
    label: "Independent adversarial validation",
    weight: 12,
    state: "PARTIAL",
    proof: "Representative external-style validation exists; full authorized corpora still required.",
    blocker: "Run full JailbreakBench/HarmBench/PINT style corpora with clear licenses.",
  },
  {
    id: "external-pentest",
    label: "External pentest and remediation summary",
    weight: 12,
    state: "EVIDENCE_REQUIRED",
    proof: "No third-party pentest artifact can be generated from local code alone.",
    blocker: "Complete scoped third-party pentest and publish remediation summary.",
  },
  {
    id: "load-proof",
    label: "Production-like load proof",
    weight: 10,
    state: "EVIDENCE_REQUIRED",
    proof: "Local tests pass; deployed 100/500/1000 concurrency proof is still required.",
    blocker: "Run load tests on production-like infrastructure with p50/p95/p99 and error budget.",
  },
  {
    id: "enterprise-runtime",
    label: "Live enterprise runtime proof",
    weight: 14,
    state: "EVIDENCE_REQUIRED",
    proof: "SAML/SCIM/payment/runtime code paths exist; live IdP/payment/two-tenant/browser/VS Code evidence required.",
    blocker: "Verify Razorpay test payment, SAML, SCIM, tenant isolation, browser runtime, and VS Code runtime.",
  },
  {
    id: "buyer-onboarding",
    label: "Buyer onboarding and integration ease",
    weight: 9,
    state: "VERIFIED",
    proof: "Quickstart, API reference, integration wizard, webhooks, and integration-ease tests pass.",
  },
  {
    id: "customer-proof",
    label: "Customer proof and repeatable pilot motion",
    weight: 12,
    state: "EVIDENCE_REQUIRED",
    proof: "Pilot telemetry and case-study templates exist; signed customer proof is not in repo.",
    blocker: "Close at least one paid pilot or three serious design partners with written success criteria.",
  },
  {
    id: "support-ops",
    label: "Support, incident, and SLA operations",
    weight: 8,
    state: "PARTIAL",
    proof: "Runbooks and SLA drafts exist; real on-call, paging, and incident drill proof is pending.",
    blocker: "Run incident drill, restore drill, and publish support escalation ownership.",
  },
  {
    id: "claims-control",
    label: "Claims control and competitive trust",
    weight: 8,
    state: "VERIFIED",
    proof: "Evidence-gated scorecard and claim restrictions exist.",
  },
];

export function scoreSurvivalGates(gates: SurvivalGate[] = ENTERPRISE_SURVIVAL_GATES): SurvivalScore {
  const maxScore = gates.reduce((sum, gate) => sum + gate.weight, 0);
  const rawScore = gates.reduce((sum, gate) => sum + gate.weight * stateMultiplier[gate.state], 0);
  const score = Math.round((rawScore / maxScore) * 100);
  const hardBlockers = gates.filter((gate) => gate.state === "BLOCKED" || gate.state === "EVIDENCE_REQUIRED");
  const requiredNextProof = gates
    .filter((gate) => gate.blocker)
    .sort((a, b) => b.weight - a.weight)
    .map((gate) => gate.blocker!)
    .slice(0, 5);

  let grade: SurvivalScore["grade"] = "NO_GO";
  if (score >= 90 && hardBlockers.length === 0) grade = "ENTERPRISE_READY";
  else if (score >= 75 && hardBlockers.length <= 2) grade = "PILOT_READY";
  else if (score >= 55) grade = "CONTROLLED_BETA";

  return { score, maxScore, grade, hardBlockers, requiredNextProof };
}

export function canClaimEnterpriseGA(gates: SurvivalGate[] = ENTERPRISE_SURVIVAL_GATES): boolean {
  return gates.every((gate) => gate.state === "VERIFIED") && scoreSurvivalGates(gates).score >= 90;
}

export function summarizeSurvivalPosition(gates: SurvivalGate[] = ENTERPRISE_SURVIVAL_GATES): string {
  const result = scoreSurvivalGates(gates);
  if (result.grade === "ENTERPRISE_READY") return "Enterprise GA claim allowed with current evidence.";
  if (result.grade === "PILOT_READY") return "Paid pilot ready; enterprise GA claim remains evidence-gated.";
  if (result.grade === "CONTROLLED_BETA") return "Controlled beta ready; market survival depends on external proof and paid pilots.";
  return "No-go for enterprise buyers until P0 evidence gates close.";
}
