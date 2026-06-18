import { createHash, randomBytes } from "crypto";
import { analyzeText } from "@/lib/guard/analyze";
import { sanitizeLogText } from "@/lib/guard/logSafety";
import type { AgentDecision, AgentRiskLevel } from "@/lib/agent-firewall";

export type Mvp3Decision = AgentDecision | "TAKEOVER_REQUIRED";
export type McpCapability =
  | "file_read"
  | "file_write"
  | "file_delete"
  | "terminal_execute"
  | "network_request"
  | "email_send"
  | "calendar_write"
  | "clipboard_read"
  | "clipboard_write"
  | "credential_access"
  | "browser_control"
  | "database_write"
  | "payment_action"
  | "external_post"
  | "memory_write";

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export interface McpToolScanResult {
  serverRiskLevel: AgentRiskLevel;
  tools: Array<{
    tool: string;
    riskLevel: AgentRiskLevel;
    capabilities: McpCapability[];
    reasons: string[];
    recommendedDecision: "ALLOW" | "ASK_APPROVAL" | "BLOCK";
  }>;
  recommendedManifest: {
    allowedTools: string[];
    approvalRequired: string[];
    blocked: string[];
  };
}

export function scanMcpTools(input: { serverName: string; tools: McpToolDefinition[] }): McpToolScanResult {
  const tools = input.tools.map((tool) => {
    const text = `${tool.name} ${tool.description ?? ""} ${JSON.stringify(tool.inputSchema ?? {})}`.toLowerCase();
    const capabilities = detectMcpCapabilities(text);
    const riskLevel = highestRisk(capabilities.map(riskForMcpCapability));
    const reasons = capabilities.map(reasonForMcpCapability);
    const recommendedDecision: "ALLOW" | "ASK_APPROVAL" | "BLOCK" =
      riskLevel === "CRITICAL" ? "BLOCK" : riskLevel === "HIGH" ? "ASK_APPROVAL" : "ALLOW";
    return { tool: tool.name, riskLevel, capabilities, reasons, recommendedDecision };
  });
  return {
    serverRiskLevel: highestRisk(tools.map((tool) => tool.riskLevel)),
    tools,
    recommendedManifest: {
      allowedTools: tools.filter((tool) => tool.recommendedDecision === "ALLOW").map((tool) => tool.tool),
      approvalRequired: tools.filter((tool) => tool.recommendedDecision === "ASK_APPROVAL").map((tool) => tool.tool),
      blocked: tools.filter((tool) => tool.recommendedDecision === "BLOCK").map((tool) => tool.tool),
    },
  };
}

export function checkBrowserForm(input: {
  url?: string;
  domain?: string;
  formFields: Array<{ name: string; value?: string; type?: string }>;
  pageText?: string;
  destination?: string;
}) {
  const allText = `${input.pageText ?? ""}\n${input.formFields.map((field) => `${field.name} ${field.type ?? ""} ${field.value ?? ""}`).join("\n")}`;
  const guard = analyzeText(allText, "INPUT");
  const redacted = sanitizeLogText(allText);
  const fields = input.formFields.map((field) => ({ ...field, value: field.value ? sanitizeLogText(field.value) : field.value }));
  const sensitiveField = input.formFields.find((field) => /password|otp|one.?time|cvv|card|payment|upi|pin/i.test(`${field.name} ${field.type}`));
  if (sensitiveField && /password|otp|one.?time|cvv|card|payment|pin/i.test(`${sensitiveField.name} ${sensitiveField.type}`)) {
    return formDecision("TAKEOVER_REQUIRED", "CRITICAL", "Human takeover required for password, OTP, or payment form fields.", fields, guard.findings);
  }
  if (guard.riskTypes.includes("PROMPT_INJECTION") || /ignore (all )?(previous|safety)|disable guard|reveal system prompt/i.test(input.pageText ?? "")) {
    return formDecision("BLOCK", "CRITICAL", "Blocked form submission because the page contains prompt-injection instructions.", fields, guard.findings);
  }
  if (guard.riskTypes.includes("SECRET_DETECTED") || /api[_-]?key|private key|client_secret/i.test(redacted)) {
    return formDecision("BLOCK", "CRITICAL", "Blocked secret-bearing form submission.", fields, guard.findings);
  }
  if ((input.destination ?? "external") === "external" && (guard.riskTypes.includes("PII_DETECTED") || guard.riskTypes.includes("INDIA_PII_DETECTED"))) {
    return formDecision("ASK_APPROVAL", "HIGH", "External form contains personal data and requires approval.", fields, guard.findings);
  }
  return formDecision("ALLOW", "LOW", "Browser form allowed by policy.", fields, []);
}

