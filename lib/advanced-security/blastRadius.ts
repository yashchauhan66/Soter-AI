// Agent Blast Radius Simulator — pure scoring logic (no DB, no auth).
// Calculates how much damage an AI agent could do if compromised, based on its
// tools, permissions, data sources, destinations, memory access, and policies.

export type BlastRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface BlastRadiusDataSource {
  type: string;
  sensitivity?: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "SECRET" | "REGULATED";
}

export interface BlastRadiusInput {
  agentName?: string;
  agentType?: string;
  tools?: string[];
  permissions?: Record<string, string>;
  dataSources?: BlastRadiusDataSource[];
  externalDestinations?: string[];
  memoryAccess?: { longTermMemory?: boolean; projectMemory?: boolean };
  policies?: {
    secretsBlocked?: boolean;
    terminalBlocked?: boolean;
    fileAccessWorkspaceLimited?: boolean;
    externalDomainsAllowlisted?: boolean;
    memoryFirewallEnabled?: boolean;
    lineageFirewallEnabled?: boolean;
    auditEnabled?: boolean;
    dataEgressPolicy?: boolean;
  };
}

export interface BlastRadiusResult {
  blastRadiusScore: number;
  riskLevel: BlastRiskLevel;
  findings: string[];
  recommendations: string[];
  scenarioResults: BlastRadiusScenarioResult[];
}

export interface BlastRadiusScenarioResult {
  scenarioName: string;
  blastRadiusScore: number;
  riskLevel: BlastRiskLevel;
  narrative: string;
}

interface ToolCapability {
  match: RegExp;
  weight: number;
  finding: string;
  recommendation: string;
}

const TOOL_CAPABILITIES: ToolCapability[] = [
  { match: /terminal|shell|exec|command|bash|powershell/i, weight: 30, finding: "Agent can execute terminal commands", recommendation: "Block terminal execution for this agent" },
  { match: /credential|secret|token|vault|\.env|password|auth[_.]?token/i, weight: 35, finding: "Agent can access credentials or secrets", recommendation: "Remove credential access and route secrets through the vault" },
  { match: /\.delete|delete[_.]|remove[_.]|unlink|rm\b/i, weight: 25, finding: "Agent can delete files or records", recommendation: "Block delete operations or require approval" },
  { match: /payment|charge|checkout|purchase|pay\b|upi|billing/i, weight: 25, finding: "Agent can perform payments or purchases", recommendation: "Require human takeover for payment actions" },
  { match: /database|sql|\.update|\.write|\.insert|crm\.update/i, weight: 20, finding: "Agent can write or update databases", recommendation: "Limit database access to read-only" },
  { match: /(gmail|email|mail)\.send|send[_.]?email|smtp/i, weight: 15, finding: "Agent can send external email", recommendation: "Require approval for outbound email" },
  { match: /browser.*submit|submit[_.]?form|form\.submit/i, weight: 15, finding: "Agent can submit browser forms", recommendation: "Require approval for browser form submission" },
  { match: /mcp|external[_.]?post|webhook|upload/i, weight: 15, finding: "Agent can call external/unknown tools or post externally", recommendation: "Allowlist external destinations and scan MCP tools" },
  { match: /file.*read|filesystem\.read|fs\.read/i, weight: 10, finding: "Agent can read local files", recommendation: "Limit file access to an allowlisted workspace directory" },
];

const HIGH_RISK_TOOL = /terminal|exec|credential|secret|\.delete|payment|checkout|database|\.update/i;

function classify(score: number): BlastRiskLevel {
  if (score <= 25) return "LOW";
  if (score <= 50) return "MEDIUM";
  if (score <= 75) return "HIGH";
  return "CRITICAL";
}

function permissionRequiresApproval(permissions: Record<string, string> | undefined, tool: string): boolean {
  if (!permissions) return false;
  const value = permissions[tool];
  return value === "approval_required" || value === "blocked";
}

function permissionBlocked(permissions: Record<string, string> | undefined, tool: string): boolean {
  return permissions?.[tool] === "blocked";
}

