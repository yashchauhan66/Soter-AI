// MCP Tool Drift Monitor — pure logic (no DB, no auth).
// Snapshots MCP tool definitions and detects risky drift over time: new
// dangerous capabilities, prompt injection in descriptions, schema parameter
// changes, endpoint changes, and overall risk increases.

import { createHash } from "crypto";
import { analyzeText } from "@/lib/guard/analyze";
import { sanitizeLogText } from "@/lib/guard/logSafety";

export type DriftRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type McpDriftCapability =
  | "file_read" | "file_write" | "file_delete" | "terminal_execute" | "network_request"
  | "email_send" | "calendar_write" | "clipboard_read" | "clipboard_write" | "credential_access"
  | "browser_control" | "database_write" | "payment_action" | "external_post" | "memory_write"
  | "auth_token_access" | "environment_access";
export type DriftType =
  | "DESCRIPTION_CHANGED" | "SCHEMA_CHANGED" | "CAPABILITY_ADDED" | "CAPABILITY_REMOVED"
  | "RISK_INCREASED" | "PROMPT_INJECTION_DETECTED" | "ENDPOINT_CHANGED" | "UNKNOWN";

export interface McpToolInput {
  name: string;
  description?: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
  endpoint?: string;
}

export interface McpToolSnapshot {
  toolName: string;
  toolDescriptionHash: string;
  inputSchemaHash: string;
  outputSchemaHash: string | null;
  endpointHash: string | null;
  toolDescriptionRedacted: string;
  inputSchemaJson: unknown;
  outputSchemaJson: unknown;
  detectedCapabilities: McpDriftCapability[];
  riskLevel: DriftRiskLevel;
  riskReasons: string[];
  promptInjectionDetected: boolean;
}

export interface McpDrift {
  toolName: string;
  driftType: DriftType;
  riskBefore: DriftRiskLevel;
  riskAfter: DriftRiskLevel;
  summary: string;
  recommendation: string;
}

const RISK_ORDER: Record<DriftRiskLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

function hash(value: string): string {
  return createHash("sha256").update(value ?? "").digest("hex");
}

function highestRisk(levels: DriftRiskLevel[]): DriftRiskLevel {
  return levels.reduce<DriftRiskLevel>((max, level) => RISK_ORDER[level] > RISK_ORDER[max] ? level : max, "LOW");
}

export function detectCapabilities(text: string): McpDriftCapability[] {
  const lower = text.toLowerCase();
  const caps: McpDriftCapability[] = [];
  if (/read|open|get|list/.test(lower) && /file|filesystem|path|directory/.test(lower)) caps.push("file_read");
  if (/write|create|save|append/.test(lower) && /file|filesystem|path/.test(lower)) caps.push("file_write");
  if (/delete|remove|unlink|rm\b/.test(lower) && /file|filesystem|path/.test(lower)) caps.push("file_delete");
  if (/terminal|shell|command|exec|process|powershell|bash|run code/.test(lower)) caps.push("terminal_execute");
  if (/fetch|http|request|url|post|webhook/.test(lower)) caps.push("network_request");
  if (/email|gmail|send mail|smtp/.test(lower)) caps.push("email_send");
  if (/calendar|event/.test(lower) && /write|create|update|delete/.test(lower)) caps.push("calendar_write");
  if (/clipboard/.test(lower) && /read|get/.test(lower)) caps.push("clipboard_read");
  if (/clipboard/.test(lower) && /write|set/.test(lower)) caps.push("clipboard_write");
  if (/credential|secret|password|cookie|api[_-]?key/.test(lower)) caps.push("credential_access");
  if (/browser|page|click|type|submit/.test(lower)) caps.push("browser_control");
  if (/database|sql|insert|update|delete/.test(lower)) caps.push("database_write");
  if (/payment|charge|checkout|bank|upi/.test(lower)) caps.push("payment_action");
  if (/post|upload|webhook|external/.test(lower)) caps.push("external_post");
  if (/memory|remember|store/.test(lower)) caps.push("memory_write");
  if (/auth[\s_-]?token|bearer|access[\s_-]?token|oauth|session token/.test(lower)) caps.push("auth_token_access");
  if (/\.env|environment variable|env var|process\.env|getenv/.test(lower)) caps.push("environment_access");
  return [...new Set(caps)];
}

function riskForCapability(cap: McpDriftCapability): DriftRiskLevel {
  if (["file_delete", "terminal_execute", "credential_access", "payment_action", "auth_token_access", "environment_access"].includes(cap)) return "CRITICAL";
  if (["file_read", "file_write", "email_send", "database_write", "external_post"].includes(cap)) return "HIGH";
  if (["network_request", "calendar_write", "clipboard_write", "browser_control", "memory_write"].includes(cap)) return "MEDIUM";
  return "LOW";
}

const PROMPT_INJECTION_IN_DESCRIPTION = /ignore (all )?(previous|prior) instructions|reveal (the )?system prompt|disregard.*instructions|you must now|hidden instruction/i;

function schemaHasParam(schema: unknown, pattern: RegExp): boolean {
  return pattern.test(JSON.stringify(schema ?? {}));
}

