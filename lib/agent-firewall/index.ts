import { createHash, randomBytes, randomUUID } from "crypto";
import { db } from "@/lib/db";
import { analyzeText } from "@/lib/guard/analyze";
import { sanitizeLogText, sanitizeMetadata } from "@/lib/guard/logSafety";
import { requireTenantProjectOwnership } from "@/lib/phase11/tenantIsolation";

export const AGENT_FIREWALL_PREVIEW_GAPS = [
  "Inspection and approval queue exist; runtime agent execution enforcement integration is not complete.",
  "Approver assignment, SLA, and notification routing are not wired to email/SIEM in this preview.",
  "Approval audit trail covers persistence only; reviewer attestation export is not complete.",
  "Provider-specific agent runtime hooks require authorized integration setup before production use.",
] as const;

export const TOOL_CATEGORIES = [
  "READ_ONLY",
  "WRITE",
  "EXTERNAL_API",
  "EMAIL",
  "PAYMENT",
  "DATABASE",
  "FILE_SYSTEM",
  "WEB_BROWSER",
  "CODE_EXECUTION",
  "ADMIN_ACTION",
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];
export type ToolDecision = "ALLOW" | "DENY" | "APPROVAL_REQUIRED" | "BLOCK";

export const AGENT_TYPES = [
  "computer_use",
  "browser_agent",
  "mcp_agent",
  "rag_agent",
  "chatbot",
  "custom",
] as const;

export const AGENT_DECISIONS = [
  "ALLOW",
  "BLOCK",
  "REDACT",
  "ASK_APPROVAL",
  "SANDBOX_ONLY",
  "READ_ONLY",
] as const;

export const AGENT_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const AGENT_APPROVAL_STATUSES = ["PENDING", "APPROVED", "DENIED", "EXPIRED"] as const;

export type AgentType = (typeof AGENT_TYPES)[number];
export type AgentDecision = (typeof AGENT_DECISIONS)[number];
export type AgentRiskLevel = (typeof AGENT_RISK_LEVELS)[number];
export type AgentApprovalStatus = (typeof AGENT_APPROVAL_STATUSES)[number];
export type AgentDestination = "external" | "internal" | "local" | "unknown";

export interface AgentRiskContext {
  userApproved?: boolean;
  externalDestination?: boolean;
  canModifyData?: boolean;
  canDeleteData?: boolean;
  canSendMessage?: boolean;
  canRunCode?: boolean;
  canAccessFiles?: boolean;
  canReadSecrets?: boolean;
  canMakePayment?: boolean;
  canDisableSecurity?: boolean;
}

export interface AgentActionCheckInput {
  sessionId?: string;
  agentName?: string;
  tool: string;
  action: string;
  target?: string;
  content?: string;
  destination?: AgentDestination;
  riskContext?: AgentRiskContext;
  metadata?: Record<string, unknown>;
}

export interface AgentFirewallPolicy {
  allowedDomains: string[];
  blockedDomains: string[];
  allowedWorkspaceDir?: string;
  allowedWorkspaceDirs?: string[];
  blockedFilePatterns: string[];
  toolsRequiringApproval: string[];
  toolsAlwaysBlocked: string[];
  piiMode: "redact" | "approval" | "block";
  secretsMode: "redact" | "approval" | "block";
  failClosed: boolean;
  maxRiskWithoutApproval: AgentRiskLevel;
  requireAllowedDomainForExternal?: boolean;
}

export interface AgentPermissionManifest {
  agent: string;
  allowedTools: string[];
  approvalRequired: string[];
  blocked: string[];
  allowedDomains: string[];
  blockedDomains: string[];
  allowedWorkspaceDirs: string[];
  blockedFilePatterns: string[];
  dataPolicy: {
    externalSecrets: "BLOCK" | "ASK_APPROVAL" | "REDACT";
    externalPII: "BLOCK" | "ASK_APPROVAL" | "REDACT";
    failClosed: boolean;
  };
}

export interface AgentPolicyMatch {
  id: string;
  label: string;
  severity: AgentRiskLevel;
}

export interface AgentRedaction {
  type: string;
  label: string;
  severity: AgentRiskLevel;
}

export interface AgentActionDecisionResult {
  decision: AgentDecision;
  riskLevel: AgentRiskLevel;
  reason: string;
  safeContent?: string;
  redactions: AgentRedaction[];
  requiredApproval?: {
    message: string;
    approvalToken: string;
    approvalId?: string;
  };
  policyMatches: AgentPolicyMatch[];
  auditId?: string;
}

