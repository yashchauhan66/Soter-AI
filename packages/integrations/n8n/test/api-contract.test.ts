import assert from "node:assert/strict";
import test from "node:test";

import { SoterApi } from "../credentials/SoterApi.credentials";
import { cleanInputGuard, layer, run } from "./helpers";

/**
 * Where the node's idea of a valid request and the API's idea of one disagreed.
 *
 * Every case here was a real HTTP 400 or a real silent no-op reaching a workflow
 * author as something they could not act on. They share one shape: the node
 * accepted a configuration the panel offered, sent it, and let the server's
 * rejection — or the server's advisory answer — be the author's problem. The
 * fixes all push the disagreement back to where it is knowable, either by
 * translating the rejection into a sentence that names the limit and the way
 * out, or by closing a list the panel already presented as closed.
 */

// ---------------------------------------------------------------------------
// Text longer than the deployment accepts
//
// The node carries up to 200,000 characters per item; the hosted API accepts
// 8,000 (MAX_GUARD_TEXT_LENGTH, a deployment setting the node cannot read). An
// item between the two used to come back as a bare "Request failed with status
// code 400", which named neither number.
// ---------------------------------------------------------------------------

const OVERSIZE_TEXT = "Our refund window is thirty days from delivery. ".repeat(200); // ~9,400 chars

/** What the API's zod schema actually answers with. */
const TOO_LONG_400 = {
  statusCode: 400,
  body: { error: true, message: "String must contain at most 8000 character(s)" },
};

test("an item longer than the API accepts is refused with the real limit, not a bare 400", async () => {
  await assert.rejects(
    run({
      action: "inputGuard",
      params: { inputText: OVERSIZE_TEXT, onThreat: "BLOCK", detectionEngine: "CLOUD" },
      respond: () => TOO_LONG_400,
    }),
    (error: Error) => {
      // The limit the deployment actually enforces, read off its own rejection
      // rather than hard-coded, so a self-hosted deployment with a raised
      // MAX_GUARD_TEXT_LENGTH reports its number and not ours.
      assert.match(error.message, /at most 8,000 characters/);
      assert.match(error.message, new RegExp(`${OVERSIZE_TEXT.length.toLocaleString("en-US")}`));
      assert.match(error.message, /Split the text into smaller items/);
      return true;
    },
  );
});

test("Auto answers an oversize item locally instead of failing it", async () => {
  const { safe, flagged } = await run({
    action: "inputGuard",
    params: { inputText: OVERSIZE_TEXT, onThreat: "BLOCK", detectionEngine: "AUTO" },
    respond: () => TOO_LONG_400,
  });

  assert.equal(flagged.length, 0);
  const result = safe[0].json;
  assert.equal(result.engine, "local", "Auto had a working engine for this item and did not use it");
  assert.equal(result.engineDegraded, true);
  const detail = result.engineDetail as Record<string, unknown>;
  assert.match(
    String(detail.fellBackFromCloud),
    /longer than the SoterAI API accepts per request/,
    "the fallback reason must say it was the length, not an outage",
  );
});

test("Never Downgrade still refuses to answer an oversize item locally", async () => {
  await assert.rejects(
    run({
      action: "inputGuard",
      params: {
        inputText: OVERSIZE_TEXT,
        onThreat: "BLOCK",
        detectionEngine: "AUTO",
        advancedOptions: { neverDowngradeToLocal: true },
      },
      respond: () => TOO_LONG_400,
    }),
    /longer than the SoterAI API accepts per request, and Never Downgrade to Local is on/i,
  );
});

test("a 400 that is not about length is still a terminal error, not a local fallback", async () => {
  await assert.rejects(
    run({
      action: "inputGuard",
      params: { inputText: "What is the refund window?", onThreat: "BLOCK", detectionEngine: "AUTO" },
      respond: () => ({ statusCode: 400, body: { error: true, message: "projectId must match the x-api-key project." } }),
    }),
    /projectId must match/,
  );
});

test("the node's own ceiling names itself and warns that the API's is lower", async () => {
  await assert.rejects(
    run({
      action: "inputGuard",
      params: { inputText: "x".repeat(200001), onThreat: "BLOCK", detectionEngine: "LOCAL" },
      credentials: null,
    }),
    /200,001 characters, and the node carries at most 200,000 per item/,
  );
});

