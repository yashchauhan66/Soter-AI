import { createHash, randomBytes, randomUUID } from "crypto";

export const AGENT_IDENTITY_TYPES = [
  "CHATBOT",
  "RAG_AGENT",
  "COMPUTER_USE",
  "BROWSER_AGENT",
  "MCP_AGENT",
  "CODING_AGENT",
  "CUSTOM",
] as const;

export const AGENT_IDENTITY_STATUSES = ["ACTIVE", "DISABLED", "QUARANTINED"] as const;
export const AGENT_PASSPORT_STATUSES = ["ACTIVE", "REVOKED", "EXPIRED"] as const;
export const AGENT_PASSPORT_DECISIONS = ["ALLOW", "BLOCK", "ASK_APPROVAL"] as const;
export const AGENT_PASSPORT_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export type AgentIdentityType = (typeof AGENT_IDENTITY_TYPES)[number];
export type AgentIdentityStatus = (typeof AGENT_IDENTITY_STATUSES)[number];
export type AgentPassportStatus = (typeof AGENT_PASSPORT_STATUSES)[number];
export type AgentPassportDecision = (typeof AGENT_PASSPORT_DECISIONS)[number];
export type AgentPassportRiskLevel = (typeof AGENT_PASSPORT_RISK_LEVELS)[number];

export interface AgentPassportPolicyInput {
  allowedTools?: string[];
  blockedTools?: string[];
  approvalRequiredTools?: string[];
  allowedDomains?: string[];
  blockedDomains?: string[];
  dataScopes?: string[];
  memoryScopes?: string[];
}

export interface NormalizedAgentPassportPolicy {
  allowedTools: string[];
  blockedTools: string[];
  approvalRequiredTools: string[];
  allowedDomains: string[];
  blockedDomains: string[];
  dataScopes: string[];
  memoryScopes: string[];
}

export interface AgentIdentitySnapshot {
  id: string;
  projectId?: string;
  name?: string;
  agentType?: AgentIdentityType | string;
  status: AgentIdentityStatus | string;
  defaultPolicyJson?: unknown;
}

export interface AgentSessionPassportSnapshot extends NormalizedAgentPassportPolicy {
  id: string;
  projectId?: string;
  agentIdentityId: string;
  sessionId: string;
  passportHash?: string;
  status: AgentPassportStatus | string;
  riskScore: number;
  riskLevel: AgentPassportRiskLevel | string;
  expiresAt: Date | string;
}

export interface ValidateAgentPassportInput {
  agent: AgentIdentitySnapshot | null | undefined;
  passport: AgentSessionPassportSnapshot | null | undefined;
  passportToken?: string;
  tool?: string;
  action?: string;
  target?: string;
  domain?: string;
  now?: Date;
  requirePassportToken?: boolean;
}

export interface AgentPassportValidationResult {
  decision: AgentPassportDecision;
  riskLevel: AgentPassportRiskLevel;
  reason: string;
  policyMatches: Array<{ id: string; label: string; severity: AgentPassportRiskLevel }>;
}

export interface AgentDelegationRequest extends AgentPassportPolicyInput {
  intent: string;
}

export interface AgentDelegationResult {
  allowed: boolean;
  policy: NormalizedAgentPassportPolicy;
  violations: string[];
  intentHash: string;
}

export const DEFAULT_AGENT_PASSPORT_POLICY: NormalizedAgentPassportPolicy = {
  allowedTools: ["browser.read", "browser.open", "rag.search", "calendar.read", "filesystem.read"],
  blockedTools: ["terminal.run", "filesystem.delete", "payments.charge", "secrets.read"],
  approvalRequiredTools: ["browser.submit_form", "browser.type", "gmail.send", "calendar.create_event", "api.call", "filesystem.write", "mcp.tool.call"],
  allowedDomains: [],
  blockedDomains: [],
  dataScopes: ["project:read"],
  memoryScopes: ["session"],
};

const HIGH_RISK_TOOL_PATTERNS = [
  "terminal.run",
  "shell.exec",
  "filesystem.delete",
  "filesystem.write",
  "gmail.send",
  "email.send",
  "payments.charge",
  "payment",
  "browser.submit_form",
  "api.call",
  "mcp.tool.call",
  "database.write",
  "package.publish",
  "git.push",
];

export function createPassportToken() {
  return `ap_${randomBytes(32).toString("base64url")}`;
}

export function hashPassportToken(token: string) {
  const pepper = process.env.API_KEY_PEPPER
    ?? process.env.AUTH_SECRET
    ?? process.env.NEXTAUTH_SECRET
    ?? "cybersecurityguard-agent-passport";
  return createHash("sha256").update(`agent-passport.${token}.${pepper}`).digest("hex");
}

