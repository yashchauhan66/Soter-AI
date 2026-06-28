import type { ComplianceEvidenceStatus, ComplianceEvidenceType } from "@/lib/evidence-vault";

export type AssuranceStatus = "PASS" | "WARNING" | "FAIL" | "STALE" | "MISSING";

export interface AssuranceEvidence {
  id: string;
  evidenceType: ComplianceEvidenceType | string;
  controlName: string;
  status: ComplianceEvidenceStatus | string;
  riskLevel?: string | null;
  contentHash?: string | null;
  createdAt: Date | string;
}

export interface AssuranceControlDefinition {
  id: string;
  name: string;
  description: string;
  weight: number;
  evidenceGroups: ComplianceEvidenceType[][];
  frameworks: Record<string, string[]>;
}

export const AI_CONTROL_CATALOG: AssuranceControlDefinition[] = [
  {
    id: "AI-CTRL-01",
    name: "Runtime input and output protection",
    description: "Runtime decisions demonstrate that configured AI guard policies are operating.",
    weight: 20,
    evidenceGroups: [["POLICY"], ["GUARD_DECISION"]],
    frameworks: { EU_AI_ACT: ["Article 9", "Article 15"], NIST_AI_RMF: ["GOVERN 1.7", "MANAGE 2.4"], ISO_42001: ["Operational controls", "Monitoring"] },
  },
  {
    id: "AI-CTRL-02",
    name: "Sensitive-data protection",
    description: "Sensitive data is identified, minimized, redacted, and protected across AI data flows.",
    weight: 18,
    evidenceGroups: [["REDACTION", "DATA_FLOW"]],
    frameworks: { EU_AI_ACT: ["Article 10", "Article 15"], NIST_AI_RMF: ["MAP 2.3", "MANAGE 2.2"], ISO_42001: ["Data for AI systems", "Information security"] },
  },
  {
    id: "AI-CTRL-03",
    name: "Agent identity and human authorization",
    description: "Agent actions are bound to an identity and elevated actions have reviewable authorization evidence.",
    weight: 18,
    evidenceGroups: [["AGENT_PASSPORT"], ["APPROVAL"]],
    frameworks: { EU_AI_ACT: ["Article 14", "Article 15"], NIST_AI_RMF: ["GOVERN 2.1", "MANAGE 2.4"], ISO_42001: ["Roles and responsibilities", "Human oversight"] },
  },
  {
    id: "AI-CTRL-04",
    name: "Authorization-aware retrieval",
    description: "RAG sources are scanned and retrieval remains constrained by tenant and access policy.",
    weight: 16,
    evidenceGroups: [["RAG_SCAN"], ["DATA_FLOW", "POLICY"]],
    frameworks: { EU_AI_ACT: ["Article 10", "Article 12"], NIST_AI_RMF: ["MAP 3.5", "MEASURE 2.6"], ISO_42001: ["Data management", "Operation"] },
  },
  {
    id: "AI-CTRL-05",
    name: "Traceability and incident response",
    description: "Security events and incidents are traceable, integrity-checkable, and reviewable.",
    weight: 16,
    evidenceGroups: [["INCIDENT", "CANARY", "TOOL_CHAIN"]],
    frameworks: { EU_AI_ACT: ["Article 12", "Article 72"], NIST_AI_RMF: ["MEASURE 2.5", "MANAGE 4.1"], ISO_42001: ["Monitoring", "Incident management"] },
  },
  {
    id: "AI-CTRL-06",
    name: "Continuous security validation",
    description: "Adversarial testing and security validation are repeated and retained as evidence.",
    weight: 12,
    evidenceGroups: [["RED_TEAM"]],
    frameworks: { EU_AI_ACT: ["Article 9", "Article 15"], NIST_AI_RMF: ["MEASURE 1.1", "MEASURE 2.7"], ISO_42001: ["Performance evaluation", "Continual improvement"] },
  },
];

