import assert from "node:assert/strict";
import test from "node:test";
import { buildCausalSiemPayload, correlateCausalTrace } from "../lib/causal-siem";
import { buildTrustEvent } from "../lib/trust-events";

test("causal SIEM reconstructs a multi-stage contained attack path", () => {
  const root = buildTrustEvent({ organizationId: "org", projectId: "project", eventType: "GUARD_INPUT", source: "guard.input", action: "inspect", severity: "HIGH", decision: "ALLOW", riskTypes: ["PROMPT_INJECTION"] });
  const retrieval = buildTrustEvent({ organizationId: "org", projectId: "project", traceId: root.traceId, parentSpanId: root.spanId, causalRefs: [root.eventId], eventType: "RAG_AUTHORIZED_RETRIEVAL", source: "rag.query", action: "retrieve", decision: "ALLOW", resource: { type: "RAG_COLLECTION", id: "kb" } });
  const tool = buildTrustEvent({ organizationId: "org", projectId: "project", traceId: root.traceId, parentSpanId: retrieval.spanId, causalRefs: [retrieval.eventId], eventType: "AGENT_TOOL_ACTION", source: "agent.firewall", action: "email.send", severity: "CRITICAL", decision: "BLOCK", riskTypes: ["DATA_EXFILTRATION_ATTEMPT"], agentIdentityId: "agent-1" });
  const incident = correlateCausalTrace([root, retrieval, tool]);
  assert.ok(incident);
  assert.equal(incident.containmentStatus, "ESCALATED");
  assert.ok(incident.riskScore >= 80);
  assert.ok(incident.stages.some((stage) => stage.stage === "CONTEXT"));
  assert.ok(incident.stages.some((stage) => stage.stage === "EXECUTION"));
  assert.equal(incident.graph.integrityValid, true);
  const payload = buildCausalSiemPayload(incident);
  assert.match(payload.contentHash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(payload).includes("prompt text"), false);
});

test("causal SIEM detects event-integrity mutation", () => {
  const event = buildTrustEvent({ organizationId: "org", eventType: "GUARD_INPUT", source: "guard", action: "inspect", decision: "BLOCK" });
  const incident = correlateCausalTrace([{ ...event, action: "tampered" }]);
  assert.equal(incident?.integrityValid, false);
  assert.ok(incident?.recommendations.some((item) => /tampered/i.test(item)));
});