export function hashAgentIntent(intent: string) {
  const normalized = intent.trim().replace(/\s+/g, " ");
  if (!normalized) throw new Error("Delegated intent is required.");
  return createHash("sha256").update(normalized).digest("hex");
}

export function deriveDelegatedPassportPolicy(parent: NormalizedAgentPassportPolicy, request: AgentDelegationRequest): AgentDelegationResult {
  const normalizedParent = normalizePassportPolicy(parent);
  const requested = normalizePassportPolicy({
    allowedTools: request.allowedTools ?? normalizedParent.allowedTools,
    blockedTools: request.blockedTools ?? [],
    approvalRequiredTools: request.approvalRequiredTools ?? normalizedParent.approvalRequiredTools,
    allowedDomains: request.allowedDomains ?? normalizedParent.allowedDomains,
    blockedDomains: request.blockedDomains ?? [],
    dataScopes: request.dataScopes ?? normalizedParent.dataScopes,
    memoryScopes: request.memoryScopes ?? normalizedParent.memoryScopes,
  });
  const violations: string[] = [];
  checkSubset("allowedTools", requested.allowedTools, normalizedParent.allowedTools, violations);
  checkSubset("approvalRequiredTools", requested.approvalRequiredTools, uniq([...normalizedParent.allowedTools, ...normalizedParent.approvalRequiredTools]), violations);
  checkSubset("allowedDomains", requested.allowedDomains, normalizedParent.allowedDomains, violations);
  checkSubset("dataScopes", requested.dataScopes, normalizedParent.dataScopes, violations);
  checkSubset("memoryScopes", requested.memoryScopes, normalizedParent.memoryScopes, violations);

  const policy = normalizePassportPolicy({
    allowedTools: requested.allowedTools,
    blockedTools: uniq([...normalizedParent.blockedTools, ...requested.blockedTools]),
    approvalRequiredTools: uniq([...normalizedParent.approvalRequiredTools, ...requested.approvalRequiredTools]),
    allowedDomains: requested.allowedDomains,
    blockedDomains: uniq([...normalizedParent.blockedDomains, ...requested.blockedDomains]),
    dataScopes: requested.dataScopes,
    memoryScopes: requested.memoryScopes,
  });
  return { allowed: violations.length === 0, policy, violations, intentHash: hashAgentIntent(request.intent) };
}

export function createAgentDelegationProof(input: {
  parentPassportId: string;
  childAgentIdentityId: string;
  childSessionId: string;
  delegationDepth: number;
  intentHash: string;
  policy: NormalizedAgentPassportPolicy;
}) {
  const payload = {
    format: "soter.agent-delegation.v1",
    parentPassportId: input.parentPassportId,
    childAgentIdentityId: input.childAgentIdentityId,
    childSessionId: input.childSessionId,
    delegationDepth: input.delegationDepth,
    intentHash: input.intentHash,
    policyHash: hashEvidence(input.policy),
  };
  return { ...payload, proofHash: hashEvidence(payload) };
}

export function createPassportId() {
  return `agent_passport_${randomUUID()}`;
}

export function createAgentIdentityId() {
  return `agent_identity_${randomUUID()}`;
}

export function createAgentPassportAuditId() {
  return `agent_passport_audit_${randomUUID()}`;
}

export function createAgentPassportSessionId() {
  return `agent_sess_${randomUUID()}`;
}

export function normalizePassportPolicy(input: AgentPassportPolicyInput = {}): NormalizedAgentPassportPolicy {
  return {
    allowedTools: normalizeList(input.allowedTools ?? DEFAULT_AGENT_PASSPORT_POLICY.allowedTools),
    blockedTools: normalizeList(input.blockedTools ?? DEFAULT_AGENT_PASSPORT_POLICY.blockedTools),
    approvalRequiredTools: normalizeList(input.approvalRequiredTools ?? DEFAULT_AGENT_PASSPORT_POLICY.approvalRequiredTools),
    allowedDomains: normalizeList(input.allowedDomains ?? DEFAULT_AGENT_PASSPORT_POLICY.allowedDomains),
    blockedDomains: normalizeList(input.blockedDomains ?? DEFAULT_AGENT_PASSPORT_POLICY.blockedDomains),
    dataScopes: normalizeList(input.dataScopes ?? DEFAULT_AGENT_PASSPORT_POLICY.dataScopes),
    memoryScopes: normalizeList(input.memoryScopes ?? DEFAULT_AGENT_PASSPORT_POLICY.memoryScopes),
  };
}

