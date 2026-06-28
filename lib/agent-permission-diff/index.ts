import { createHash } from "crypto";

export type DeploymentGateDecision = "ALLOW" | "REVIEW" | "BLOCK";
export type DeploymentGateRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface AgentPermissionManifest {
  agentName?: string;
  version?: string;
  tools?: string[];
  approvalRequiredTools?: string[];
  blockedTools?: string[];
  allowedDomains?: string[];
  blockedDomains?: string[];
  dataScopes?: string[];
  memoryScopes?: string[];
  mcpServers?: string[];
  models?: string[];
}

export interface DeploymentGatePolicy {
  blockOnCritical?: boolean;
  reviewOnHigh?: boolean;
  maxRiskIncrease?: number;
  requireApprovalForNewHighRiskTools?: boolean;
  deniedTools?: string[];
  deniedDomains?: string[];
  deniedDataScopes?: string[];
}

export interface PermissionDiffFinding {
  category: string;
  changeType: "ADDED" | "REMOVED" | "UNCHANGED";
  value: string;
  riskLevel: DeploymentGateRiskLevel;
  riskDelta: number;
  reason: string;
}

export interface PermissionDiffResult {
  baselineHash: string;
  candidateHash: string;
  agentName: string;
  riskBefore: number;
  riskAfter: number;
  riskDelta: number;
  riskLevel: DeploymentGateRiskLevel;
  decision: DeploymentGateDecision;
  findings: PermissionDiffFinding[];
  summary: string;
  recommendation: string;
}

const DEFAULT_POLICY: Required<DeploymentGatePolicy> = {
  blockOnCritical: true,
  reviewOnHigh: true,
  maxRiskIncrease: 25,
  requireApprovalForNewHighRiskTools: true,
  deniedTools: [],
  deniedDomains: [],
  deniedDataScopes: [],
};

const HIGH_RISK_TOOL = /(terminal|shell|exec|command|filesystem\.write|filesystem\.delete|delete|gmail\.send|email\.send|payment|charge|refund|database\.write|sql|secrets|credential|browser\.submit|mcp\.tool|git\.push|package\.publish|deploy)/i;
const SENSITIVE_SCOPE = /(secret|credential|pii|customer|payment|finance|hr|admin|regulated|confidential|write|delete)/i;
const BROAD_DOMAIN = /^(\*|\*\..+|all|internet)$/i;

export function diffAgentPermissions(input: {
  baseline?: AgentPermissionManifest | null;
  candidate: AgentPermissionManifest;
  policy?: DeploymentGatePolicy;
}): PermissionDiffResult {
  const baseline = normalizeManifest(input.baseline ?? {});
  const candidate = normalizeManifest(input.candidate);
  const policy = { ...DEFAULT_POLICY, ...(input.policy ?? {}) };
  const findings: PermissionDiffFinding[] = [];

  compareList("tools", baseline.tools, candidate.tools, findings, scoreTool);
  compareList("approvalRequiredTools", baseline.approvalRequiredTools, candidate.approvalRequiredTools, findings, scoreApprovalTool);
  compareList("blockedTools", baseline.blockedTools, candidate.blockedTools, findings, scoreBlockedTool);
  compareList("allowedDomains", baseline.allowedDomains, candidate.allowedDomains, findings, scoreDomain);
  compareList("blockedDomains", baseline.blockedDomains, candidate.blockedDomains, findings, scoreBlockedDomain);
  compareList("dataScopes", baseline.dataScopes, candidate.dataScopes, findings, scoreDataScope);
  compareList("memoryScopes", baseline.memoryScopes, candidate.memoryScopes, findings, scoreMemoryScope);
  compareList("mcpServers", baseline.mcpServers, candidate.mcpServers, findings, scoreMcpServer);
  compareList("models", baseline.models, candidate.models, findings, scoreModel);

  applyDeniedPolicy(policy, candidate, findings);

  const riskBefore = scoreManifest(baseline);
  const rawRiskAfter = scoreManifest(candidate) + findings.reduce((sum, finding) => sum + finding.riskDelta, 0);
  const riskAfter = clamp(rawRiskAfter, 0, 100);
  const riskDelta = riskAfter - riskBefore;
  const riskLevel = riskLevelFromScore(riskAfter);
  const hasCritical = findings.some((finding) => finding.riskLevel === "CRITICAL");
  const hasHighRiskNewTool = findings.some((finding) => finding.category === "tools" && finding.changeType === "ADDED" && ["HIGH", "CRITICAL"].includes(finding.riskLevel));
  const decision = decideGate({ policy, riskLevel, riskDelta, hasCritical, hasHighRiskNewTool });
  const agentName = candidate.agentName || baseline.agentName || "unnamed-agent";

  return {
    baselineHash: hashManifest(baseline),
    candidateHash: hashManifest(candidate),
    agentName,
    riskBefore,
    riskAfter,
    riskDelta,
    riskLevel,
    decision,
    findings: findings.sort((a, b) => riskOrder(b.riskLevel) - riskOrder(a.riskLevel) || b.riskDelta - a.riskDelta),
    summary: summarize(decision, riskDelta, findings),
    recommendation: recommendation(decision, findings),
  };
}

