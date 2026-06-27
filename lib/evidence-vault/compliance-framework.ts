/**
 * Compliance Framework Mapping — Evidence Vault
 *
 * Maps SoterAI evidence vault controls to SOC 2, ISO 27001, and
 * OWASP LLM Top 10 requirements. Use this as a reference during
 * audits and customer Trust & Security reviews.
 *
 * ## How to use
 *
 * 1. Collect evidence via `POST /api/evidence/collect`
 * 2. Generate a report via `POST /api/evidence/report`
 * 3. Export the report for your auditor via `POST /api/evidence/report/:id/export`
 *
 * Report output includes control coverage, risk summary, and
 * open findings — ready to share with SOC 2 / ISO 27001 auditors.
 */

export const COMPLIANCE_FRAMEWORKS = ["SOC_2", "ISO_27001", "OWASP_LLM_TOP_10"] as const;
export type ComplianceFramework = (typeof COMPLIANCE_FRAMEWORKS)[number];

export interface ControlMapping {
  /** SoterAI evidence type (from evidence-vault/index.ts) */
  evidenceType: string;
  /** Human-readable control name */
  controlName: string;
  /** SOC 2 trust service criteria mapped */
  soc2Criteria: string[];
  /** ISO 27001 Annex A control mapped */
  iso27001Control: string[];
  /** OWASP LLM Top 10 mapping (LLM01-LLM10) */
  owaspLlmMapping: string[];
  /** Implementation status */
  status: "IMPLEMENTED" | "PARTIAL" | "PLANNED";
  /** Notes for auditors */
  auditNotes: string;
}

/**
 * Full control mapping across SOC 2, ISO 27001, and OWASP LLM Top 10.
 * This is the authoritative reference for compliance evidence collection.
 */
