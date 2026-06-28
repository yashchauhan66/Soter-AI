import { createHash } from "crypto";
import { buildCausalGraph, verifyTrustEventIntegrity, type TrustEventEnvelope } from "@/lib/trust-events";

export type CausalStage = "ENTRY" | "IDENTITY" | "CONTEXT" | "DELEGATION" | "EXECUTION" | "DATA_MOVEMENT" | "OUTPUT" | "CONTROL";

export interface CausalIncident {
  format: "soter.causal-incident.v1";
  incidentFingerprint: string;
  traceId: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  riskScore: number;
  containmentStatus: "OBSERVED" | "CONTAINED" | "ESCALATED";
  eventCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  stages: Array<{ stage: CausalStage; eventIds: string[] }>;
  rootCause: { eventId: string; eventType: string; source: string; reason: string } | null;
  riskTypes: string[];
  affectedAgentIds: string[];
  affectedResources: Array<{ type: string; id: string | null }>;
  controlIds: string[];
  integrityValid: boolean;
  graph: ReturnType<typeof buildCausalGraph>;
  recommendations: string[];
}

export function correlateCausalTrace(events: TrustEventEnvelope[]): CausalIncident | null {
  if (!events.length) return null;
  const ordered = [...events].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  const traceId = ordered[0].traceId;
  if (ordered.some((event) => event.traceId !== traceId)) throw new Error("Causal correlation requires a single traceId.");
  const stageMap = new Map<CausalStage, string[]>();
  for (const event of ordered) {
    const stage = classifyStage(event);
    stageMap.set(stage, [...(stageMap.get(stage) ?? []), event.eventId]);
  }
  const riskTypes = unique(ordered.flatMap((event) => event.riskTypes));
  const severeEvents = ordered.filter((event) => event.severity === "HIGH" || event.severity === "CRITICAL" || event.decision === "BLOCK" || event.decision === "ERROR" || event.riskTypes.length > 0);
  const stageBreadth = stageMap.size;
  const severityPoints = ordered.reduce((max, event) => Math.max(max, severityScore(event.severity)), 0);
  const decisionPoints = ordered.reduce((sum, event) => sum + (event.decision === "BLOCK" ? 12 : event.decision === "ASK_APPROVAL" ? 8 : event.decision === "ERROR" ? 15 : 0), 0);
  const propagationPoints = Math.max(0, stageBreadth - 1) * 6 + Math.max(0, ordered.length - 3) * 2;
  const riskScore = Math.min(100, severityPoints + Math.min(25, decisionPoints) + Math.min(25, propagationPoints) + Math.min(20, riskTypes.length * 4));
  const root = severeEvents[0] ?? ordered.find((event) => event.parentSpanId === null) ?? ordered[0];
  const riskyAllows = ordered.filter((event) => event.decision === "ALLOW" && (event.severity === "HIGH" || event.severity === "CRITICAL" || event.riskTypes.length > 0));
  const blocked = ordered.some((event) => event.decision === "BLOCK" || event.decision === "ASK_APPROVAL");
  const containmentStatus = riskyAllows.length ? "ESCALATED" : blocked ? "CONTAINED" : "OBSERVED";
  const affectedResources = dedupeResources(ordered);
  const fingerprintMaterial = { traceId, rootEventType: root.eventType, riskTypes: [...riskTypes].sort(), agents: unique(ordered.map((event) => event.agentIdentityId).filter((value): value is string => Boolean(value))).sort() };

  return {
    format: "soter.causal-incident.v1",
    incidentFingerprint: createHash("sha256").update(stableStringify(fingerprintMaterial)).digest("hex"),
    traceId,
    severity: riskLevel(riskScore),
    riskScore,
    containmentStatus,
    eventCount: ordered.length,
    firstSeenAt: ordered[0].occurredAt,
    lastSeenAt: ordered.at(-1)!.occurredAt,
    stages: [...stageMap].map(([stage, eventIds]) => ({ stage, eventIds })),
    rootCause: root ? { eventId: root.eventId, eventType: root.eventType, source: root.source, reason: root.riskTypes.length ? `Earliest risk signal: ${root.riskTypes.join(", ")}` : `Earliest correlated ${root.severity.toLowerCase()} event.` } : null,
    riskTypes,
    affectedAgentIds: unique(ordered.map((event) => event.agentIdentityId).filter((value): value is string => Boolean(value))),
    affectedResources,
    controlIds: unique(ordered.flatMap((event) => event.controlIds)),
    integrityValid: ordered.every(verifyTrustEventIntegrity),
    graph: buildCausalGraph(ordered),
    recommendations: recommendations({ containmentStatus, riskTypes, stages: [...stageMap.keys()], integrityValid: ordered.every(verifyTrustEventIntegrity) }),
  };
}