export function normalizeManifest(manifest: AgentPermissionManifest): Required<AgentPermissionManifest> {
  return {
    agentName: normalizeFreeText(manifest.agentName),
    version: normalizeFreeText(manifest.version),
    tools: normalizeList(manifest.tools),
    approvalRequiredTools: normalizeList(manifest.approvalRequiredTools),
    blockedTools: normalizeList(manifest.blockedTools),
    allowedDomains: normalizeList(manifest.allowedDomains),
    blockedDomains: normalizeList(manifest.blockedDomains),
    dataScopes: normalizeList(manifest.dataScopes),
    memoryScopes: normalizeList(manifest.memoryScopes),
    mcpServers: normalizeList(manifest.mcpServers),
    models: normalizeList(manifest.models),
  };
}

function compareList(
  category: string,
  before: string[],
  after: string[],
  findings: PermissionDiffFinding[],
  scorer: (value: string, changeType: "ADDED" | "REMOVED") => Omit<PermissionDiffFinding, "category" | "changeType" | "value">,
) {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  for (const value of after) {
    if (!beforeSet.has(value)) findings.push({ category, changeType: "ADDED", value, ...scorer(value, "ADDED") });
  }
  for (const value of before) {
    if (!afterSet.has(value)) findings.push({ category, changeType: "REMOVED", value, ...scorer(value, "REMOVED") });
  }
}

function scoreManifest(manifest: Required<AgentPermissionManifest>) {
  let score = 10;
  score += Math.min(30, manifest.tools.length * 3);
  score += manifest.tools.filter((tool) => HIGH_RISK_TOOL.test(tool)).length * 10;
  score += manifest.allowedDomains.some((domain) => BROAD_DOMAIN.test(domain)) ? 15 : Math.min(10, manifest.allowedDomains.length * 2);
  score += manifest.dataScopes.filter((scope) => SENSITIVE_SCOPE.test(scope)).length * 8;
  score += manifest.memoryScopes.some((scope) => /global|long|write|project/.test(scope)) ? 10 : 0;
  score += manifest.mcpServers.length * 5;
  score -= Math.min(15, manifest.approvalRequiredTools.length * 4);
  score -= Math.min(10, manifest.blockedTools.length * 3);
  score -= Math.min(6, manifest.blockedDomains.length * 2);
  return clamp(score, 0, 100);
}

function scoreTool(value: string, changeType: "ADDED" | "REMOVED") {
  const high = HIGH_RISK_TOOL.test(value);
  return {
    riskLevel: high ? "HIGH" as const : "MEDIUM" as const,
    riskDelta: changeType === "ADDED" ? (high ? 18 : 7) : (high ? -10 : -3),
    reason: changeType === "ADDED" ? `Agent gained tool permission: ${value}.` : `Agent lost tool permission: ${value}.`,
  };
}

function scoreApprovalTool(value: string, changeType: "ADDED" | "REMOVED") {
  return {
    riskLevel: changeType === "REMOVED" && HIGH_RISK_TOOL.test(value) ? "HIGH" as const : "LOW" as const,
    riskDelta: changeType === "ADDED" ? -6 : 8,
    reason: changeType === "ADDED" ? `Tool now requires approval: ${value}.` : `Approval requirement was removed for: ${value}.`,
  };
}

function scoreBlockedTool(value: string, changeType: "ADDED" | "REMOVED") {
  return {
    riskLevel: changeType === "REMOVED" ? "HIGH" as const : "LOW" as const,
    riskDelta: changeType === "ADDED" ? -5 : 12,
    reason: changeType === "ADDED" ? `Tool is newly blocked: ${value}.` : `Tool is no longer blocked: ${value}.`,
  };
}

function scoreDomain(value: string, changeType: "ADDED" | "REMOVED") {
  const broad = BROAD_DOMAIN.test(value);
  return {
    riskLevel: broad ? "CRITICAL" as const : "MEDIUM" as const,
    riskDelta: changeType === "ADDED" ? (broad ? 30 : 8) : (broad ? -18 : -4),
    reason: changeType === "ADDED" ? `Agent can reach new domain: ${value}.` : `Allowed domain removed: ${value}.`,
  };
}

function scoreBlockedDomain(value: string, changeType: "ADDED" | "REMOVED") {
  return {
    riskLevel: changeType === "REMOVED" ? "MEDIUM" as const : "LOW" as const,
    riskDelta: changeType === "ADDED" ? -3 : 6,
    reason: changeType === "ADDED" ? `Domain is newly blocked: ${value}.` : `Domain block removed: ${value}.`,
  };
}

function scoreDataScope(value: string, changeType: "ADDED" | "REMOVED") {
  const sensitive = SENSITIVE_SCOPE.test(value);
  return {
    riskLevel: sensitive ? "HIGH" as const : "MEDIUM" as const,
    riskDelta: changeType === "ADDED" ? (sensitive ? 16 : 6) : (sensitive ? -8 : -3),
    reason: changeType === "ADDED" ? `Agent gained data scope: ${value}.` : `Agent lost data scope: ${value}.`,
  };
}

