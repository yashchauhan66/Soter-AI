import assert from "node:assert/strict";
import test from "node:test";
import { assessAgentBehavior, buildAgentBehaviorProfile } from "../lib/behavior-baseline";
import { buildTrustEvent } from "../lib/trust-events";

function event(action: string, hour: number, resource = "TICKET") {
  return buildTrustEvent({ organizationId: "org", projectId: "project", agentIdentityId: "agent-1", eventType: "ACTION", source: "support-agent", action, resource: { type: resource }, occurredAt: new Date(Date.UTC(2026, 5, 1, hour)).toISOString() });
}

test("behavior baseline remains in learning mode until enough history exists", () => {
  const profile = buildAgentBehaviorProfile({ agentIdentityId: "agent-1", events: [event("ticket.read", 9)] });
  assert.equal(profile.state, "LEARNING");
  assert.equal(assessAgentBehavior({ profile, event: event("terminal.run", 3) }).state, "LEARNING");
});

test("behavior baseline detects novel action sequence, time, and resource", () => {
  const history = Array.from({ length: 30 }, (_, index) => event(index % 2 ? "ticket.read" : "crm.read", 9 + index % 2));
  const profile = buildAgentBehaviorProfile({ agentIdentityId: "agent-1", events: history });
  const previous = event("ticket.read", 9);
  const current = event("terminal.run", 3, "SECRET_STORE");
  const assessment = assessAgentBehavior({ profile, event: current, previousEvent: previous });
  assert.equal(profile.state, "ACTIVE");
  assert.equal(assessment.state, "ANOMALOUS");
  assert.ok(assessment.anomalyScore >= 70);
  assert.ok(assessment.findings.some((finding) => finding.id === "behavior.novel_transition"));
});
