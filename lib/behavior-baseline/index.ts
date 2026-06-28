import type { TrustEventEnvelope } from "@/lib/trust-events";

export interface AgentBehaviorProfile {
  format: "soter.agent-behavior-profile.v1";
  agentIdentityId: string;
  sampleSize: number;
  state: "LEARNING" | "ACTIVE";
  actionFrequency: Record<string, number>;
  sourceFrequency: Record<string, number>;
  decisionFrequency: Record<string, number>;
  activeHoursUtc: number[];
  knownTransitions: Record<string, number>;
  knownResourceTypes: string[];
  generatedAt: string;
}

export interface AgentBehaviorAssessment {
  state: "LEARNING" | "NORMAL" | "ANOMALOUS";
  anomalyScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  findings: Array<{ id: string; score: number; message: string }>;
}

export function buildAgentBehaviorProfile(input: {
  agentIdentityId: string;
  events: TrustEventEnvelope[];
  minimumSamples?: number;
  now?: Date;
}): AgentBehaviorProfile {
  const events = chronological(input.events.filter((event) => event.agentIdentityId === input.agentIdentityId));
  const minimumSamples = Math.max(10, input.minimumSamples ?? 30);
  return {
    format: "soter.agent-behavior-profile.v1",
    agentIdentityId: input.agentIdentityId,
    sampleSize: events.length,
    state: events.length >= minimumSamples ? "ACTIVE" : "LEARNING",
    actionFrequency: frequency(events.map((event) => event.action)),
    sourceFrequency: frequency(events.map((event) => event.source)),
    decisionFrequency: frequency(events.map((event) => event.decision)),
    activeHoursUtc: [...new Set(events.map((event) => new Date(event.occurredAt).getUTCHours()))].sort((a, b) => a - b),
    knownTransitions: frequency(events.slice(1).map((event, index) => `${events[index].action}->${event.action}`)),
    knownResourceTypes: [...new Set(events.map((event) => event.resource?.type).filter((value): value is string => Boolean(value)))].sort(),
    generatedAt: (input.now ?? new Date()).toISOString(),
  };
}

export function assessAgentBehavior(input: {
  profile: AgentBehaviorProfile;
  event: TrustEventEnvelope;
  previousEvent?: TrustEventEnvelope | null;
}): AgentBehaviorAssessment {
  if (input.profile.state === "LEARNING") return { state: "LEARNING", anomalyScore: 0, riskLevel: "LOW", findings: [] };
  const findings: AgentBehaviorAssessment["findings"] = [];
  const add = (id: string, score: number, message: string) => findings.push({ id, score, message });
  if (!input.profile.actionFrequency[input.event.action]) add("behavior.novel_action", 30, `Action ${input.event.action} has not appeared in the agent baseline.`);
  if (!input.profile.sourceFrequency[input.event.source]) add("behavior.novel_source", 15, `Source ${input.event.source} has not appeared in the agent baseline.`);
  const hour = new Date(input.event.occurredAt).getUTCHours();
  if (!input.profile.activeHoursUtc.includes(hour)) add("behavior.unusual_hour", 10, `Activity at UTC hour ${hour} is outside the observed baseline.`);
  if (input.previousEvent) {
    const transition = `${input.previousEvent.action}->${input.event.action}`;
    if (!input.profile.knownTransitions[transition]) add("behavior.novel_transition", 25, `Action transition ${transition} has not appeared in the baseline.`);
  }
  if (input.event.resource?.type && !input.profile.knownResourceTypes.includes(input.event.resource.type)) add("behavior.novel_resource", 15, `Resource type ${input.event.resource.type} has not appeared in the baseline.`);
  if (input.event.decision === "BLOCK" || input.event.decision === "ERROR") add("behavior.security_failure", 20, `Runtime decision ${input.event.decision} increases behavioral risk.`);
  if (input.event.severity === "CRITICAL") add("behavior.critical_event", 35, "A critical-severity event occurred.");
  else if (input.event.severity === "HIGH") add("behavior.high_event", 20, "A high-severity event occurred.");
  const anomalyScore = Math.min(100, findings.reduce((sum, finding) => sum + finding.score, 0));
  return { state: anomalyScore >= 30 ? "ANOMALOUS" : "NORMAL", anomalyScore, riskLevel: risk(anomalyScore), findings };
}

export function assessBehaviorSequence(input: { profile: AgentBehaviorProfile; events: TrustEventEnvelope[] }) {
  const events = chronological(input.events);
  return events.map((event, index) => ({ eventId: event.eventId, ...assessAgentBehavior({ profile: input.profile, event, previousEvent: events[index - 1] }) }));
}

function chronological(events: TrustEventEnvelope[]) {
  return [...events].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
}

function frequency(values: string[]) {
  return values.reduce<Record<string, number>>((result, value) => { result[value] = (result[value] ?? 0) + 1; return result; }, {});
}

function risk(score: number): AgentBehaviorAssessment["riskLevel"] {
  if (score >= 80) return "CRITICAL";
  if (score >= 55) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}
