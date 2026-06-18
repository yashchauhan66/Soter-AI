// Cross-Session Memory Poisoning Detector — pure logic (no DB, no auth).
// Detects malicious instructions stored in long-term memory that could affect
// future sessions, plus secrets/PII that must never be persisted. Reuses the
// shared guard analyzer via classifyContent.

import { createHash } from "crypto";
import { classifyContent } from "@/lib/advanced-security/lineage";

export type MemoryDecision = "ALLOW" | "BLOCK" | "REDACT" | "QUARANTINE" | "REVIEW";
export type MemoryRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type MemoryFindingType =
  | "SAFETY_OVERRIDE" | "DATA_EXFILTRATION" | "FAKE_PERMISSION" | "TOOL_HIJACK"
  | "POLICY_BYPASS" | "IDENTITY_MANIPULATION" | "HIDDEN_INSTRUCTION" | "SECRET_IN_MEMORY"
  | "PII_IN_MEMORY" | "UNKNOWN";

export interface MemoryFinding {
  findingType: MemoryFindingType;
  riskLevel: MemoryRiskLevel;
  reason: string;
  recommendedAction: string;
}

export interface MemoryAnalysis {
  decision: MemoryDecision;
  riskLevel: MemoryRiskLevel;
  reason: string;
  safeContent: string;
  findings: MemoryFinding[];
}

export function hashMemory(content: string): string {
  return createHash("sha256").update(content ?? "").digest("hex");
}

interface PoisoningRule {
  findingType: MemoryFindingType;
  riskLevel: MemoryRiskLevel;
  pattern: RegExp;
  reason: string;
  recommendedAction: string;
}