export function checkMemory(input: { memoryAction: string; content?: string; memoryType?: string }) {
  const content = input.content ?? "";
  const guard = analyzeText(content, "INPUT");
  const poisoning = /ignore.*future|future agent.*ignore|exfiltrate.*later|store.*bypass|change.*permission|hidden instruction|disable.*safety/i.test(content);
  if (poisoning) {
    return memoryDecision("BLOCK", "CRITICAL", "Blocked memory poisoning instruction.", content, guard.findings);
  }
  if (guard.riskTypes.includes("SECRET_DETECTED") || /password|otp|private key|database_url|client_secret/i.test(content)) {
    return memoryDecision("BLOCK", "CRITICAL", "Blocked sensitive credential or secret from agent memory.", content, guard.findings);
  }
  if (guard.riskTypes.includes("INDIA_PII_DETECTED")) {
    return memoryDecision("BLOCK", "HIGH", "Blocked regulated personal identifier from agent memory.", content, guard.findings);
  }
  if (guard.riskTypes.includes("PII_DETECTED")) {
    return memoryDecision("REDACT", "MEDIUM", "Memory content allowed only after personal data redaction.", content, guard.findings, guard.redactedText);
  }
  return memoryDecision("ALLOW", "LOW", "Memory operation allowed.", content, []);
}