export interface AgentSessionStartInput {
  agentName: string;
  agentType: AgentType;
  userId?: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentSessionStartResult {
  sessionId: string;
  policy: AgentFirewallPolicy;
  allowedTools: string[];
  blockedTools: string[];
  approvalRequiredTools: string[];
}

export const DEFAULT_BLOCKED_FILE_PATTERNS = [
  ".env",
  ".env.*",
  "*.pem",
  "*.key",
  "id_rsa",
  "id_ed25519",
  "*.p12",
  "*.pfx",
  "cookies.sqlite",
  "Login Data",
  "Local State",
  "*.kdbx",
  "credentials.json",
  "token.json",
] as const;

export const DEFAULT_DANGEROUS_TERMINAL_PATTERNS = [
  "rm -rf",
  "del /s",
  "format",
  "shutdown",
  "reboot",
  "curl * | bash",
  "wget * | bash",
  "Invoke-WebRequest * | iex",
  "cat .env",
  "type .env",
  "printenv",
  "env",
  "npm publish",
  "git push --force",
  "chmod 777",
  "sudo",
  "ssh",
  "scp",
  "rsync",
  "docker run --privileged",
] as const;

export const DEFAULT_ALLOWED_AGENT_TOOLS = [
  "browser.open",
  "browser.read",
  "rag.search",
  "calendar.read",
  "filesystem.read",
  "mcp.tool.call",
] as const;

export const DEFAULT_APPROVAL_REQUIRED_AGENT_TOOLS = [
  "browser.type",
  "browser.submit_form",
  "filesystem.write",
  "clipboard.write",
  "gmail.send",
  "calendar.create_event",
  "mcp.tool.call",
] as const;

export const DEFAULT_BLOCKED_AGENT_TOOLS = [
  "filesystem.delete",
  "terminal.run",
  "payments.charge",
] as const;

export function defaultAgentFirewallPolicy(overrides: Partial<AgentFirewallPolicy> = {}): AgentFirewallPolicy {
  const blockedFilePatterns = agentEnvFlag("BLOCK_DOTENV_READ", true)
    ? [...DEFAULT_BLOCKED_FILE_PATTERNS]
    : DEFAULT_BLOCKED_FILE_PATTERNS.filter((pattern) => pattern !== ".env" && pattern !== ".env.*");
  const definedOverrides = Object.fromEntries(
    Object.entries(overrides).filter(([, value]) => value !== undefined),
  ) as Partial<AgentFirewallPolicy>;

  return {
    allowedDomains: [],
    blockedDomains: [],
    allowedWorkspaceDir: agentEnv("ALLOWED_WORKSPACE_DIR") || undefined,
    blockedFilePatterns,
    toolsRequiringApproval: [...DEFAULT_APPROVAL_REQUIRED_AGENT_TOOLS],
    toolsAlwaysBlocked: [...DEFAULT_BLOCKED_AGENT_TOOLS],
    piiMode: "approval",
    secretsMode: "block",
    failClosed: agentEnvFlag("FAIL_CLOSED", true),
    maxRiskWithoutApproval: "MEDIUM",
    requireAllowedDomainForExternal: false,
    ...definedOverrides,
  };
}

export function defaultAgentPermissionManifest(agentName = "custom", overrides: Partial<AgentPermissionManifest> = {}): AgentPermissionManifest {
  const dataPolicy = {
    externalSecrets: overrides.dataPolicy?.externalSecrets ?? "BLOCK",
    externalPII: overrides.dataPolicy?.externalPII ?? "ASK_APPROVAL",
    failClosed: overrides.dataPolicy?.failClosed ?? true,
  };
  return {
    agent: overrides.agent ?? agentName,
    allowedTools: [...(overrides.allowedTools ?? [])],
    approvalRequired: [...(overrides.approvalRequired ?? [])],
    blocked: [...(overrides.blocked ?? [])],
    allowedDomains: [...(overrides.allowedDomains ?? [])],
    blockedDomains: [...(overrides.blockedDomains ?? [])],
    allowedWorkspaceDirs: [...(overrides.allowedWorkspaceDirs ?? [])],
    blockedFilePatterns: [...(overrides.blockedFilePatterns ?? [])],
    dataPolicy,
  };
}

export function applyAgentManifestToPolicy(
  policyInput: Partial<AgentFirewallPolicy> = {},
  manifestInput?: Partial<AgentPermissionManifest> | null,
): AgentFirewallPolicy {
  const policy = defaultAgentFirewallPolicy(policyInput);
  if (!manifestInput) return policy;
  const manifest = defaultAgentPermissionManifest(manifestInput.agent ?? "custom", manifestInput);
  const manifestAllowedDomains = uniqNormalized(manifest.allowedDomains);
  const policyAllowedDomains = uniqNormalized(policy.allowedDomains);

  const allowedDomains = manifestAllowedDomains.length > 0
    ? policyAllowedDomains.length > 0
      ? policyAllowedDomains.filter((domain) => domainMatchesAny(domain, manifestAllowedDomains))
      : manifestAllowedDomains
    : policyAllowedDomains;

  return {
    ...policy,
    allowedDomains,
    blockedDomains: uniqNormalized([...policy.blockedDomains, ...manifest.blockedDomains]),
    allowedWorkspaceDir: manifest.allowedWorkspaceDirs[0] ?? policy.allowedWorkspaceDir,
    allowedWorkspaceDirs: uniqNormalized([
      ...(policy.allowedWorkspaceDirs ?? (policy.allowedWorkspaceDir ? [policy.allowedWorkspaceDir] : [])),
      ...manifest.allowedWorkspaceDirs,
    ]),
    blockedFilePatterns: uniq([...policy.blockedFilePatterns, ...manifest.blockedFilePatterns]),
    toolsRequiringApproval: uniqNormalized([...policy.toolsRequiringApproval, ...manifest.approvalRequired]),
    toolsAlwaysBlocked: uniqNormalized([...policy.toolsAlwaysBlocked, ...manifest.blocked]),
    piiMode: mostRestrictiveDataMode(policy.piiMode, manifest.dataPolicy.externalPII),
    secretsMode: mostRestrictiveDataMode(policy.secretsMode, manifest.dataPolicy.externalSecrets),
    failClosed: policy.failClosed || manifest.dataPolicy.failClosed,
    requireAllowedDomainForExternal: policy.requireAllowedDomainForExternal || manifestAllowedDomains.length > 0,
  };
}

export function startAgentSession(_input: AgentSessionStartInput): AgentSessionStartResult {
  return {
    sessionId: `agent_sess_${randomUUID()}`,
    policy: defaultAgentFirewallPolicy(),
    allowedTools: [...DEFAULT_ALLOWED_AGENT_TOOLS],
    blockedTools: [...DEFAULT_BLOCKED_AGENT_TOOLS],
    approvalRequiredTools: [...DEFAULT_APPROVAL_REQUIRED_AGENT_TOOLS],
  };
}

export interface ToolCallInspectionInput {
  tool?: { id?: string; name: string; category: ToolCategory; enabled?: boolean };
  permission?: { allow: boolean; requiresApproval?: boolean } | null;
  action: string;
  input?: Record<string, unknown>;
  highRiskPromptContext?: boolean;
}

const BASE_RISK: Record<ToolCategory, number> = {
  READ_ONLY: 15,
  WRITE: 55,
  EXTERNAL_API: 55,
  EMAIL: 75,
  PAYMENT: 85,
  DATABASE: 70,
  FILE_SYSTEM: 70,
  WEB_BROWSER: 45,
  CODE_EXECUTION: 100,
  ADMIN_ACTION: 95,
};

const APPROVAL_GATED_CATEGORIES = new Set<ToolCategory>([
  "WRITE",
  "EXTERNAL_API",
  "EMAIL",
  "PAYMENT",
  "DATABASE",
  "FILE_SYSTEM",
]);

export function inspectToolCall(input: ToolCallInspectionInput) {
  if (!input.tool) {
    return decision("DENY", 100, "Unknown tools are denied by default.", input);
  }
  if (!input.tool.enabled) {
    return decision("DENY", 80, "Tool is disabled or not registered as enabled.", input);
  }
  if (!input.permission?.allow) {
    return decision("DENY", 80, "Tool permission is not granted for this project or role.", input);
  }

  let riskScore = BASE_RISK[input.tool.category] ?? 80;
  const action = input.action.toLowerCase();
  if (/(delete|drop|purge|export|permission|role|refund|charge|send)/.test(action)) riskScore += 15;
  if (input.highRiskPromptContext) riskScore += 15;
  riskScore = Math.min(100, riskScore);

  if (input.tool.category === "CODE_EXECUTION") return decision("BLOCK", riskScore, "Code execution tools are blocked by the production firewall scaffold.", input);
  if (input.tool.category === "ADMIN_ACTION" || /(drop\s+database|truncate|purge\s+tenant|delete\s+organization|permission|role)/.test(action)) {
    return decision("BLOCK", riskScore, "Administrative or destructive tool action blocked.", input);
  }
  if (APPROVAL_GATED_CATEGORIES.has(input.tool.category) && riskScore >= 70) {
    return decision("APPROVAL_REQUIRED", riskScore, "Human approval required before execution.", input);
  }
  if (riskScore >= 90) return decision("BLOCK", riskScore, "Critical tool action blocked.", input);
  if (input.permission.requiresApproval || riskScore >= 70) return decision("APPROVAL_REQUIRED", riskScore, "Human approval required before execution.", input);
  return decision("ALLOW", riskScore, "Tool call allowed by policy.", input);
}

export function previewToolAction(input: ToolCallInspectionInput) {
  const inspected = inspectToolCall(input);
  return {
    simulateOnly: true,
    decision: inspected.decision,
    riskScore: inspected.riskScore,
    reason: inspected.reason,
    redactedInput: inspected.redactedInput,
  };
}

export async function persistToolCallInspection(input: ToolCallInspectionInput & { organizationId: string; projectId: string; actorUserId?: string | null }) {
  await requireTenantProjectOwnership({ organizationId: input.organizationId, projectId: input.projectId });
  const inspected = inspectToolCall(input);
  const logId = `tool_log_${randomUUID()}`;
  await db.$queryRaw`
    INSERT INTO "ToolCallLog" ("id", "organizationId", "projectId", "toolId", "toolName", "action", "category", "riskScore", "decision", "redactedInput", "reason", "actorUserId", "createdAt")
    VALUES (${logId}, ${input.organizationId}, ${input.projectId}, ${input.tool?.id ?? null}, ${input.tool?.name ?? "unknown"}, ${input.action}, ${input.tool?.category ?? "UNKNOWN"}, ${inspected.riskScore}, ${inspected.decision}, ${JSON.stringify(inspected.redactedInput)}::jsonb, ${inspected.reason}, ${input.actorUserId ?? null}, NOW())
  `;
  if (inspected.decision === "APPROVAL_REQUIRED") {
    await db.$queryRaw`
      INSERT INTO "ToolApprovalRequest" ("id", "organizationId", "projectId", "toolCallLogId", "status", "requestedById", "reason", "preview", "createdAt")
      VALUES (${`tool_approval_${randomUUID()}`}, ${input.organizationId}, ${input.projectId}, ${logId}, 'PENDING', ${input.actorUserId ?? null}, ${inspected.reason}, ${JSON.stringify(previewToolAction(input))}::jsonb, NOW())
    `;
  }
  return { logId, ...inspected };
}

export function checkAgentAction(
  input: AgentActionCheckInput,
  options: { policy?: Partial<AgentFirewallPolicy>; guardAvailable?: boolean; auditId?: string } = {},
): AgentActionDecisionResult {
  const policy = defaultAgentFirewallPolicy(options.policy);
  const tool = normalize(input.tool);
  const action = normalize(input.action);
  const target = input.target ?? "";
  const content = input.content ?? "";
  const destination = input.destination ?? (input.riskContext?.externalDestination ? "external" : "unknown");
  const external = destination === "external" || input.riskContext?.externalDestination === true;
  const policyMatches: AgentPolicyMatch[] = [];
  let riskScore = baseAgentRiskScore(tool, action, destination, input.riskContext);

  if (options.guardAvailable === false && riskyContext(input.riskContext, riskScore)) {
    policyMatches.push({ id: "guard.unavailable", label: "Guard service unavailable while checking a risky action.", severity: "CRITICAL" });
    return agentDecision(
      policy.failClosed ? "BLOCK" : "ASK_APPROVAL",
      "CRITICAL",
      policy.failClosed
        ? "Guard service unavailable; fail-closed policy blocked a risky agent action."
        : "Guard service unavailable; human approval is required before any risky action can execute.",
      content,
      policyMatches,
      [],
      options.auditId,
    );
  }

  const dataScan = scanAgentData(content, external ? "external" : destination, "INPUT");
  policyMatches.push(...dataScan.policyMatches);
  riskScore = Math.max(riskScore, riskScoreFromGuard(dataScan.riskLevel));

  const targetDomain = evaluateTargetDomain(target || content, policy);
  if (targetDomain.blocked) {
    policyMatches.push({ id: "domain.blocked", label: `Target domain ${targetDomain.domain} is blocked by policy.`, severity: "CRITICAL" });
    return agentDecision("BLOCK", "CRITICAL", `Blocked target domain ${targetDomain.domain} by Agent Firewall policy.`, content, policyMatches, dataScan.redactions, options.auditId, dataScan.safeContent);
  }
  if (external && policy.requireAllowedDomainForExternal && targetDomain.domain && !targetDomain.allowed) {
    policyMatches.push({ id: "domain.not_allowlisted", label: `Target domain ${targetDomain.domain} is outside the agent manifest allowlist.`, severity: "HIGH" });
    riskScore = Math.max(riskScore, 70);
  }
  if (targetDomain.allowed && external && /api\.call|http|post|external/.test(`${tool} ${action}`)) {
    policyMatches.push({ id: "domain.allowlisted", label: `Target domain ${targetDomain.domain} is allowlisted.`, severity: "LOW" });
    riskScore = Math.min(riskScore, 55);
  }

  if (matchesTool(tool, policy.toolsAlwaysBlocked)) {
    policyMatches.push({ id: "tool.blocked", label: `Tool ${input.tool} is blocked by policy.`, severity: "CRITICAL" });
    return agentDecision("BLOCK", "CRITICAL", `Tool ${input.tool} is blocked by Agent Firewall policy.`, content, policyMatches, dataScan.redactions, options.auditId, dataScan.safeContent);
  }

  if (isSecurityBypassAttempt(`${input.action} ${content}`)) {
    policyMatches.push({ id: "security.disable", label: "Attempt to disable or bypass security controls.", severity: "CRITICAL" });
    return agentDecision("BLOCK", "CRITICAL", "Blocked because the action attempts to bypass or disable security controls.", content, policyMatches, dataScan.redactions, options.auditId, dataScan.safeContent);
  }

  if (isDangerousTerminalAction(tool, action, content || target)) {
    policyMatches.push({ id: "terminal.dangerous", label: "Dangerous terminal command pattern.", severity: "CRITICAL" });
    return agentDecision("BLOCK", "CRITICAL", "Blocked dangerous terminal or shell command before execution.", content, policyMatches, dataScan.redactions, options.auditId, dataScan.safeContent);
  }

  if (isBlockedFileTarget(target || content, policy)) {
    policyMatches.push({ id: "file.secret_path", label: "Blocked file pattern such as .env, private keys, cookies, or credentials.", severity: "CRITICAL" });
    return agentDecision("BLOCK", "CRITICAL", "Blocked access to sensitive local file patterns.", content, policyMatches, dataScan.redactions, options.auditId, dataScan.safeContent);
  }

  if (input.riskContext?.canDeleteData || /\b(delete|remove|unlink|drop|truncate|purge)\b/i.test(action)) {
    if (isOutsideAllowedWorkspace(target, policy.allowedWorkspaceDirs ?? (policy.allowedWorkspaceDir ? [policy.allowedWorkspaceDir] : []))) {
      policyMatches.push({ id: "file.delete_outside_workspace", label: "Delete/write outside allowed workspace.", severity: "CRITICAL" });
      return agentDecision("BLOCK", "CRITICAL", "Blocked destructive file or data action outside the allowed workspace.", content, policyMatches, dataScan.redactions, options.auditId, dataScan.safeContent);
    }
    riskScore = Math.max(riskScore, 90);
  }

  if (external && dataScan.hasSecrets) {
    policyMatches.push({ id: "data.secret_exfiltration", label: "Secret-bearing data was headed to an external destination.", severity: "CRITICAL" });
    if (policy.secretsMode === "block") {
      return agentDecision("BLOCK", "CRITICAL", "Blocked possible secret exfiltration to an external destination.", content, policyMatches, dataScan.redactions, options.auditId, dataScan.safeContent);
    }
    return agentDecision("ASK_APPROVAL", "CRITICAL", "External action contains secrets and requires explicit approval with redacted content.", content, policyMatches, dataScan.redactions, options.auditId, dataScan.safeContent);
  }

  if (dataScan.promptAttack) {
    policyMatches.push({ id: "prompt.tool_misuse", label: "Prompt attempted to steer tool use around safety controls.", severity: "CRITICAL" });
    return agentDecision("BLOCK", "CRITICAL", "Blocked prompt-injection or jailbreak content before tool execution.", content, policyMatches, dataScan.redactions, options.auditId, dataScan.safeContent);
  }

  if (external && dataScan.hasPii) {
    policyMatches.push({ id: "data.pii_external", label: "PII or India-specific identifiers in external action.", severity: "HIGH" });
    if (policy.piiMode === "block") {
      return agentDecision("BLOCK", "HIGH", "Blocked external action containing personal data by policy.", content, policyMatches, dataScan.redactions, options.auditId, dataScan.safeContent);
    }
    return agentDecision("ASK_APPROVAL", "HIGH", "External action contains personal data and requires human approval after redaction review.", content, policyMatches, dataScan.redactions, options.auditId, dataScan.safeContent);
  }

  if (matchesTool(tool, policy.toolsRequiringApproval) || requiresApprovalByEnv(tool, action) || riskScore >= 70 || exceedsMaxRiskWithoutApproval(riskLevelFromScore(riskScore), policy.maxRiskWithoutApproval)) {
    return agentDecision("ASK_APPROVAL", riskLevelFromScore(riskScore), "Human approval required before this high-impact agent action can execute.", content, policyMatches, dataScan.redactions, options.auditId, dataScan.safeContent);
  }

  if (dataScan.redactions.length > 0) {
    return agentDecision("REDACT", "MEDIUM", "Allowed only with sensitive content redacted before execution.", content, policyMatches, dataScan.redactions, options.auditId, dataScan.safeContent);
  }

  const readonly = /\b(read|list|search|summari[sz]e|open|get|fetch)\b/i.test(action) && !riskyContext(input.riskContext, riskScore);
  return agentDecision(readonly ? "READ_ONLY" : "ALLOW", riskLevelFromScore(riskScore), readonly ? "Read-only tool action allowed by policy." : "Agent action allowed by policy.", content, policyMatches, [], options.auditId);
}

export function checkToolUse(
  input: Omit<AgentActionCheckInput, "content">,
  options: { policy?: Partial<AgentFirewallPolicy>; guardAvailable?: boolean; auditId?: string } = {},
) {
  return checkAgentAction({ ...input, content: "" }, options);
}

export function checkDataLeak(input: {
  content: string;
  destination?: AgentDestination;
  target?: string;
  metadata?: Record<string, unknown>;
}) {
  const destination = input.destination ?? "unknown";
  const external = destination === "external" || destination === "unknown";
  const scan = scanAgentData(input.content, destination, "INPUT");
  if (external && scan.hasSecrets) {
    return agentDecision("BLOCK", "CRITICAL", "Blocked secret-bearing data before it could leave the user environment.", input.content, scan.policyMatches, scan.redactions, undefined, scan.safeContent);
  }
  if (external && scan.hasPii) {
    return agentDecision("ASK_APPROVAL", "HIGH", "Personal data requires explicit approval before external transfer.", input.content, scan.policyMatches, scan.redactions, undefined, scan.safeContent);
  }
  if (scan.redactions.length > 0) {
    return agentDecision("REDACT", scan.riskLevel, "Sensitive data must be redacted before use.", input.content, scan.policyMatches, scan.redactions, undefined, scan.safeContent);
  }
  return agentDecision("ALLOW", "LOW", "No material data-leak risk detected.", input.content, [], []);
}

export function checkAgentOutput(input: { content: string; destination?: AgentDestination; metadata?: Record<string, unknown> }) {
  const scan = scanAgentData(input.content, input.destination ?? "internal", "OUTPUT");
  if (scan.hasSecrets || scan.hasPii || scan.redactions.length > 0) {
    return agentDecision("REDACT", scan.riskLevel, "Agent output contains sensitive content and must be redacted.", input.content, scan.policyMatches, scan.redactions, undefined, scan.safeContent);
  }
  if (scan.promptAttack || scan.guardBlocked) {
    return agentDecision("BLOCK", "CRITICAL", "Blocked unsafe or policy-violating agent output.", input.content, scan.policyMatches, scan.redactions, undefined, scan.safeContent);
  }
  return agentDecision("ALLOW", "LOW", "Agent output allowed by policy.", input.content, [], []);
}

export function createApprovalToken() {
  const approvalToken = `af_${randomBytes(24).toString("base64url")}`;
  return { approvalToken, approvalTokenHash: hashApprovalToken(approvalToken) };
}

export function hashApprovalToken(token: string) {
  const pepper = process.env.API_KEY_PEPPER ?? process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "cybersecurityguard-agent-firewall";
  return createHash("sha256").update(`${token}.${pepper}`).digest("hex");
}

export function isApprovalTokenValid(rawToken: string, expectedHash: string) {
  return hashApprovalToken(rawToken) === expectedHash;
}

function decision(decisionValue: ToolDecision, riskScore: number, reason: string, input: ToolCallInspectionInput) {
  return {
    decision: decisionValue,
    riskScore,
    reason,
    redactedInput: redactToolPayload(input.input ?? {}),
  };
}

export function redactToolPayload(payload: Record<string, unknown>) {
  const flattened: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (/token|secret|password|authorization|api.?key/i.test(key)) continue;
    if (typeof value === "string") flattened[key] = sanitizeLogText(value);
    else if (typeof value === "number" || typeof value === "boolean" || value === null) flattened[key] = value;
    else flattened[key] = sanitizeLogText(JSON.stringify(value).slice(0, 500));
  }
  return sanitizeMetadata(flattened);
}

