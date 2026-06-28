import { createHash } from "crypto";
import { parsePublicHttpsUrl } from "@/lib/network/outboundUrl";

export interface A2AAgentCard {
  name?: unknown;
  description?: unknown;
  version?: unknown;
  protocolVersion?: unknown;
  url?: unknown;
  preferredTransport?: unknown;
  skills?: unknown;
  securitySchemes?: unknown;
  security?: unknown;
  supportsAuthenticatedExtendedCard?: unknown;
  [key: string]: unknown;
}

export interface A2ACardInspection {
  decision: "ALLOW" | "REVIEW" | "BLOCK";
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  cardHash: string;
  agentName: string | null;
  endpoint: string | null;
  protocolVersion: string | null;
  skillIds: string[];
  securitySchemeNames: string[];
  findings: Array<{ id: string; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; message: string }>;
}

export function inspectA2AAgentCard(card: A2AAgentCard, requestedSkillId?: string): A2ACardInspection {
  const findings: A2ACardInspection["findings"] = [];
  const add = (id: string, severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL", message: string) => findings.push({ id, severity, message });
  const name = text(card.name);
  const endpoint = text(card.url);
  const protocolVersion = text(card.protocolVersion);
  if (!name) add("a2a.card.name_missing", "HIGH", "Agent Card name is required.");
  if (!protocolVersion) add("a2a.card.protocol_missing", "MEDIUM", "Agent Card protocolVersion is missing.");
  if (!endpoint) add("a2a.card.endpoint_missing", "CRITICAL", "Agent Card endpoint URL is required.");
  else {
    try { parsePublicHttpsUrl(endpoint); } catch (error) { add("a2a.card.endpoint_unsafe", "CRITICAL", error instanceof Error ? error.message : "Agent endpoint is unsafe."); }
  }

  const skillIds = extractSkills(card.skills, add);
  if (!skillIds.length) add("a2a.card.skills_missing", "HIGH", "Agent Card declares no callable skills.");
  if (requestedSkillId && !skillIds.includes(requestedSkillId)) add("a2a.card.skill_not_declared", "CRITICAL", `Requested skill ${requestedSkillId} is not declared by the Agent Card.`);

  const schemes = securitySchemes(card.securitySchemes);
  if (!schemes.length) add("a2a.card.authentication_missing", "CRITICAL", "Production Agent Cards must advertise authentication security schemes.");
  const securityRequirements = Array.isArray(card.security) ? card.security : [];
  if (schemes.length && !securityRequirements.length) add("a2a.card.security_requirement_missing", "HIGH", "Security schemes exist but no Agent Card security requirement selects them.");
  if (containsSecretMaterial(card)) add("a2a.card.secret_embedded", "CRITICAL", "Agent Card appears to embed credential or secret material.");

  const highest = highestSeverity(findings.map((finding) => finding.severity));
  const decision = highest === "CRITICAL" ? "BLOCK" : highest === "HIGH" || highest === "MEDIUM" ? "REVIEW" : "ALLOW";
  return {
    decision,
    riskLevel: highest,
    cardHash: createHash("sha256").update(stableStringify(card)).digest("hex"),
    agentName: name,
    endpoint,
    protocolVersion,
    skillIds,
    securitySchemeNames: schemes,
    findings,
  };
}

function extractSkills(value: unknown, add: (id: string, severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL", message: string) => void) {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const skill of value) {
    if (!skill || typeof skill !== "object" || Array.isArray(skill) || typeof (skill as Record<string, unknown>).id !== "string") {
      add("a2a.card.skill_invalid", "HIGH", "Every Agent Card skill must have a string id.");
      continue;
    }
    const id = ((skill as Record<string, unknown>).id as string).trim();
    if (!id) add("a2a.card.skill_invalid", "HIGH", "Agent Card skill ids cannot be empty.");
    else if (ids.includes(id)) add("a2a.card.skill_duplicate", "HIGH", `Duplicate Agent Card skill id ${id}.`);
    else ids.push(id);
  }
  return ids;
}

function securitySchemes(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).filter(([, scheme]) => scheme && typeof scheme === "object" && !Array.isArray(scheme)).map(([name]) => name);
}

function containsSecretMaterial(value: unknown, key = "", depth = 0): boolean {
  if (depth > 8) return false;
  if (/password|private.?key|client.?secret|access.?token|refresh.?token|credentials?/i.test(key) && typeof value === "string" && value.trim()) return true;
  if (typeof value === "string") return /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bsk-[a-z0-9_-]{16,}\b/i.test(value);
  if (Array.isArray(value)) return value.some((item) => containsSecretMaterial(item, key, depth + 1));
  if (value && typeof value === "object") return Object.entries(value as Record<string, unknown>).some(([childKey, item]) => containsSecretMaterial(item, childKey, depth + 1));
  return false;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function highestSeverity(values: Array<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">) {
  const order = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
  return [...values].sort((a, b) => order.indexOf(b) - order.indexOf(a))[0] ?? "LOW";
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}