export function correlateCausalIncidents(events: TrustEventEnvelope[]) {
  const traces = Map.groupBy(events, (event) => event.traceId);
  return [...traces.values()].map(correlateCausalTrace).filter((incident): incident is CausalIncident => Boolean(incident)).sort((a, b) => b.riskScore - a.riskScore || b.lastSeenAt.localeCompare(a.lastSeenAt));
}

export function buildCausalSiemPayload(incident: CausalIncident) {
  const payload = {
    format: "soter.siem.causal-incident.v1",
    traceId: incident.traceId,
    incidentFingerprint: incident.incidentFingerprint,
    severity: incident.severity,
    riskScore: incident.riskScore,
    containmentStatus: incident.containmentStatus,
    eventCount: incident.eventCount,
    firstSeenAt: incident.firstSeenAt,
    lastSeenAt: incident.lastSeenAt,
    stages: incident.stages.map((stage) => ({ stage: stage.stage, eventCount: stage.eventIds.length })),
    rootCause: incident.rootCause,
    riskTypes: incident.riskTypes,
    affectedAgentIds: incident.affectedAgentIds,
    affectedResources: incident.affectedResources,
    controlIds: incident.controlIds,
    integrityValid: incident.integrityValid,
    recommendations: incident.recommendations,
  };
  return { ...payload, contentHash: createHash("sha256").update(stableStringify(payload)).digest("hex") };
}

export function classifyStage(event: TrustEventEnvelope): CausalStage {
  const combined = `${event.eventType} ${event.source} ${event.action} ${event.riskTypes.join(" ")}`.toLowerCase();
  if (/rag|retriev|document|context|memory/.test(combined)) return "CONTEXT";
  if (/passport|identity|auth|credential/.test(combined)) return "IDENTITY";
  if (/a2a|delegate|subagent|agent.to.agent/.test(combined)) return "DELEGATION";
  if (/tool|terminal|execute|filesystem|browser|email|payment|database/.test(combined)) return "EXECUTION";
  if (/egress|exfil|external|upload|send|data/.test(combined)) return "DATA_MOVEMENT";
  if (/output|response|generation/.test(combined)) return "OUTPUT";
  if (/policy|approval|block|control|guard/.test(combined)) return "CONTROL";
  return "ENTRY";
}

function recommendations(input: { containmentStatus: CausalIncident["containmentStatus"]; riskTypes: string[]; stages: CausalStage[]; integrityValid: boolean }) {
  const result = new Set<string>();
  if (input.containmentStatus === "ESCALATED") result.add("Revoke affected agent passports and isolate the active session before further execution.");
  if (input.riskTypes.some((risk) => /PROMPT_INJECTION|JAILBREAK/.test(risk))) result.add("Quarantine the initiating prompt or retrieved source and review instruction boundaries.");
  if (input.riskTypes.some((risk) => /SECRET|PII|EXFIL/.test(risk)) || input.stages.includes("DATA_MOVEMENT")) result.add("Rotate exposed credentials where applicable and review outbound data destinations.");
  if (input.stages.includes("DELEGATION")) result.add("Review the delegation chain and confirm every child capability was attenuated.");
  if (!input.integrityValid) result.add("Treat the event chain as potentially tampered and preserve independent infrastructure logs.");
  if (!result.size) result.add("Review the correlated trace and tune controls if the observed behavior is unexpected.");
  return [...result];
}

function severityScore(severity: TrustEventEnvelope["severity"]) {
  return { INFO: 0, LOW: 8, MEDIUM: 22, HIGH: 45, CRITICAL: 65 }[severity];
}

function riskLevel(score: number): CausalIncident["severity"] {
  if (score >= 80) return "CRITICAL";
  if (score >= 55) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}

function dedupeResources(events: TrustEventEnvelope[]) {
  const map = new Map<string, { type: string; id: string | null }>();
  for (const event of events) if (event.resource) map.set(`${event.resource.type}:${event.resource.id ?? ""}`, { type: event.resource.type, id: event.resource.id });
  return [...map.values()];
}

function unique(values: string[]) { return [...new Set(values)]; }
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}