function scanAgentData(content: string, destination: AgentDestination, direction: "INPUT" | "OUTPUT") {
  const text = String(content ?? "").slice(0, 20_000);
  const guard = analyzeText(text, direction);
  const policyMatches: AgentPolicyMatch[] = [];
  const extraRedactions: AgentRedaction[] = [];
  let safeContent = guard.redactedText ?? sanitizeLogText(text);

  const extraRules: Array<[RegExp, AgentRedaction, string]> = [
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/i, { type: "SECRET_DETECTED", label: "Private key", severity: "CRITICAL" }, "[REDACTED_PRIVATE_KEY]"],
    [/\b(?:ssh-rsa|ssh-ed25519)\s+[A-Za-z0-9+/=]{40,}/i, { type: "SECRET_DETECTED", label: "SSH key material", severity: "CRITICAL" }, "[REDACTED_SSH_KEY]"],
    [/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g, { type: "SECRET_DETECTED", label: "JWT token", severity: "HIGH" }, "[REDACTED_JWT]"],
    [/\b(?:postgres|postgresql|mysql|mongodb|redis):\/\/[^\s"']+/gi, { type: "SECRET_DETECTED", label: "Database URL", severity: "CRITICAL" }, "[REDACTED_DATABASE_URL]"],
    [/\b(?:session|cookie|set-cookie)\s*[:=]\s*[^\s;]{12,}/gi, { type: "SECRET_DETECTED", label: "Session cookie", severity: "HIGH" }, "[REDACTED_SESSION_COOKIE]"],
    [/\b(?:password|otp|client_secret|api[_-]?key|access[_-]?token)\s*[:=]\s*[^\s"']{4,}/gi, { type: "SECRET_DETECTED", label: "Credential assignment", severity: "HIGH" }, "[REDACTED_SECRET]"],
  ];

  for (const [regex, redaction, replacement] of extraRules) {
    if (regex.test(text)) {
      extraRedactions.push(redaction);
      policyMatches.push({ id: `data.${redaction.label.toLowerCase().replace(/\s+/g, "_")}`, label: redaction.label, severity: redaction.severity });
      safeContent = safeContent.replace(regex, replacement);
    }
  }

  const redactions = [
    ...guard.findings
      .filter((finding) => ["SECRET_DETECTED", "PII_DETECTED", "INDIA_PII_DETECTED", "SYSTEM_PROMPT_LEAKAGE"].includes(finding.type))
      .map((finding) => ({ type: finding.type, label: finding.label, severity: finding.severity as AgentRiskLevel })),
    ...extraRedactions,
  ];

  const hasSecrets = guard.riskTypes.includes("SECRET_DETECTED") || extraRedactions.some((item) => item.type === "SECRET_DETECTED");
  const hasPii = guard.riskTypes.includes("PII_DETECTED") || guard.riskTypes.includes("INDIA_PII_DETECTED");
  const promptAttack = guard.riskTypes.includes("PROMPT_INJECTION") || guard.riskTypes.includes("JAILBREAK") || guard.riskTypes.includes("SYSTEM_PROMPT_LEAK_ATTEMPT");
  const guardBlocked = guard.action === "BLOCK" || guard.action === "HUMAN_REVIEW";
  let riskLevel: AgentRiskLevel = riskLevelFromScore(guard.riskScore);
  if (destination === "external" && hasSecrets) riskLevel = "CRITICAL";
  else if (destination === "external" && hasPii) riskLevel = "HIGH";
  else if (redactions.length > 0 && riskLevel === "LOW") riskLevel = "MEDIUM";

  return { guard, safeContent, redactions, policyMatches, hasSecrets, hasPii, promptAttack, guardBlocked, riskLevel };
}

function agentDecision(
  decisionValue: AgentDecision,
  riskLevel: AgentRiskLevel,
  reason: string,
  originalContent: string,
  policyMatches: AgentPolicyMatch[],
  redactions: AgentRedaction[],
  auditId?: string,
  safeContent?: string,
): AgentActionDecisionResult {
  const result: AgentActionDecisionResult = {
    decision: decisionValue,
    riskLevel,
    reason,
    safeContent: safeContent && safeContent !== originalContent ? safeContent : safeContent,
    redactions,
    policyMatches,
    auditId,
  };
  if (decisionValue === "ASK_APPROVAL") {
    const { approvalToken } = createApprovalToken();
    result.requiredApproval = {
      message: `${reason} Review the redacted action details before allowing execution.`,
      approvalToken,
    };
  }
  return result;
}

function normalize(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function baseAgentRiskScore(tool: string, action: string, destination: AgentDestination, context?: AgentRiskContext) {
  let score = 15;
  const combined = `${tool} ${action}`;
  if (/browser\.(type|submit)|submit_form|form/.test(combined)) score = Math.max(score, 70);
  if (/gmail\.send|send_email|email\.send/.test(combined)) score = Math.max(score, 75);
  if (/filesystem\.write|write/.test(combined)) score = Math.max(score, 65);
  if (/filesystem\.delete|delete|remove|drop|truncate|purge/.test(combined)) score = Math.max(score, 90);
  if (/terminal\.run|shell|command|exec/.test(combined)) score = Math.max(score, 85);
  if (/payment|checkout|charge|refund|bank|upi/.test(combined)) score = Math.max(score, 95);
  if (/api\.call|http|post|external/.test(combined) && destination === "external") score = Math.max(score, 70);
  if (/clipboard\.write/.test(combined)) score = Math.max(score, 70);
  if (/calendar\.create/.test(combined)) score = Math.max(score, 50);
  if (context?.canRunCode) score = Math.max(score, 90);
  if (context?.canDeleteData) score = Math.max(score, 90);
  if (context?.canSendMessage) score = Math.max(score, 75);
  if (context?.canModifyData) score = Math.max(score, 65);
  if (context?.canMakePayment) score = Math.max(score, 95);
  if (context?.canDisableSecurity) score = Math.max(score, 95);
  if (destination === "external") score += 10;
  return Math.min(100, score);
}

function riskLevelFromScore(score: number): AgentRiskLevel {
  if (score >= 90) return "CRITICAL";
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

function riskScoreFromGuard(level: AgentRiskLevel) {
  if (level === "CRITICAL") return 95;
  if (level === "HIGH") return 75;
  if (level === "MEDIUM") return 45;
  return 15;
}

function riskyContext(context: AgentRiskContext | undefined, score: number) {
  return score >= 70 || Boolean(context?.canRunCode || context?.canModifyData || context?.canDeleteData || context?.canSendMessage || context?.externalDestination || context?.canMakePayment);
}

function matchesTool(tool: string, patterns: string[]) {
  return patterns.some((pattern) => tool === pattern.toLowerCase() || tool.startsWith(`${pattern.toLowerCase()}.`) || globishMatch(pattern, tool));
}

function requiresApprovalByEnv(tool: string, action: string) {
  if (agentEnvFlag("REQUIRE_APPROVAL_FOR_EMAIL_SEND", true) && /gmail\.send|send_email|email\.send/.test(`${tool} ${action}`)) return true;
  if (agentEnvFlag("REQUIRE_APPROVAL_FOR_FILE_WRITE", true) && /filesystem\.write|write_file/.test(`${tool} ${action}`)) return true;
  if (agentEnvFlag("REQUIRE_APPROVAL_FOR_EXTERNAL_POST", true) && /\b(post|submit|upload)\b/.test(action)) return true;
  return false;
}

function isDangerousTerminalAction(tool: string, action: string, text: string) {
  if (!agentEnvFlag("BLOCK_TERMINAL_DANGEROUS_COMMANDS", true)) return false;
  if (!/terminal\.run|shell|command|exec/.test(`${tool} ${action}`)) return false;
  const command = text.toLowerCase();
  return DEFAULT_DANGEROUS_TERMINAL_PATTERNS.some((pattern) => globishMatch(pattern, command))
    || /curl\b[\s\S]{0,200}\|\s*(?:bash|sh)/i.test(text)
    || /wget\b[\s\S]{0,200}\|\s*(?:bash|sh)/i.test(text)
    || /invoke-webrequest\b[\s\S]{0,200}\|\s*iex/i.test(text);
}

function isBlockedFileTarget(value: string, policy: AgentFirewallPolicy) {
  const normalized = normalizePath(value);
  if (!normalized) return false;
  return policy.blockedFilePatterns.some((pattern) => globishMatch(pattern.toLowerCase(), normalized));
}

function isOutsideAllowedWorkspace(target: string, allowedWorkspaceDirs: string[]) {
  if (!target.trim()) return true;
  if (allowedWorkspaceDirs.length === 0) return true;
  const normalizedTarget = normalizePath(target);
  return !allowedWorkspaceDirs.some((dir) => {
    const normalizedWorkspace = normalizePath(dir);
    return normalizedTarget === normalizedWorkspace
      || normalizedTarget.startsWith(normalizedWorkspace.endsWith("/") ? normalizedWorkspace : `${normalizedWorkspace}/`);
  });
}

function normalizePath(value: string) {
  return value.replace(/\\/g, "/").replace(/^file:\/\//, "").trim().toLowerCase();
}

function globishMatch(pattern: string, value: string) {
  const normalizedPattern = pattern.replace(/\\/g, "/").toLowerCase();
  const normalizedValue = value.replace(/\\/g, "/").toLowerCase();
  if (!normalizedPattern.includes("*")) {
    return normalizedValue === normalizedPattern
      || normalizedValue.endsWith(`/${normalizedPattern}`)
      || normalizedValue.includes(normalizedPattern);
  }
  const escaped = normalizedPattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`(^|/)${escaped}$|${escaped}`).test(normalizedValue);
}

function isSecurityBypassAttempt(text: string) {
  return /ignore.*safety|disable.*security|disable.*guard|bypass.*guard|turn off.*firewall|without.*approval|skip.*approval|ignore.*policy/i.test(text);
}

function evaluateTargetDomain(value: string, policy: AgentFirewallPolicy) {
  const domain = extractDomain(value);
  if (!domain) return { domain: undefined, allowed: false, blocked: false };
  return {
    domain,
    allowed: domainMatches(domain, policy.allowedDomains),
    blocked: domainMatches(domain, policy.blockedDomains),
  };
}

function extractDomain(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    return url.hostname.toLowerCase();
  } catch {
    const urlMatch = trimmed.match(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/i);
    if (urlMatch?.[1]) return urlMatch[1].toLowerCase();
    const emailMatch = trimmed.match(/@([a-z0-9.-]+\.[a-z]{2,})/i);
    if (emailMatch?.[1]) return emailMatch[1].toLowerCase();
    const domainMatch = trimmed.match(/\b([a-z0-9.-]+\.[a-z]{2,})\b/i);
    return domainMatch?.[1]?.toLowerCase();
  }
}

function domainMatches(domain: string, patterns: string[]) {
  return patterns.some((pattern) => {
    const normalized = pattern.trim().toLowerCase();
    if (!normalized) return false;
    if (normalized.includes("*")) return globishMatch(normalized, domain);
    return domain === normalized || domain.endsWith(`.${normalized}`);
  });
}

function domainMatchesAny(domain: string, patterns: string[]) {
  return patterns.some((pattern) => domainMatches(domain, [pattern]) || domainMatches(pattern, [domain]));
}

function uniq(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function uniqNormalized(values: string[]) {
  return uniq(values.map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function mostRestrictiveDataMode(current: AgentFirewallPolicy["piiMode"], manifestMode: AgentPermissionManifest["dataPolicy"]["externalPII"] | AgentPermissionManifest["dataPolicy"]["externalSecrets"]) {
  const normalized = manifestMode === "ASK_APPROVAL" ? "approval" : manifestMode.toLowerCase() as AgentFirewallPolicy["piiMode"];
  const rank: Record<AgentFirewallPolicy["piiMode"], number> = { redact: 1, approval: 2, block: 3 };
  return rank[normalized] > rank[current] ? normalized : current;
}

function exceedsMaxRiskWithoutApproval(risk: AgentRiskLevel, max: AgentRiskLevel) {
  const rank: Record<AgentRiskLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
  return rank[risk] > rank[max];
}

function agentEnv(name: string) {
  const prefixes = ["CYBERSECURITYGUARD", "CYBERGUARD", "CYBERRAKSHAK", "ZEROVEIL"];
  for (const prefix of prefixes) {
    const value = process.env[`${prefix}_${name}`];
    if (value !== undefined) return value;
  }
  return undefined;
}

function agentEnvFlag(name: string, defaultValue: boolean) {
  const value = agentEnv(name);
  if (value === undefined || value.trim() === "") return defaultValue;
  return !/^(false|0|no|off)$/i.test(value.trim());
}
