import assert from "node:assert/strict";
import test from "node:test";
import { buildCausalGraph, buildTrustEvent, verifyTrustEventIntegrity } from "../lib/trust-events";

test("trust events create verifiable causal envelopes without raw secrets", () => {
  const root = buildTrustEvent({
    organizationId: "org-1",
    projectId: "project-1",
    eventType: "RAG_RETRIEVAL",
    source: "rag.query",
    action: "retrieve",
    decision: "ALLOW",
    metadata: { apiKey: "sk-secret-value", safe: "retained" },
  });
  assert.match(root.traceId, /^[a-f0-9]{32}$/);
  assert.match(root.spanId, /^[a-f0-9]{16}$/);
  assert.equal(verifyTrustEventIntegrity(root), true);
  assert.equal(JSON.stringify(root).includes("sk-secret-value"), false);

  const child = buildTrustEvent({
    organizationId: "org-1",
    projectId: "project-1",
    traceId: root.traceId,
    parentSpanId: root.spanId,
    causalRefs: [root.eventId],
    eventType: "TOOL_ACTION",
    source: "agent.runtime",
    action: "send_email",
    decision: "ASK_APPROVAL",
  });
  const graph = buildCausalGraph([root, child]);
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 2);
  assert.deepEqual(graph.roots, [root.eventId]);
  assert.equal(graph.integrityValid, true);
});

test("trust event integrity detects mutation", () => {
  const event = buildTrustEvent({ organizationId: "org", eventType: "GUARD", source: "guard", action: "block" });
  assert.equal(verifyTrustEventIntegrity({ ...event, action: "allow" }), false);
});