export function scoreRagDocument(input: { content: string; source?: string }) {
  const content = input.content ?? "";
  const guard = analyzeText(content, "INPUT");
  const findings: Array<{ type: string; label: string; severity: string }> = [
    ...guard.findings.map((finding) => ({ type: String(finding.type), label: finding.label, severity: String(finding.severity) })),
  ];
  let score = input.source && ["upload", "api"].includes(input.source) ? 75 : 60;
  if (input.source === "url" || input.source === "email" || input.source === "unknown") score -= 15;
  if (/ignore (all )?(previous|prior)|reveal system prompt|exfiltrate|send secrets|developer message/i.test(content)) {
    score -= 60;
    findings.push({ type: "PROMPT_INJECTION", label: "Document instruction injection", severity: "CRITICAL" });
  }
  if (/base64|atob\(|eval\(|display:\s*none|font-size:\s*0|white-on-white/i.test(content)) {
    score -= 20;
    findings.push({ type: "SUSPICIOUS_ENCODING", label: "Hidden or encoded content", severity: "HIGH" });
  }
  if (guard.riskTypes.includes("SECRET_DETECTED")) score -= 35;
  if (guard.riskTypes.includes("PII_DETECTED") || guard.riskTypes.includes("INDIA_PII_DETECTED")) score -= 20;
  score = Math.max(0, Math.min(100, score));
  const trustLevel = score < 25 ? "QUARANTINED" : score < 55 ? "NEEDS_REVIEW" : score < 75 ? "SUSPICIOUS" : "TRUSTED";
  const recommendedAction = trustLevel === "QUARANTINED"
    ? "QUARANTINE"
    : guard.riskTypes.includes("SECRET_DETECTED") || guard.riskTypes.includes("PII_DETECTED") || guard.riskTypes.includes("INDIA_PII_DETECTED")
      ? "REDACT_AND_INDEX"
      : trustLevel === "TRUSTED" ? "INDEX" : "REVIEW";
  return { trustScore: score, trustLevel, findings, recommendedAction };
}

export function createCanary(input: { scope: string; label?: string }) {
  const token = `CYBERGUARD_CANARY_${randomBytes(18).toString("base64url")}`;
  return {
    canaryToken: token,
    tokenHash: hashCanaryToken(token),
    tokenLabel: input.label ?? input.scope.toLowerCase(),
    scope: input.scope,
    instructions: "Place this token only in protected context and call /api/canary/check before external output.",
  };
}

export function hashCanaryToken(token: string) {
  const pepper = process.env.API_KEY_PEPPER ?? process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "cybersecurityguard-canary";
  return createHash("sha256").update(`${token}.${pepper}`).digest("hex");
}

export function checkCanaryContent(content: string, canaries: Array<{ id: string; tokenHash: string; tokenLabel: string; scope: string }>) {
  const tokens = Array.from(content.matchAll(/CYBERGUARD_CANARY_[A-Za-z0-9_-]+/g)).map((match) => match[0]);
  const matchedCanaries = canaries.filter((canary) => tokens.some((token) => hashCanaryToken(token) === canary.tokenHash));
  if (matchedCanaries.length > 0) {
    return {
      leakDetected: true,
      matchedCanaries: matchedCanaries.map(({ id, tokenLabel, scope }) => ({ id, tokenLabel, scope })),
      decision: "BLOCK" as const,
      riskLevel: "CRITICAL" as const,
      reason: "Protected context canary leaked.",
    };
  }
  return { leakDetected: false, matchedCanaries: [], decision: "ALLOW" as const, riskLevel: "LOW" as const, reason: "No canary leak detected." };
}

export function summarizeReplay(events: Array<{ riskLevel?: string; decision?: string; reason?: string; createdAt?: Date | string }>) {
  const riskLevel = highestRisk(events.map((event) => risk(event.riskLevel)));
  const blocked = events.filter((event) => event.decision === "BLOCK").length;
  const approvals = events.filter((event) => event.decision === "ASK_APPROVAL" || event.decision === "APPROVED" || event.decision === "DENIED").length;
  return {
    riskLevel,
    summary: `${events.length} timeline events, ${blocked} blocked, ${approvals} approval-related.`,
    timeline: events,
  };
}

function detectMcpCapabilities(text: string): McpCapability[] {
  const caps: McpCapability[] = [];
  if (/read|open|get|list/.test(text) && /file|filesystem|path|directory/.test(text)) caps.push("file_read");
  if (/write|create|save|append/.test(text) && /file|filesystem|path/.test(text)) caps.push("file_write");
  if (/delete|remove|unlink|rm/.test(text) && /file|filesystem|path/.test(text)) caps.push("file_delete");
  if (/terminal|shell|command|exec|process|powershell|bash/.test(text)) caps.push("terminal_execute");
  if (/fetch|http|request|url|post/.test(text)) caps.push("network_request");
  if (/email|gmail|send mail/.test(text)) caps.push("email_send");
  if (/calendar|event/.test(text) && /write|create|update|delete/.test(text)) caps.push("calendar_write");
  if (/clipboard/.test(text) && /read|get/.test(text)) caps.push("clipboard_read");
  if (/clipboard/.test(text) && /write|set/.test(text)) caps.push("clipboard_write");
  if (/credential|secret|token|api[_-]?key|password|cookie|\.env/.test(text)) caps.push("credential_access");
  if (/browser|page|click|type|submit/.test(text)) caps.push("browser_control");
  if (/database|sql|insert|update|delete/.test(text)) caps.push("database_write");
  if (/payment|charge|checkout|bank|upi/.test(text)) caps.push("payment_action");
  if (/post|upload|webhook|external/.test(text)) caps.push("external_post");
  if (/memory|remember|store/.test(text)) caps.push("memory_write");
  return [...new Set(caps)];
}

function riskForMcpCapability(cap: McpCapability): AgentRiskLevel {
  if (["file_delete", "terminal_execute", "credential_access", "payment_action"].includes(cap)) return "CRITICAL";
  if (["file_read", "file_write", "email_send", "database_write", "external_post"].includes(cap)) return "HIGH";
  if (["network_request", "calendar_write", "clipboard_write", "browser_control", "memory_write"].includes(cap)) return "MEDIUM";
  return "LOW";
}

function reasonForMcpCapability(cap: McpCapability) {
  return cap.replace(/_/g, " ");
}

function highestRisk(levels: AgentRiskLevel[]) {
  const order: Record<AgentRiskLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
  return levels.reduce<AgentRiskLevel>((max, level) => order[level] > order[max] ? level : max, "LOW");
}

function risk(value: unknown): AgentRiskLevel {
  return value === "CRITICAL" || value === "HIGH" || value === "MEDIUM" || value === "LOW" ? value : "LOW";
}

function formDecision(decision: Mvp3Decision, riskLevel: AgentRiskLevel, reason: string, safeFields: unknown[], findings: unknown[]) {
  return { decision, riskLevel, reason, safeFields, findings };
}

function memoryDecision(decision: AgentDecision, riskLevel: AgentRiskLevel, reason: string, content: string, findings: unknown[], safeContent?: string) {
  return { decision, riskLevel, reason, safeContent: safeContent ?? sanitizeLogText(content), redactions: findings };
}