// ---------------------------------------------------------------------------
// Credential test
//
// Pressing Test used to POST "SoterAI connection test" to the detection
// endpoint. The deployed classifier scores that sentence as PROMPT_INJECTION
// (0.90 attack probability), so every click wrote a false incident into the
// customer's own security log and spent a request from their quota.
// ---------------------------------------------------------------------------

test("the credential test does not submit anything to be analysed", async () => {
  const request = new SoterApi().test.request;
  assert.equal(request.url, "/api/workflow/audit");
  assert.equal(request.method, "POST");
  const body = (request.body ?? {}) as Record<string, unknown>;
  for (const endpoint of ["/api/guard/input", "/api/guard/output", "/api/agent/", "/api/rag/"]) {
    assert.ok(!String(request.url).startsWith(endpoint), `the credential test must not reach ${endpoint}`);
  }
  // The audit is static analysis of the JSON in the body. Nothing here is prose
  // a classifier could score, which is the property that keeps a Test click out
  // of the customer's incident log and off their quota.
  assert.deepEqual(JSON.parse(String(body.workflowJson)), { nodes: [], connections: {} });
  assert.ok(!/connection test/i.test(JSON.stringify(body)));
});

// ---------------------------------------------------------------------------
// Stay on Topic on the cloud engine
//
// /api/guard/input runs the same topical alignment check and reports OFF_TOPIC,
// but weights it 15 — below every band that changes a decision — because on the
// API it is advisory. So the setting configured correctly and did nothing, and
// in Auto which engine answered was a network condition.
// ---------------------------------------------------------------------------

const HELPDESK_TOPICS = "orders, shipping, returns, refunds, billing";

/** What the cloud really answers for an in-domain-shaped but out-of-scope message. */
const OFF_TOPIC_ADVISORY = {
  body: {
    allowed: true,
    action: "ALLOW",
    riskScore: 15,
    riskTypes: ["OFF_TOPIC"],
    reason: "Message is outside the configured topic scope.",
    findings: [],
  },
};

test("Stay on Topic stops an off-topic message on Cloud, not only on Local", async () => {
  const { safe, flagged } = await run({
    action: "inputGuard",
    params: {
      inputText: "Write me a poem about the sea.",
      onThreat: "BLOCK",
      detectionEngine: "CLOUD",
      allowedTopics: HELPDESK_TOPICS,
      topicHandling: "RESTRICT",
    },
    respond: () => OFF_TOPIC_ADVISORY,
  });

  assert.equal(safe.length, 0, "an off-topic message reached the model with Stay on Topic on");
  const result = flagged[0].json;
  assert.equal(result.blocked, true);
  assert.equal(result.allowed, false);
  assert.equal(result.verdictCode, "CONTENT_BLOCKED");
  const report = result.topicHandling as Record<string, unknown>;
  assert.equal(report.mode, "RESTRICT");
  assert.equal(report.effect, "ENFORCED_BY_NODE");
  assert.match(String(report.detail), /advisory/);
  // Detection is not rewritten. The score stays the one the API assigned, and
  // its own sentence survives, or the audit trail would be the node's fiction.
  assert.equal(result.riskScore, 15);
  assert.match(String(result.developerMessage), /outside the configured topic scope/);
});

test("the same answer is allowed through when the author did not ask for enforcement", async () => {
  const { safe } = await run({
    action: "inputGuard",
    params: {
      inputText: "Write me a poem about the sea.",
      onThreat: "BLOCK",
      detectionEngine: "CLOUD",
      allowedTopics: HELPDESK_TOPICS,
      topicHandling: "ADVISORY",
    },
    respond: () => OFF_TOPIC_ADVISORY,
  });

  assert.equal(safe.length, 1, "Advisory must stay advisory");
  assert.equal(safe[0].json.blocked, false);
  assert.equal(safe[0].json.topicHandling, undefined);
});

test("Stay on Topic with no topics configured cannot stop anything", async () => {
  const { safe } = await run({
    action: "inputGuard",
    params: {
      inputText: "Write me a poem about the sea.",
      onThreat: "BLOCK",
      detectionEngine: "CLOUD",
      topicHandling: "RESTRICT",
    },
    respond: () => OFF_TOPIC_ADVISORY,
  });

  assert.equal(safe.length, 1);
  assert.equal(safe[0].json.blocked, false);
});