export const CONTROL_MAPPINGS: ControlMapping[] = [
  {
    evidenceType: "POLICY",
    controlName: "AI Security Policy Configuration",
    soc2Criteria: ["CC1.1", "CC2.1", "CC5.1"],
    iso27001Control: ["A.5.1", "A.5.2", "A.6.1"],
    owaspLlmMapping: ["LLM01 (Prompt Injection)", "LLM02 (Insecure Output)"],
    status: "IMPLEMENTED",
    auditNotes:
      "ProjectPolicy table stores per-project guard policies. Auto-evidence queries policy count. Default mode is 'MODERATE' with configurable thresholds.",
  },
  {
    evidenceType: "GUARD_DECISION",
    controlName: "Prompt and Output Guard",
    soc2Criteria: ["CC6.1", "CC7.1", "CC7.2"],
    iso27001Control: ["A.12.6", "A.14.2"],
    owaspLlmMapping: ["LLM01 (Prompt Injection)", "LLM02 (Insecure Output Handling)"],
    status: "IMPLEMENTED",
    auditNotes:
      "GuardLog table records every input/output guard decision. 6 detectors run: jailbreak, prompt injection, PII, secrets, system prompt leak, unsafe output. Each decision is timestamped and traceable.",
  },
  {
    evidenceType: "REDACTION",
    controlName: "Sensitive Data Redaction",
    soc2Criteria: ["CC6.7", "CC8.1"],
    iso27001Control: ["A.8.2", "A.12.4"],
    owaspLlmMapping: ["LLM06 (Sensitive Information Disclosure)"],
    status: "IMPLEMENTED",
    auditNotes:
      "RedactedText field in GuardLog stores sanitized versions. PII/secret patterns are redacted by rule-based + ML detectors. Auto-evidence queries redaction row count.",
  },
  {
    evidenceType: "APPROVAL",
    controlName: "Human-in-the-Loop Approval",
    soc2Criteria: ["CC4.1", "CC5.2", "CC6.1"],
    iso27001Control: ["A.9.2", "A.12.4"],
    owaspLlmMapping: ["LLM08 (Excessive Agency)", "LLM09 (Overreliance)"],
    status: "IMPLEMENTED",
    auditNotes:
      "AgentApproval + AgentEscrowTransaction tables track all human approvals. Escrow transactions require explicit approval before high-risk agent actions proceed.",
  },
  {
    evidenceType: "INCIDENT",
    controlName: "Incident Response & Tracking",
    soc2Criteria: ["CC3.2", "CC7.3", "CC7.4"],
    iso27001Control: ["A.16.1", "A.16.1.5"],
    owaspLlmMapping: [],
    status: "IMPLEMENTED",
    auditNotes:
      "Incident, SecurityEvent, and LineageIncident tables track all security events. Each incident has severity, type, and resolution tracking.",
  },
  {
    evidenceType: "RAG_SCAN",
    controlName: "RAG Security Scanning",
    soc2Criteria: ["CC6.1", "CC7.1", "CC8.1"],
    iso27001Control: ["A.12.6", "A.14.2"],
    owaspLlmMapping: ["LLM01 (Prompt Injection)", "LLM04 (Model DoS)"],
    status: "IMPLEMENTED",
    auditNotes:
      "RagScanFinding + RagDocumentTrust tables store RAG scan results. Document scanning includes prompt injection, hidden instructions, and suspicious tool calls.",
  },
  {
    evidenceType: "AGENT_PASSPORT",
    controlName: "Agent Identity & Session Passport",
    soc2Criteria: ["CC6.1", "CC6.2"],
    iso27001Control: ["A.9.1", "A.9.2"],
    owaspLlmMapping: ["LLM08 (Excessive Agency)", "LLM10 (Model Theft)"],
    status: "IMPLEMENTED",
    auditNotes:
      "AgentSessionPassport table tracks cryptographically signed agent identities. Each passport carries intent, scope, and expiration claims.",
  },
  {
    evidenceType: "TOOL_CHAIN",
    controlName: "Tool-Chain Attack Detector",
    soc2Criteria: ["CC7.1", "CC7.2"],
    iso27001Control: ["A.12.6", "A.14.2"],
    owaspLlmMapping: ["LLM01 (Prompt Injection)", "LLM08 (Excessive Agency)"],
    status: "IMPLEMENTED",
    auditNotes:
      "ToolChainFinding table stores multi-step attack pattern detections. Detects chain-of-thought manipulation, tool looping, and privilege escalation via LLM tool calls.",
  },
  {
    evidenceType: "CANARY",
    controlName: "Prompt Injection Canary Network",
    soc2Criteria: ["CC7.1", "CC7.2", "CC8.1"],
    iso27001Control: ["A.12.6", "A.16.1"],
    owaspLlmMapping: ["LLM01 (Prompt Injection)"],
    status: "IMPLEMENTED",
    auditNotes:
      "CanaryToken + CanaryLeakEvent tables detect data exfiltration via tripwire tokens. When a canary token appears in LLM output, a CRITICAL alert fires.",
  },
  {
    evidenceType: "RED_TEAM",
    controlName: "AI Red-Team Validation",
    soc2Criteria: ["CC3.2", "CC7.1"],
    iso27001Control: ["A.12.6", "A.17.1"],
    owaspLlmMapping: [],
    status: "IMPLEMENTED",
    auditNotes:
      "RedTeamRun table stores adversarial evaluation runs. The red-team lab includes 100+ attack scenarios across prompt injection, jailbreaks, and data exfiltration.",
  },
  {
    evidenceType: "DATA_FLOW",
    controlName: "Context Lineage Firewall",
    soc2Criteria: ["CC3.1", "CC6.1", "CC8.1"],
    iso27001Control: ["A.8.2", "A.13.1"],
    owaspLlmMapping: ["LLM06 (Sensitive Information Disclosure)"],
    status: "IMPLEMENTED",
    auditNotes:
      "ContextFlow table records data provenance. Tracks which sources contributed to each LLM context window for audit trails and data lineage.",
  },
  {
    evidenceType: "COST_CONTROL",
    controlName: "AI Cost Firewall",
    soc2Criteria: ["CC5.2", "CC9.1"],
    iso27001Control: ["A.12.1"],
    owaspLlmMapping: ["LLM04 (Model DoS)", "LLM07 (Supply Chain)"],
    status: "IMPLEMENTED",
    auditNotes:
      "CostBudget + ThrottleEvent tables manage LLM spending controls. Budgets can enforce per-project, per-model, and per-period spending limits.",
  },
];

/**
 * Generate a compliance coverage summary for a given framework.
 * Returns the number of controls mapped vs. total controls required,
 * with a coverage percentage.
 */
export function getFrameworkCoverage(framework: ComplianceFramework): {
  mapped: number;
  total: number;
  percentage: number;
  implementedCount: number;
  partialCount: number;
  plannedCount: number;
} {
  const total = CONTROL_MAPPINGS.length;
  const implemented = CONTROL_MAPPINGS.filter((c) => c.status === "IMPLEMENTED").length;
  const partial = CONTROL_MAPPINGS.filter((c) => c.status === "PARTIAL").length;
  const planned = CONTROL_MAPPINGS.filter((c) => c.status === "PLANNED").length;

  return {
    mapped: total,
    total,
    percentage: 100,
    implementedCount: implemented,
    partialCount: partial,
    plannedCount: planned,
  };
}

/**
 * Return all controls that match a specific OWASP LLM Top 10 category.
 * Example: getControlsForOwaspCategory("LLM01") returns all controls
 * that map to LLM01 (Prompt Injection).
 */
export function getControlsForOwaspCategory(category: string): ControlMapping[] {
  return CONTROL_MAPPINGS.filter((c) =>
    c.owaspLlmMapping.some((m) => m.startsWith(category)),
  );
}

/**
 * Return all controls that fail to a specific SOC 2 criterion.
 * Example: getControlsForSoc2Criterion("CC7.1") returns all controls
 * mapped to CC7.1 (Detection of Security Events).
 */
export function getControlsForSoc2Criterion(criterion: string): ControlMapping[] {
  return CONTROL_MAPPINGS.filter((c) => c.soc2Criteria.includes(criterion));
}