export function mergePassportPolicy(defaultPolicy: unknown, overrides: AgentPassportPolicyInput = {}) {
  const base = normalizePassportPolicy(policyFromUnknown(defaultPolicy));
  return normalizePassportPolicy({
    allowedTools: overrides.allowedTools ?? base.allowedTools,
    blockedTools: uniq([...base.blockedTools, ...(overrides.blockedTools ?? [])]),
    approvalRequiredTools: uniq([...base.approvalRequiredTools, ...(overrides.approvalRequiredTools ?? [])]),
    allowedDomains: overrides.allowedDomains ?? base.allowedDomains,
    blockedDomains: uniq([...base.blockedDomains, ...(overrides.blockedDomains ?? [])]),
    dataScopes: overrides.dataScopes ?? base.dataScopes,
    memoryScopes: overrides.memoryScopes ?? base.memoryScopes,
  });
}

export function scorePassportRisk(policy: NormalizedAgentPassportPolicy) {
  let score = 10;
  const effectiveTools = uniq([...policy.allowedTools, ...policy.approvalRequiredTools]);
  const highRiskTools = effectiveTools.filter((tool) => isHighRiskTool(tool));

  score += Math.min(40, effectiveTools.length * 3);
  score += Math.min(35, highRiskTools.length * 8);
  if (policy.allowedDomains.length === 0 && effectiveTools.some((tool) => /api|gmail|email|browser|mcp/.test(tool))) score += 10;
  if (policy.dataScopes.some((scope) => /secret|regulated|pii|customer|confidential|write|admin/.test(scope))) score += 20;
  if (policy.memoryScopes.some((scope) => /global|project|write|long/.test(scope))) score += 12;
  if (policy.blockedTools.length > 0) score -= 5;
  if (policy.blockedDomains.length > 0) score -= 3;

  const riskScore = clamp(score, 0, 100);
  return { riskScore, riskLevel: riskLevelFromScore(riskScore) };
}

export function validateAgentPassport(input: ValidateAgentPassportInput): AgentPassportValidationResult {
  const matches: AgentPassportValidationResult["policyMatches"] = [];
  const now = input.now ?? new Date();
  const requirePassportToken = input.requirePassportToken ?? true;

  if (!input.agent) {
    return block("passport.unknown_agent", "Unknown agent identity. Agent passport validation fails closed.", "CRITICAL", matches);
  }
  if (input.agent.status !== "ACTIVE") {
    return block("passport.agent_disabled", `Agent identity is ${String(input.agent.status).toLowerCase()}.`, "CRITICAL", matches);
  }
  if (!input.passport) {
    return block("passport.missing", "No active agent session passport was found for this session.", "CRITICAL", matches);
  }
  if (input.passport.agentIdentityId !== input.agent.id) {
    return block("passport.agent_mismatch", "Passport is not bound to this agent identity.", "CRITICAL", matches);
  }
  if (requirePassportToken) {
    if (!input.passportToken || !input.passport.passportHash) {
      return block("passport.token_missing", "Passport token is required and only a hash is stored.", "CRITICAL", matches);
    }
    if (hashPassportToken(input.passportToken) !== input.passport.passportHash) {
      return block("passport.token_invalid", "Passport token does not match the stored passport hash.", "CRITICAL", matches);
    }
  }
  if (input.passport.status === "REVOKED") {
    return block("passport.revoked", "Agent session passport has been revoked.", "CRITICAL", matches);
  }
  if (input.passport.status === "EXPIRED") {
    return block("passport.expired_status", "Agent session passport is already marked expired.", "HIGH", matches);
  }
  if (new Date(input.passport.expiresAt).getTime() <= now.getTime()) {
    return block("passport.expired", "Agent session passport has expired.", "HIGH", matches);
  }

  const tool = normalize(input.tool);
  const action = normalize(input.action);
  const targetDomain = normalize(input.domain) || extractDomain(input.target ?? "");

  if (tool) {
    if (matchesPattern(tool, input.passport.blockedTools)) {
      return block("passport.tool_blocked", `Tool ${tool} is blocked by the passport.`, "CRITICAL", matches);
    }
    if (matchesPattern(tool, input.passport.approvalRequiredTools)) {
      matches.push({ id: "passport.tool_approval_required", label: `Tool ${tool} requires approval by passport policy.`, severity: isHighRiskTool(tool, action) ? "HIGH" : "MEDIUM" });
      return {
        decision: "ASK_APPROVAL",
        riskLevel: isHighRiskTool(tool, action) ? "HIGH" : "MEDIUM",
        reason: `Tool ${tool} requires approval before execution.`,
        policyMatches: matches,
      };
    }
    if (input.passport.allowedTools.length > 0 && !matchesPattern(tool, input.passport.allowedTools)) {
      return block("passport.tool_not_allowed", `Tool ${tool} is not in the passport allowed tools list.`, "HIGH", matches);
    }
    if (isHighRiskTool(tool, action) && !matchesPattern(tool, input.passport.approvalRequiredTools)) {
      return block("passport.high_risk_without_approval", `High-risk tool ${tool} has no approval-required passport policy.`, "CRITICAL", matches);
    }
  }

  if (targetDomain) {
    if (domainMatches(targetDomain, input.passport.blockedDomains)) {
      return block("passport.domain_blocked", `Domain ${targetDomain} is blocked by the passport.`, "CRITICAL", matches);
    }
    if (input.passport.allowedDomains.length > 0 && !domainMatches(targetDomain, input.passport.allowedDomains)) {
      matches.push({ id: "passport.domain_not_allowlisted", label: `Domain ${targetDomain} is outside the passport allowlist.`, severity: "HIGH" });
      return {
        decision: "ASK_APPROVAL",
        riskLevel: "HIGH",
        reason: `Domain ${targetDomain} is outside the passport allowlist and requires approval.`,
        policyMatches: matches,
      };
    }
  }

  const passportRiskLevel = coerceRiskLevel(input.passport.riskLevel);
  matches.push({ id: "passport.valid", label: "Agent session passport is active and policy checks passed.", severity: "LOW" });
  return {
    decision: "ALLOW",
    riskLevel: passportRiskLevel === "CRITICAL" ? "HIGH" : passportRiskLevel,
    reason: "Agent session passport is valid for the requested action.",
    policyMatches: matches,
  };
}