const POISONING_RULES: PoisoningRule[] = [
  {
    findingType: "SAFETY_OVERRIDE", riskLevel: "CRITICAL",
    pattern: /ignore (all )?(safety|security|previous|prior) (rules|instructions|checks)|disable (safety|security|guard|guardrails)|turn off (safety|security)|next time.*ignore/i,
    reason: "Memory instructs future sessions to ignore or disable safety rules.",
    recommendedAction: "QUARANTINE and alert an admin.",
  },
  {
    findingType: "DATA_EXFILTRATION", riskLevel: "CRITICAL",
    pattern: /(send|upload|forward|exfiltrate|leak).*(files?|data|documents?|secrets?).*(to|later|attacker|external)|always send.*(to|http)/i,
    reason: "Memory instructs the agent to exfiltrate data to an external destination.",
    recommendedAction: "QUARANTINE and alert an admin.",
  },
  {
    findingType: "FAKE_PERMISSION", riskLevel: "HIGH",
    pattern: /user (approved|consented|authorized|allowed).*(shar|send|api key|secret|payment|delete)|the user said it.?s ok|pre.?approved/i,
    reason: "Memory fabricates user consent or permission for a sensitive action.",
    recommendedAction: "QUARANTINE; require fresh, explicit consent.",
  },
  {
    findingType: "TOOL_HIJACK", riskLevel: "CRITICAL",
    pattern: /use (this|the) (malicious|new|untrusted) (mcp|tool|server)|route (all )?(calls|requests) (through|to)|replace.*tool.*with/i,
    reason: "Memory tries to redirect the agent to a malicious or unapproved tool.",
    recommendedAction: "QUARANTINE and scan the referenced tool.",
  },
  {
    findingType: "POLICY_BYPASS", riskLevel: "CRITICAL",
    pattern: /never (ask|require) (for )?approval|skip (approval|review|the guard)|bypass (policy|the firewall|approval)|stop checking/i,
    reason: "Memory tries to disable approvals or bypass policy in future sessions.",
    recommendedAction: "QUARANTINE and alert an admin.",
  },
  {
    findingType: "IDENTITY_MANIPULATION", riskLevel: "HIGH",
    pattern: /you are (now )?(an? )?(admin|root|developer|unrestricted|dan)|your (new )?(role|identity) is|act as (the )?(owner|administrator)/i,
    reason: "Memory silently changes the agent's identity, role, or permission level.",
    recommendedAction: "QUARANTINE; identity changes must not come from memory.",
  },
  {
    findingType: "HIDDEN_INSTRUCTION", riskLevel: "HIGH",
    pattern: /<!--|​|‌|‍|base64|atob\(|display:\s*none|font-size:\s*0|white-on-white|hidden instruction/i,
    reason: "Memory contains hidden or obfuscated instructions.",
    recommendedAction: "REVIEW before allowing; likely QUARANTINE.",
  },
];

const RISK_ORDER: Record<MemoryRiskLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

function maxRisk(levels: MemoryRiskLevel[]): MemoryRiskLevel {
  return levels.reduce<MemoryRiskLevel>((max, level) => RISK_ORDER[level] > RISK_ORDER[max] ? level : max, "LOW");
}

export function analyzeMemoryContent(content: string, _memoryType?: string): MemoryAnalysis {
  const text = content ?? "";
  const classified = classifyContent(text);
  const findings: MemoryFinding[] = [];

  for (const rule of POISONING_RULES) {
    if (rule.pattern.test(text)) {
      findings.push({ findingType: rule.findingType, riskLevel: rule.riskLevel, reason: rule.reason, recommendedAction: rule.recommendedAction });
    }
  }

  // Secrets must never be stored in memory.
  if (classified.hasSecret) {
    findings.push({ findingType: "SECRET_IN_MEMORY", riskLevel: "CRITICAL", reason: "Secret or credential detected in memory content.", recommendedAction: "BLOCK or store redacted only." });
  }
  if (classified.hasPii || classified.hasIndiaPii) {
    findings.push({ findingType: "PII_IN_MEMORY", riskLevel: classified.hasIndiaPii ? "HIGH" : "MEDIUM", reason: "Personal data detected in memory content.", recommendedAction: "Redact before storing or hold for review." });
  }

  // Decision: poisoning patterns quarantine; secrets block; PII redacts.
  const poisoningTypes: MemoryFindingType[] = ["SAFETY_OVERRIDE", "DATA_EXFILTRATION", "FAKE_PERMISSION", "TOOL_HIJACK", "POLICY_BYPASS", "IDENTITY_MANIPULATION"];
  const hasPoisoning = findings.some((finding) => poisoningTypes.includes(finding.findingType));
  const hasHidden = findings.some((finding) => finding.findingType === "HIDDEN_INSTRUCTION");

  let decision: MemoryDecision = "ALLOW";
  let reason = "Memory content is a normal preference or fact.";
  if (hasPoisoning) {
    decision = "QUARANTINE";
    reason = findings.find((finding) => poisoningTypes.includes(finding.findingType))!.reason;
  } else if (classified.hasSecret) {
    decision = "BLOCK";
    reason = "Secret or credential must not be stored in agent memory.";
  } else if (hasHidden) {
    decision = "REVIEW";
    reason = "Memory contains hidden or obfuscated instructions and needs review.";
  } else if (classified.hasIndiaPii) {
    decision = "REVIEW";
    reason = "Regulated personal identifier detected; hold for review before storing.";
  } else if (classified.hasPii) {
    decision = "REDACT";
    reason = "Personal data was redacted before the memory was stored.";
  }

  const riskLevel = findings.length > 0 ? maxRisk(findings.map((finding) => finding.riskLevel)) : "LOW";
  return { decision, riskLevel, reason, safeContent: classified.safeContent, findings };
}

export interface MemoryDiff {
  riskIncreased: boolean;
  addedInstruction: boolean;
  addedToolPermission: boolean;
  addedExternalDomain: boolean;
  addedHiddenInstruction: boolean;
}

export function diffMemory(oldContent: string, newContent: string): MemoryDiff {
  const before = analyzeMemoryContent(oldContent);
  const after = analyzeMemoryContent(newContent);
  const oldText = oldContent ?? "";
  const newText = newContent ?? "";
  const domainPattern = /\b(?:https?:\/\/)?[a-z0-9-]+\.(?:com|net|org|io|co|ai|dev|xyz|info|ru|cn|app|cloud)\b/gi;
  const newDomains = (newText.match(domainPattern) ?? []).filter((domain) => !oldText.includes(domain));
  return {
    riskIncreased: RISK_ORDER[after.riskLevel] > RISK_ORDER[before.riskLevel],
    addedInstruction: /\b(always|never|next time|from now|whenever)\b/i.test(newText) && !/\b(always|never|next time|from now|whenever)\b/i.test(oldText),
    addedToolPermission: after.findings.some((finding) => finding.findingType === "TOOL_HIJACK" || finding.findingType === "FAKE_PERMISSION") && !before.findings.some((finding) => finding.findingType === "TOOL_HIJACK" || finding.findingType === "FAKE_PERMISSION"),
    addedExternalDomain: newDomains.length > 0,
    addedHiddenInstruction: after.findings.some((finding) => finding.findingType === "HIDDEN_INSTRUCTION") && !before.findings.some((finding) => finding.findingType === "HIDDEN_INSTRUCTION"),
  };
}