export function simulateBlastRadius(input: BlastRadiusInput): BlastRadiusResult {
  const tools = input.tools ?? [];
  const findings: string[] = [];
  const recommendations: string[] = [];
  let score = 0;

  // Tool/capability risk (skip fully-blocked tools).
  for (const capability of TOOL_CAPABILITIES) {
    const matchedTool = tools.find((tool) => capability.match.test(tool));
    if (!matchedTool || permissionBlocked(input.permissions, matchedTool)) continue;
    score += capability.weight;
    findings.push(capability.finding);
    recommendations.push(capability.recommendation);
  }

  // Confidential / regulated data exposure.
  const sensitiveSources = (input.dataSources ?? []).filter((source) =>
    source.sensitivity === "CONFIDENTIAL" || source.sensitivity === "SECRET" || source.sensitivity === "REGULATED");
  if (sensitiveSources.length > 0) {
    score += 20;
    findings.push(`Agent can read ${sensitiveSources.length} confidential/regulated data source(s)`);
  }

  // External destinations.
  if ((input.externalDestinations ?? []).length > 0) {
    score += 15;
    findings.push("Agent can reach external destinations");
    recommendations.push("Allowlist external destinations");
  }

  // Long-term / project memory access.
  if (input.memoryAccess?.longTermMemory || input.memoryAccess?.projectMemory) {
    score += 10;
    findings.push("Agent can access long-term/project memory");
    if (!input.policies?.memoryFirewallEnabled) recommendations.push("Enable the memory firewall or disable long-term memory for this agent");
  }

  // No-approval-for-high-risk penalty.
  const highRiskTools = tools.filter((tool) => HIGH_RISK_TOOL.test(tool));
  const unguardedHighRisk = highRiskTools.filter((tool) => !permissionRequiresApproval(input.permissions, tool));
  if (highRiskTools.length > 0 && unguardedHighRisk.length === highRiskTools.length) {
    score += 20;
    findings.push("High-risk tools have no approval requirement");
    recommendations.push("Require approval for high-risk tools");
  }

  // Missing controls.
  if (!input.policies?.dataEgressPolicy) { score += 20; recommendations.push("Add a data egress policy"); }
  if (!input.policies?.auditEnabled) { score += 10; recommendations.push("Enable audit logs and replay"); }

  // Risk reducers (controls in place).
  if (unguardedHighRisk.length < highRiskTools.length && highRiskTools.length > 0) score -= 15;
  if (input.policies?.secretsBlocked) score -= 20;
  if (input.policies?.terminalBlocked) score -= 25;
  if (input.policies?.fileAccessWorkspaceLimited) score -= 15;
  if (input.policies?.externalDomainsAllowlisted) score -= 10;
  if (input.policies?.memoryFirewallEnabled) score -= 10;
  if (input.policies?.lineageFirewallEnabled) score -= 15;
  if (input.policies?.auditEnabled) score -= 5;

  score = Math.max(0, Math.min(100, score));
  return {
    blastRadiusScore: score,
    riskLevel: classify(score),
    findings: [...new Set(findings)],
    recommendations: [...new Set(recommendations)],
    scenarioResults: [],
  };
}

export const BLAST_RADIUS_SCENARIOS = [
  "compromised_agent_data_exfiltration",
  "malicious_web_page_prompt_injection",
  "poisoned_mcp_tool",
  "memory_poisoning",
  "credential_theft",
  "unauthorized_email_sending",
  "file_deletion",
  "cost_abuse_loop",
] as const;

export type BlastRadiusScenarioName = (typeof BLAST_RADIUS_SCENARIOS)[number];

const SCENARIO_WEIGHTS: Record<BlastRadiusScenarioName, { bonus: number; narrative: string }> = {
  compromised_agent_data_exfiltration: { bonus: 20, narrative: "A compromised agent attempts to exfiltrate readable confidential data to an external destination." },
  malicious_web_page_prompt_injection: { bonus: 15, narrative: "A malicious web page injects instructions that try to redirect the agent's tools." },
  poisoned_mcp_tool: { bonus: 18, narrative: "A poisoned MCP tool gains a new dangerous capability the agent will call." },
  memory_poisoning: { bonus: 12, narrative: "A poisoned long-term memory instruction tries to disable approvals in future sessions." },
  credential_theft: { bonus: 25, narrative: "The agent is steered toward reading credentials and sending them out." },
  unauthorized_email_sending: { bonus: 15, narrative: "The agent is steered toward sending unauthorized external email." },
  file_deletion: { bonus: 22, narrative: "The agent is steered toward deleting user files." },
  cost_abuse_loop: { bonus: 10, narrative: "The agent enters a cost-abuse loop calling expensive tools repeatedly." },
};

export function runBlastRadiusScenario(input: BlastRadiusInput, scenarioName: BlastRadiusScenarioName): BlastRadiusScenarioResult {
  const base = simulateBlastRadius(input);
  const weight = SCENARIO_WEIGHTS[scenarioName] ?? { bonus: 10, narrative: "Generic compromise scenario." };
  const score = Math.max(0, Math.min(100, base.blastRadiusScore + weight.bonus));
  return {
    scenarioName,
    blastRadiusScore: score,
    riskLevel: classify(score),
    narrative: weight.narrative,
  };
}