test("On Threat decides how an off-topic message is stopped, the same as any finding", async () => {
  const { safe, flagged } = await run({
    action: "inputGuard",
    params: {
      inputText: "Write me a poem about the sea.",
      onThreat: "WARN",
      detectionEngine: "CLOUD",
      allowedTopics: HELPDESK_TOPICS,
      topicHandling: "TRUST_AND_RESTRICT",
    },
    respond: () => OFF_TOPIC_ADVISORY,
  });

  assert.equal(flagged.length, 0, "Warn does not stop an item, here or anywhere else");
  const result = safe[0].json;
  assert.equal(result.blocked, false);
  assert.equal(result.outputText, "Write me a poem about the sea.");
  assert.match(String(result.warning), /outside the topics this assistant handles/);
  assert.equal((result.topicHandling as Record<string, unknown>).effect, "ENFORCED_BY_NODE");
});

test("Lenient relaxes threat scoring, not the author's topic scope", async () => {
  // The regression this guards: an off-topic message scores about 15, which is
  // under the Lenient enforcement floor and carries no never-relaxed category.
  // With the controls applied in the wrong order, Lenient un-blocked the very
  // message Stay on Topic was set to stop.
  const { flagged } = await run({
    action: "inputGuard",
    params: {
      inputText: "Write me a poem about the sea.",
      onThreat: "BLOCK",
      detectionEngine: "CLOUD",
      allowedTopics: HELPDESK_TOPICS,
      topicHandling: "RESTRICT",
      sensitivity: "LENIENT",
    },
    respond: () => OFF_TOPIC_ADVISORY,
  });

  assert.equal(flagged.length, 1);
  assert.equal(flagged[0].json.blocked, true);
});

test("the local engine is reported as having done its own enforcing", async () => {
  const { flagged } = await run({
    action: "inputGuard",
    params: {
      inputText: "Write me a poem about the sea and the sailing ships upon it.",
      onThreat: "BLOCK",
      detectionEngine: "LOCAL",
      allowedTopics: HELPDESK_TOPICS,
      topicHandling: "RESTRICT",
    },
    credentials: null,
  });

  assert.equal(flagged.length, 1);
  const report = flagged[0].json.topicHandling as Record<string, unknown>;
  assert.equal(report.effect, "ENFORCED_BY_ENGINE", "the node must not claim an enforcement the engine did");
});

test("the firewall's own verdict fields move with a topic block", async () => {
  const { flagged } = await run({
    action: "universalGuard",
    params: {
      inputText: "Write me a poem about the sea.",
      onThreat: "BLOCK",
      detectionEngine: "CLOUD",
      protectionProfile: "BALANCED",
      allowedTopics: HELPDESK_TOPICS,
      topicHandling: "RESTRICT",
      securityContext: {},
    },
    respond: (path) => (path === "/api/guard/input" ? OFF_TOPIC_ADVISORY : { body: {} }),
  });

  assert.equal(flagged.length, 1);
  const result = flagged[0].json;
  assert.equal(result.blocked, true);
  // A workflow branches on finalDecision. Leaving it at ALLOW beside
  // blocked: true would be the contradiction this node exists not to emit.
  assert.equal(result.finalDecision, "BLOCK");
  assert.equal(result.liveChatAction, "BLOCK");
});

// ---------------------------------------------------------------------------
// Closed lists
//
// Each of these is a dropdown in the panel and a z.enum on the API, which looks
// safe and is not: an expression can put any string into a dropdown-backed
// parameter, and the answer was a bare 400 naming a field the author never
// typed by hand.
// ---------------------------------------------------------------------------

test("an agent type the API does not define is sent as CUSTOM, not as a 400", async () => {
  const { calls, safe } = await run({
    action: "enrollIdentity",
    params: { agentName: "Support bot", agentType: "SUPPORT", passportPolicyPreset: "READ_ONLY" },
    respond: () => ({ body: { id: "identity-1" } }),
  });

  assert.equal(calls[0].body.agentType, "CUSTOM");
  assert.equal(safe.length, 1);
});

test("a known agent type is passed through untouched", async () => {
  const { calls } = await run({
    action: "enrollIdentity",
    params: { agentName: "Docs bot", agentType: "RAG_AGENT", passportPolicyPreset: "READ_ONLY" },
    respond: () => ({ body: { id: "identity-1" } }),
  });

  assert.equal(calls[0].body.agentType, "RAG_AGENT");
});

