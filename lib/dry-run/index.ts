import { randomUUID } from "crypto";
import { analyzeText } from "@/lib/guard/analyze";
import { sanitizeLogText, sanitizeMetadata } from "@/lib/guard/logSafety";

export const DRY_RUN_TYPES = ["EMAIL", "FORM_SUBMIT", "TERMINAL", "FILE_WRITE", "FILE_DELETE", "API_CALL", "PAYMENT", "PACKAGE_INSTALL", "DATABASE_WRITE", "CUSTOM"] as const;
export const DRY_RUN_DECISIONS = ["SAFE_TO_EXECUTE", "REQUIRE_APPROVAL", "BLOCK", "REVIEW"] as const;
export const DRY_RUN_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export type AgentDryRunType = (typeof DRY_RUN_TYPES)[number];
export type AgentDryRunDecision = (typeof DRY_RUN_DECISIONS)[number];
export type AgentDryRunRiskLevel = (typeof DRY_RUN_RISK_LEVELS)[number];

export interface AgentDryRunInput {
  dryRunType: AgentDryRunType;
  tool: string;
  action: string;
  target?: string;
  simulatedPayload?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentDryRunResult {
  dryRunType: AgentDryRunType;
  simulatedPayloadRedacted: string | null;
  simulatedEffects: Record<string, unknown>;
  riskLevel: AgentDryRunRiskLevel;
  decision: AgentDryRunDecision;
  reason: string;
  findings: string[];
}

export function createAgentDryRunId() {
  return `agent_dry_run_${randomUUID()}`;
}

export function simulateAgentAction(input: AgentDryRunInput): AgentDryRunResult {
  const payload = input.simulatedPayload ?? "";
  const target = input.target ?? "";
  const text = `${input.tool} ${input.action} ${target} ${payload}`;
  const guard = analyzeText(payload, "INPUT");
  const findings = new Set<string>();
  const effects = baseEffects(input);

  if (guard.riskTypes.includes("SECRET_DETECTED")) findings.add("SECRET_DETECTED");
  if (guard.riskTypes.includes("PII_DETECTED") || guard.riskTypes.includes("INDIA_PII_DETECTED")) findings.add("PII_DETECTED");
  if (guard.riskTypes.includes("PROMPT_INJECTION") || guard.riskTypes.includes("JAILBREAK")) findings.add("PROMPT_ATTACK");
  if (isPrivateData(input.metadata)) findings.add("PRIVATE_DATA");

  switch (input.dryRunType) {
    case "EMAIL":
      addEmailEffects(effects, target, payload, findings);
      break;
    case "FORM_SUBMIT":
      addFormEffects(effects, target, payload, findings);
      break;
    case "TERMINAL":
      addTerminalEffects(effects, text, findings);
      break;
    case "FILE_WRITE":
    case "FILE_DELETE":
      addFileEffects(effects, input.dryRunType, target || payload, findings);
      break;
    case "API_CALL":
      addApiEffects(effects, target, payload, findings);
      break;
    case "PAYMENT":
      effects.payment = true;
      effects.irreversible = true;
      findings.add("PAYMENT_ACTION");
      break;
    case "PACKAGE_INSTALL":
      addPackageEffects(effects, text, findings);
      break;
    case "DATABASE_WRITE":
      effects.databaseWrite = true;
      effects.tables = metadataList(input.metadata, "tables");
      findings.add("DATABASE_WRITE");
      break;
    default:
      effects.unknown = true;
      findings.add("UNKNOWN_EFFECT");
  }

  return decide(input, effects, [...findings], guard.riskTypes);
}

export function sanitizeDryRunMetadata(metadata?: Record<string, unknown>) {
  return sanitizeMetadata(metadata);
}

export function sanitizeDryRunText(value?: string | null) {
  return value ? sanitizeLogText(value) : null;
}

function baseEffects(input: AgentDryRunInput): Record<string, unknown> {
  return {
    simulateOnly: true,
    dryRunType: input.dryRunType,
    tool: sanitizeLogText(input.tool),
    action: sanitizeLogText(input.action),
    target: sanitizeLogText(input.target ?? ""),
  };
}

function addEmailEffects(effects: Record<string, unknown>, target: string, payload: string, findings: Set<string>) {
  effects.recipients = extractEmails(`${target} ${payload}`);
  effects.externalRecipients = (effects.recipients as string[]).filter((email) => !/@(localhost|internal|example\.local)$/i.test(email));
  effects.attachments = /\b(attach|attachment|file attached)\b/i.test(payload);
  findings.add("EMAIL_SEND");
  if ((effects.externalRecipients as string[]).length > 0) findings.add("EXTERNAL_RECIPIENT");
}

function addFormEffects(effects: Record<string, unknown>, target: string, payload: string, findings: Set<string>) {
  effects.domain = extractDomain(target);
  effects.fields = extractFormFields(payload);
  effects.login = /\b(password|otp|2fa|login|signin|sign in)\b/i.test(payload);
  effects.payment = /\b(card|cvv|payment|pay|checkout|billing)\b/i.test(payload);
  findings.add("FORM_SUBMIT");
  if (effects.login) findings.add("LOGIN_FORM");
  if (effects.payment) findings.add("PAYMENT_FORM");
}

function addTerminalEffects(effects: Record<string, unknown>, text: string, findings: Set<string>) {
  effects.command = sanitizeLogText(text);
  effects.deletesFiles = /\b(rm\s+-rf|del\s+\/|remove-item|unlink|delete)\b/i.test(text);
  effects.networkCalls = /\b(curl|wget|Invoke-WebRequest|http[s]?:\/\/|nc\s|netcat)\b/i.test(text);
  effects.pipeToShell = /\b(curl|wget).*\|\s*(bash|sh|powershell|pwsh)\b/i.test(text);
  findings.add("TERMINAL_COMMAND");
  if (effects.deletesFiles) findings.add("FILE_DELETION");
  if (effects.networkCalls) findings.add("NETWORK_CALL");
  if (effects.pipeToShell) findings.add("CURL_PIPE_SHELL");
}

function addFileEffects(effects: Record<string, unknown>, type: AgentDryRunType, target: string, findings: Set<string>) {
  effects.path = sanitizeLogText(target);
  effects.workspaceSafe = isWorkspaceSafePath(target);
  effects.fileDelete = type === "FILE_DELETE";
  effects.fileWrite = type === "FILE_WRITE";
  findings.add(type);
  if (!effects.workspaceSafe) findings.add("OUTSIDE_WORKSPACE");
}

function addApiEffects(effects: Record<string, unknown>, target: string, payload: string, findings: Set<string>) {
  effects.url = sanitizeLogText(target);
  effects.domain = extractDomain(target);
  effects.method = /\b(PUT|PATCH|DELETE|POST)\b/i.exec(payload)?.[1]?.toUpperCase() ?? "POST";
  effects.external = /^https?:\/\//i.test(target);
  findings.add("API_CALL");
  if (effects.external) findings.add("EXTERNAL_API");
}

function addPackageEffects(effects: Record<string, unknown>, text: string, findings: Set<string>) {
  effects.packageName = /\b(?:npm|pnpm|yarn|pip|cargo)\s+install\s+(@?[a-z0-9._/-]+)/i.exec(text)?.[1] ?? "unknown";
  effects.installScriptsPossible = true;
  findings.add("PACKAGE_INSTALL");
}

function decide(input: AgentDryRunInput, effects: Record<string, unknown>, findings: string[], guardRisks: string[]): AgentDryRunResult {
  const critical = findings.some((finding) => ["SECRET_DETECTED", "CURL_PIPE_SHELL", "OUTSIDE_WORKSPACE"].includes(finding))
    || (findings.includes("FILE_DELETION") && input.dryRunType === "TERMINAL")
    || (findings.includes("NETWORK_CALL") && findings.includes("FILE_DELETION"))
    || (findings.includes("EXTERNAL_API") && findings.some((finding) => ["PRIVATE_DATA", "PII_DETECTED"].includes(finding)));
  const high = findings.some((finding) => ["PII_DETECTED", "PAYMENT_ACTION", "PAYMENT_FORM", "DATABASE_WRITE", "PACKAGE_INSTALL", "EXTERNAL_API"].includes(finding));
  const unknown = findings.includes("UNKNOWN_EFFECT") || input.dryRunType === "CUSTOM";
  const payloadRedacted = input.simulatedPayload ? sanitizeLogText(input.simulatedPayload) : null;

  if (critical) {
    return build(input, payloadRedacted, effects, "CRITICAL", "BLOCK", "Dry-run predicted a critical effect; fail closed before execution.", findings);
  }
  if (guardRisks.includes("PROMPT_INJECTION") || findings.includes("PROMPT_ATTACK")) {
    return build(input, payloadRedacted, effects, "CRITICAL", "BLOCK", "Dry-run payload contains prompt-injection or policy-bypass content.", findings);
  }
  if (high) {
    return build(input, payloadRedacted, effects, "HIGH", "REQUIRE_APPROVAL", "Dry-run predicted a high-risk effect that requires approval.", findings);
  }
  if (unknown) {
    return build(input, payloadRedacted, effects, "MEDIUM", "REVIEW", "Dry-run could not confidently model all effects.", findings);
  }
  if (findings.some((finding) => ["EMAIL_SEND", "FORM_SUBMIT", "FILE_WRITE"].includes(finding))) {
    return build(input, payloadRedacted, effects, "MEDIUM", "REQUIRE_APPROVAL", "Dry-run predicted a state-changing action that requires approval.", findings);
  }
  return build(input, payloadRedacted, effects, "LOW", "SAFE_TO_EXECUTE", "Dry-run found no material risky effects.", findings);
}

function build(
  input: AgentDryRunInput,
  payloadRedacted: string | null,
  effects: Record<string, unknown>,
  riskLevel: AgentDryRunRiskLevel,
  decision: AgentDryRunDecision,
  reason: string,
  findings: string[],
): AgentDryRunResult {
  return {
    dryRunType: input.dryRunType,
    simulatedPayloadRedacted: payloadRedacted,
    simulatedEffects: effects,
    riskLevel,
    decision,
    reason,
    findings,
  };
}

function extractEmails(text: string) {
  return [...new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [])];
}

function extractDomain(target: string) {
  try {
    return new URL(target).hostname;
  } catch {
    return "";
  }
}

function extractFormFields(payload: string) {
  return [...new Set((payload.match(/[a-zA-Z0-9_.-]+=/g) ?? []).map((field) => field.slice(0, -1)).slice(0, 30))];
}

function isWorkspaceSafePath(path: string) {
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  if (!normalized) return false;
  if (normalized.includes("..")) return false;
  if (/^[a-z]:\//i.test(normalized)) return normalized.includes("/ai-agent-security-guard/") || normalized.includes("/workspace/");
  if (normalized.startsWith("/")) return normalized.startsWith("/workspace/") || normalized.includes("/ai-agent-security-guard/");
  return !/\.env|private|secret|id_rsa|cookies?/i.test(normalized);
}

function metadataList(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 20) : [];
}

function isPrivateData(metadata: Record<string, unknown> | undefined) {
  const sensitivity = String(metadata?.sensitivity ?? metadata?.dataSensitivity ?? "").toUpperCase();
  return ["PRIVATE", "CONFIDENTIAL", "SECRET", "REGULATED", "SYSTEM_PROMPT"].includes(sensitivity);
}