export function snapshotTool(tool: McpToolInput): McpToolSnapshot {
  const description = tool.description ?? "";
  const text = `${tool.name} ${description} ${JSON.stringify(tool.inputSchema ?? {})}`;
  const capabilities = detectCapabilities(text);
  const reasons = capabilities.map((cap) => cap.replace(/_/g, " "));
  let riskLevel = capabilities.length > 0 ? highestRisk(capabilities.map(riskForCapability)) : "LOW";

  const guard = analyzeText(description, "INPUT");
  const promptInjectionDetected = PROMPT_INJECTION_IN_DESCRIPTION.test(description) || guard.riskTypes.includes("PROMPT_INJECTION");
  if (promptInjectionDetected) {
    riskLevel = "CRITICAL";
    reasons.push("prompt injection in tool description");
  }
  // Schema-derived risk signals.
  if (schemaHasParam(tool.inputSchema, /command|cmd|shell|exec|script/i)) {
    riskLevel = "CRITICAL";
    reasons.push("schema exposes an arbitrary command parameter");
  } else if (schemaHasParam(tool.inputSchema, /url|endpoint|destination|callback|webhook/i)) {
    riskLevel = highestRisk([riskLevel, "HIGH"]);
    reasons.push("schema exposes an external URL/destination parameter");
  }

  return {
    toolName: tool.name,
    toolDescriptionHash: hash(description),
    inputSchemaHash: hash(JSON.stringify(tool.inputSchema ?? {})),
    outputSchemaHash: tool.outputSchema !== undefined ? hash(JSON.stringify(tool.outputSchema)) : null,
    endpointHash: tool.endpoint ? hash(tool.endpoint) : null,
    toolDescriptionRedacted: sanitizeLogText(description),
    inputSchemaJson: tool.inputSchema ?? {},
    outputSchemaJson: tool.outputSchema ?? null,
    detectedCapabilities: capabilities,
    riskLevel,
    riskReasons: [...new Set(reasons)],
    promptInjectionDetected,
  };
}

/** Compare a previous snapshot to the current one and emit drift records. */
export function diffSnapshots(previous: McpToolSnapshot | null, current: McpToolSnapshot): McpDrift[] {
  if (!previous) return [];
  const drifts: McpDrift[] = [];
  const base = { toolName: current.toolName, riskBefore: previous.riskLevel, riskAfter: current.riskLevel };

  const addedCaps = current.detectedCapabilities.filter((cap) => !previous.detectedCapabilities.includes(cap));
  const removedCaps = previous.detectedCapabilities.filter((cap) => !current.detectedCapabilities.includes(cap));

  if (current.promptInjectionDetected && !previous.promptInjectionDetected) {
    drifts.push({ ...base, driftType: "PROMPT_INJECTION_DETECTED", summary: "Prompt-injection text appeared in the tool description.", recommendation: "Quarantine the server and block this tool until reviewed." });
  }
  for (const cap of addedCaps) {
    const risk = riskForCapability(cap);
    drifts.push({
      ...base,
      driftType: "CAPABILITY_ADDED",
      riskAfter: risk === "CRITICAL" ? "CRITICAL" : current.riskLevel,
      summary: `Tool gained a new capability: ${cap.replace(/_/g, " ")}.`,
      recommendation: risk === "CRITICAL" ? "Quarantine the server or require approval for this tool." : "Require approval for this tool.",
    });
  }
  for (const cap of removedCaps) {
    drifts.push({ ...base, driftType: "CAPABILITY_REMOVED", summary: `Tool dropped a capability: ${cap.replace(/_/g, " ")}.`, recommendation: "No action required; verify the change was intended." });
  }
  if (previous.endpointHash !== current.endpointHash) {
    drifts.push({ ...base, driftType: "ENDPOINT_CHANGED", summary: "Tool endpoint changed.", recommendation: "Verify the new endpoint is trusted before allowing calls." });
  }
  if (previous.inputSchemaHash !== current.inputSchemaHash || previous.outputSchemaHash !== current.outputSchemaHash) {
    drifts.push({ ...base, driftType: "SCHEMA_CHANGED", summary: "Tool input/output schema changed.", recommendation: "Review the new schema for risky parameters." });
  }
  if (previous.toolDescriptionHash !== current.toolDescriptionHash) {
    drifts.push({ ...base, driftType: "DESCRIPTION_CHANGED", summary: "Tool description changed.", recommendation: "Review the new description for hidden instructions." });
  }
  if (RISK_ORDER[current.riskLevel] > RISK_ORDER[previous.riskLevel]) {
    drifts.push({ ...base, driftType: "RISK_INCREASED", summary: `Tool risk increased from ${previous.riskLevel} to ${current.riskLevel}.`, recommendation: "Alert: require approval or quarantine until reviewed." });
  }
  return drifts;
}

export function serverRiskLevel(snapshots: McpToolSnapshot[]): DriftRiskLevel {
  return snapshots.length > 0 ? highestRisk(snapshots.map((snapshot) => snapshot.riskLevel)) : "LOW";
}