export function evaluateContinuousAssurance(input: {
  evidence: AssuranceEvidence[];
  now?: Date;
  freshnessDays?: number;
  controls?: AssuranceControlDefinition[];
}) {
  const now = input.now ?? new Date();
  const freshnessDays = Math.max(1, Math.min(365, input.freshnessDays ?? 30));
  const cutoff = now.getTime() - freshnessDays * 86_400_000;
  const controls = (input.controls ?? AI_CONTROL_CATALOG).map((control) => evaluateControl(control, input.evidence, cutoff));
  const totalWeight = controls.reduce((sum, control) => sum + control.weight, 0) || 1;
  const earnedWeight = controls.reduce((sum, control) => sum + control.weight * statusFactor(control.status), 0);
  const assuranceScore = Math.round((earnedWeight / totalWeight) * 100);
  const frameworkCoverage = buildFrameworkCoverage(controls);
  const failed = controls.filter((control) => control.status === "FAIL").length;
  const missingOrStale = controls.filter((control) => control.status === "MISSING" || control.status === "STALE").length;

  return {
    format: "soter.continuous-assurance.v1",
    generatedAt: now.toISOString(),
    freshnessDays,
    assuranceScore,
    overallStatus: failed > 0 ? "FAIL" : missingOrStale > 0 ? "WARNING" : assuranceScore === 100 ? "PASS" : "WARNING",
    summary: {
      totalControls: controls.length,
      passing: controls.filter((control) => control.status === "PASS").length,
      warning: controls.filter((control) => control.status === "WARNING").length,
      failed,
      stale: controls.filter((control) => control.status === "STALE").length,
      missing: controls.filter((control) => control.status === "MISSING").length,
    },
    controls,
    frameworkCoverage,
    disclaimer: "This is control-assurance evidence, not legal advice, certification, or a guarantee of regulatory compliance.",
  };
}

function evaluateControl(control: AssuranceControlDefinition, evidence: AssuranceEvidence[], cutoff: number) {
  const relevantTypes = new Set(control.evidenceGroups.flat());
  const relevant = evidence.filter((item) => relevantTypes.has(item.evidenceType as ComplianceEvidenceType));
  const fresh = relevant.filter((item) => new Date(item.createdAt).getTime() >= cutoff);
  const failed = fresh.filter((item) => item.status === "FAIL" || item.riskLevel === "CRITICAL");
  const warned = fresh.filter((item) => item.status === "WARNING" || item.riskLevel === "HIGH");
  const satisfiedGroups = control.evidenceGroups.filter((group) => group.some((type) => fresh.some((item) => item.evidenceType === type && isPositive(item.status))));

  let status: AssuranceStatus;
  if (failed.length) status = "FAIL";
  else if (!relevant.length) status = "MISSING";
  else if (!fresh.length) status = "STALE";
  else if (satisfiedGroups.length < control.evidenceGroups.length) status = "WARNING";
  else if (warned.length) status = "WARNING";
  else status = "PASS";

  return {
    ...control,
    status,
    evidenceIds: fresh.map((item) => item.id),
    latestEvidenceAt: newest(relevant),
    missingEvidenceGroups: control.evidenceGroups.filter((group) => !group.some((type) => fresh.some((item) => item.evidenceType === type && isPositive(item.status)))),
    failedEvidenceIds: failed.map((item) => item.id),
  };
}

function buildFrameworkCoverage(controls: Array<ReturnType<typeof evaluateControl>>) {
  const frameworks = new Map<string, { mappedControls: Set<string>; passingControls: Set<string>; references: Set<string> }>();
  for (const control of controls) {
    for (const [framework, references] of Object.entries(control.frameworks)) {
      const item = frameworks.get(framework) ?? { mappedControls: new Set<string>(), passingControls: new Set<string>(), references: new Set<string>() };
      item.mappedControls.add(control.id);
      if (control.status === "PASS") item.passingControls.add(control.id);
      references.forEach((reference) => item.references.add(reference));
      frameworks.set(framework, item);
    }
  }
  return Object.fromEntries([...frameworks].map(([framework, item]) => [framework, {
    mappedControls: item.mappedControls.size,
    passingControls: item.passingControls.size,
    evidenceCoveragePercent: item.mappedControls.size ? Math.round(item.passingControls.size / item.mappedControls.size * 100) : 0,
    references: [...item.references],
  }]));
}

function isPositive(status: string) {
  return status === "PASS" || status === "ACTIVE" || status === "RESOLVED";
}

function newest(evidence: AssuranceEvidence[]) {
  if (!evidence.length) return null;
  return evidence.map((item) => new Date(item.createdAt)).filter((date) => Number.isFinite(date.getTime())).sort((a, b) => b.getTime() - a.getTime())[0]?.toISOString() ?? null;
}

function statusFactor(status: AssuranceStatus) {
  if (status === "PASS") return 1;
  if (status === "WARNING") return 0.5;
  if (status === "STALE") return 0.25;
  return 0;
}