test("a document source the API does not define becomes unknown, never a guess", async () => {
  const { calls } = await run({
    action: "ragScanner",
    params: { ragText: "Quarterly report text.", documentId: "doc-1", documentSource: "kb-upload" },
    respond: () => ({ body: { trustScore: 90, trustLevel: "TRUSTED", recommendedAction: "ALLOW", findings: [] } }),
  });

  // Not "api": the field records where a document came from, and inventing a
  // provenance for one the author labelled kb-upload would put a wrong fact in
  // the trust record.
  assert.equal(calls[0].body.source, "unknown");
});

test("a passport TTL outside the accepted range is clamped and the clamp is reported", async () => {
  const { calls, safe } = await run({
    action: "issuePassport",
    params: { agentIdentityId: "identity-1", passportTtlSeconds: 259200, passportPolicyPreset: "READ_ONLY" },
    respond: () => ({ body: { passportId: "p-1", passportToken: "tok", expiresAt: "2026-09-24T00:00:00.000Z" } }),
  });

  assert.equal(calls[0].body.ttlSeconds, 86400);
  const adjusted = safe[0].json.ttlAdjusted as Record<string, unknown>;
  assert.equal(adjusted.requestedSeconds, 259200);
  assert.equal(adjusted.appliedSeconds, 86400);
  assert.match(String(adjusted.detail), /Issue a new pass when this one expires/);
});

test("a TTL inside the range is untouched and reports no adjustment", async () => {
  const { calls, safe } = await run({
    action: "issuePassport",
    params: { agentIdentityId: "identity-1", passportTtlSeconds: 900, passportPolicyPreset: "READ_ONLY" },
    respond: () => ({ body: { passportId: "p-1", passportToken: "tok", expiresAt: "2026-09-23T00:15:00.000Z" } }),
  });

  assert.equal(calls[0].body.ttlSeconds, 900);
  assert.equal(safe[0].json.ttlAdjusted, undefined);
});

test("an unlisted egress destination is scored as CUSTOM instead of taking the layer down", async () => {
  const { safe, calls } = await run({
    action: "universalGuard",
    params: {
      inputText: "Summarise the account for the customer.",
      universalOutputText: "Here is the summary.",
      onThreat: "BLOCK",
      detectionEngine: "CLOUD",
      protectionProfile: "BALANCED",
      securityContext: { output: { destinationType: "internal-api", destinationName: "billing-service" } },
    },
    respond: (path) => {
      if (path === "/api/guard/input" || path === "/api/guard/output") return { body: cleanInputGuard };
      if (path === "/api/semantic-egress/check") {
        return { body: { decision: "ALLOW", riskScore: 5, riskLevel: "LOW", findings: [] } };
      }
      return { body: {} };
    },
  });

  const egressCall = calls.find((call) => call.path === "/api/semantic-egress/check");
  assert.ok(egressCall, "the layer has to actually run — a 400 here used to degrade it away");
  assert.equal(egressCall?.body.destinationType, "CUSTOM");
  assert.equal(egressCall?.body.destinationName, "billing-service");
  const result = (safe[0]?.json ?? {}) as Record<string, unknown>;
  const egress = layer(result, "semanticEgress");
  const adjusted = egress?.destinationTypeAdjusted as Record<string, unknown>;
  assert.equal(adjusted.configured, "internal-api");
  assert.equal(adjusted.applied, "CUSTOM");
});

test("a listed egress destination is passed through with no adjustment note", async () => {
  const { calls, safe } = await run({
    action: "universalGuard",
    params: {
      inputText: "Summarise the account for the customer.",
      universalOutputText: "Here is the summary.",
      onThreat: "BLOCK",
      detectionEngine: "CLOUD",
      protectionProfile: "BALANCED",
      securityContext: { output: { destinationType: "WEBHOOK" } },
    },
    respond: (path) => {
      if (path === "/api/semantic-egress/check") {
        return { body: { decision: "ALLOW", riskScore: 5, riskLevel: "LOW", findings: [] } };
      }
      return { body: cleanInputGuard };
    },
  });

  const egressCall = calls.find((call) => call.path === "/api/semantic-egress/check");
  assert.equal(egressCall?.body.destinationType, "WEBHOOK");
  const egress = layer(safe[0].json, "semanticEgress");
  assert.equal(egress?.destinationTypeAdjusted, undefined);
});