function scoreMemoryScope(value: string, changeType: "ADDED" | "REMOVED") {
  const broad = /global|long|write|project/.test(value);
  return {
    riskLevel: broad ? "HIGH" as const : "LOW" as const,
    riskDelta: changeType === "ADDED" ? (broad ? 12 : 3) : (broad ? -6 : -1),
    reason: changeType === "ADDED" ? `Agent gained memory scope: ${value}.` : `Agent lost memory scope: ${value}.`,
  };
}

function scoreMcpServer(value: string, changeType: "ADDED" | "REMOVED") {
  return {
    riskLevel: "HIGH" as const,
    riskDelta: changeType === "ADDED" ? 14 : -7,
    reason: changeType === "ADDED" ? `Agent can connect to new MCP server: ${value}.` : `MCP server removed: ${value}.`,
  };
}

function scoreModel(value: string, changeType: "ADDED" | "REMOVED") {
  const risky = /preview|experimental|local|unknown|fine[-_ ]?tune/.test(value);
  return {
    riskLevel: risky ? "MEDIUM" as const : "LOW" as const,
    riskDelta: changeType === "ADDED" ? (risky ? 6 : 2) : (risky ? -3 : -1),
    reason: changeType === "ADDED" ? `Agent can use new model: ${value}.` : `Model removed: ${value}.`,
  };
}

function applyDeniedPolicy(policy: Required<DeploymentGatePolicy>, candidate: Required<AgentPermissionManifest>, findings: PermissionDiffFinding[]) {
  for (const tool of candidate.tools) {
    if (matchesAny(tool, policy.deniedTools)) findings.push({ category: "policy", changeType: "UNCHANGED", value: tool, riskLevel: "CRITICAL", riskDelta: 25, reason: `Tool violates deployment gate deniedTools policy: ${tool}.` });
  }
  for (const domain of candidate.allowedDomains) {
    if (matchesAny(domain, policy.deniedDomains)) findings.push({ category: "policy", changeType: "UNCHANGED", value: domain, riskLevel: "CRITICAL", riskDelta: 25, reason: `Domain violates deployment gate deniedDomains policy: ${domain}.` });
  }
  for (const scope of candidate.dataScopes) {
    if (matchesAny(scope, policy.deniedDataScopes)) findings.push({ category: "policy", changeType: "UNCHANGED", value: scope, riskLevel: "CRITICAL", riskDelta: 25, reason: `Data scope violates deployment gate deniedDataScopes policy: ${scope}.` });
  }
}

function decideGate(input: {
  policy: Required<DeploymentGatePolicy>;
  riskLevel: DeploymentGateRiskLevel;
  riskDelta: number;
  hasCritical: boolean;
  hasHighRiskNewTool: boolean;
}): DeploymentGateDecision {
  if (input.policy.blockOnCritical && (input.hasCritical || input.riskLevel === "CRITICAL")) return "BLOCK";
  if (input.riskDelta > input.policy.maxRiskIncrease) return "BLOCK";
  if (input.policy.requireApprovalForNewHighRiskTools && input.hasHighRiskNewTool) return "REVIEW";
  if (input.policy.reviewOnHigh && input.riskLevel === "HIGH") return "REVIEW";
  return "ALLOW";
}

function summarize(decision: DeploymentGateDecision, riskDelta: number, findings: PermissionDiffFinding[]) {
  const added = findings.filter((finding) => finding.changeType === "ADDED").length;
  const critical = findings.filter((finding) => finding.riskLevel === "CRITICAL").length;
  return `${decision}: ${added} new permission changes, ${critical} critical findings, risk delta ${riskDelta}.`;
}

function recommendation(decision: DeploymentGateDecision, findings: PermissionDiffFinding[]) {
  if (decision === "ALLOW") return "Deployment can proceed under the current gate policy.";
  const top = findings.find((finding) => ["CRITICAL", "HIGH"].includes(finding.riskLevel));
  if (decision === "BLOCK") return top ? `Block deployment until resolved: ${top.reason}` : "Block deployment until the risk increase is reviewed.";
  return top ? `Require security approval before deployment: ${top.reason}` : "Require approval before deployment.";
}

function normalizeList(values: string[] | undefined) {
  return [...new Set((values ?? []).map((value) => normalizeFreeText(value)).filter(Boolean))].sort();
}

function normalizeFreeText(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function matchesAny(value: string, patterns: string[]) {
  return patterns.some((pattern) => {
    const normalized = normalizeFreeText(pattern);
    if (!normalized) return false;
    if (normalized.includes("*")) {
      const escaped = normalized.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
      return new RegExp(`^${escaped}$`).test(value);
    }
    return value === normalized || value.includes(normalized);
  });
}

function riskLevelFromScore(score: number): DeploymentGateRiskLevel {
  if (score >= 90) return "CRITICAL";
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

function riskOrder(level: DeploymentGateRiskLevel) {
  return { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[level];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hashManifest(manifest: Required<AgentPermissionManifest>) {
  return createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
}