export function toPublicPassport<T extends { passportHash?: string }>(passport: T): Omit<T, "passportHash"> {
  const { passportHash: _passportHash, ...safePassport } = passport;
  return safePassport;
}

export function isHighRiskTool(tool: string, action = "") {
  const combined = normalize(`${tool} ${action}`);
  return HIGH_RISK_TOOL_PATTERNS.some((pattern) => combined.includes(pattern))
    || /\b(delete|drop|truncate|purge|charge|payment|send|submit|post|execute|exec|publish|install|write)\b/.test(combined);
}

export function riskLevelFromScore(score: number): AgentPassportRiskLevel {
  if (score >= 90) return "CRITICAL";
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

function block(
  id: string,
  reason: string,
  riskLevel: AgentPassportRiskLevel,
  matches: AgentPassportValidationResult["policyMatches"],
): AgentPassportValidationResult {
  matches.push({ id, label: reason, severity: riskLevel });
  return { decision: "BLOCK", riskLevel, reason, policyMatches: matches };
}

function policyFromUnknown(policy: unknown): AgentPassportPolicyInput {
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) return {};
  const record = policy as Record<string, unknown>;
  return {
    allowedTools: stringArray(record.allowedTools),
    blockedTools: stringArray(record.blockedTools),
    approvalRequiredTools: stringArray(record.approvalRequiredTools),
    allowedDomains: stringArray(record.allowedDomains),
    blockedDomains: stringArray(record.blockedDomains),
    dataScopes: stringArray(record.dataScopes),
    memoryScopes: stringArray(record.memoryScopes),
  };
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeList(values: string[]) {
  return uniq(values.map((value) => normalize(value)).filter(Boolean));
}

function normalize(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function uniq(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function checkSubset(label: string, requested: string[], parent: string[], violations: string[]) {
  const parentSet = new Set(parent);
  for (const value of requested) {
    if (!parentSet.has(value)) violations.push(`${label}:${value} exceeds the parent passport.`);
  }
}

function hashEvidence(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function coerceRiskLevel(value: string | undefined): AgentPassportRiskLevel {
  return AGENT_PASSPORT_RISK_LEVELS.includes(value as AgentPassportRiskLevel)
    ? value as AgentPassportRiskLevel
    : "MEDIUM";
}

function matchesPattern(value: string, patterns: string[]) {
  return patterns.some((pattern) => {
    const normalized = normalize(pattern);
    if (!normalized) return false;
    if (normalized.includes("*")) return globishMatch(normalized, value);
    return value === normalized || value.startsWith(`${normalized}.`);
  });
}

function globishMatch(pattern: string, value: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(value);
}

function domainMatches(domain: string, patterns: string[]) {
  return patterns.some((pattern) => {
    const normalized = normalize(pattern);
    if (!normalized) return false;
    if (normalized.includes("*")) return globishMatch(normalized, domain);
    return domain === normalized || domain.endsWith(`.${normalized}`);
  });
}

function extractDomain(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed).hostname.toLowerCase();
  } catch {
    const urlMatch = trimmed.match(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/i);
    if (urlMatch?.[1]) return urlMatch[1].toLowerCase();
    const emailMatch = trimmed.match(/@([a-z0-9.-]+\.[a-z]{2,})/i);
    if (emailMatch?.[1]) return emailMatch[1].toLowerCase();
    const domainMatch = trimmed.match(/\b([a-z0-9.-]+\.[a-z]{2,})\b/i);
    return domainMatch?.[1]?.toLowerCase() ?? "";
  }
}
