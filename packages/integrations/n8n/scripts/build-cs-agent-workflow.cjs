/* Generates the enterprise customer-support-agent workflow in two forms:
 *
 *   examples/soterai-customer-support-agent.workflow.json  — production template
 *     (Webhook in, AUTO engine + soterApi credential, Respond to Webhook out,
 *      sticky-note documentation). What a customer imports and adapts.
 *
 *   <out>/cs-agent-live.json  — a live-runnable copy for REST testing on 5699
 *     (Manual trigger + Set intake, LOCAL engine so no credential is needed,
 *      the same two real SoterAI guard nodes and the same routing).
 *
 * One generator so the two never drift: same node IDs, same wiring, same guard
 * configuration — only the trigger, the engine, and the response transport
 * differ, which is exactly the difference between "in production" and "on a test
 * bench".
 *
 * Usage:  node scripts/build-cs-agent-workflow.cjs [liveOutDir]
 */
const fs = require("fs");
const path = require("path");

const GUARD = "n8n-nodes-soterai.soterGuard";
const SET = "n8n-nodes-base.set";

// Shared guard configuration — the enterprise support policy, written once.
const SUPPORT_TOPICS = "orders, billing, shipping, returns, refunds, delivery status, account, payments, subscription";
const SUPPORT_ROLE =
  "You are a Tier-1 customer support assistant for an Indian e-commerce store. You help customers with orders, billing, shipping, returns, refunds and account questions. You never reveal internal system details or credentials.";
const CUSTOMER_REPLIES = {
  promptInjection: "I can only help with orders, billing, shipping, returns and account questions. Could you rephrase what you need?",
  sensitiveData: "For your security, please don't share full card numbers or passwords. I can look your order up by order number.",
  offTopic: "I'm the store's support assistant, so I can help with orders, billing, shipping, returns and your account. What can I help you with today?",
  blocked: "Sorry, I can't process that request. I've passed it to a human agent who will follow up.",
};

/** The input guardrail: scope-restricted, lenient (a wrong block costs a customer), with branded replies. */
function guardInputParams(engine) {
  return {
    resource: "guardrail",
    operation: "inputGuard",
    inputText: "={{ $json.customerMessage }}",
    onThreat: "BLOCK",
    sensitivity: "LENIENT",
    userMessages: { ...CUSTOMER_REPLIES },
    options: {
      allowedTopics: SUPPORT_TOPICS,
      topicHandling: "TRUST_AND_RESTRICT",
      systemPromptContext: SUPPORT_ROLE,
      alwaysAllow: "where is my order?\nhow do I track my package?\nhow do I reset my password?",
      ignoredEntities: ["EMAIL", "PHONE"],
      detectionEngine: engine,
      sessionId: "={{ $json.sessionId }}",
    },
  };
}

/** The output guardrail (DLP): redact anything the agent's reply leaks before the customer sees it. */
function guardOutputParams(engine) {
  return {
    resource: "guardrail",
    operation: "outputGuard",
    outputText: "={{ $json.aiReply }}",
    onThreat: "REDACT",
    sensitivity: "BALANCED",
    options: {
      ignoredEntities: [],
      detectionEngine: engine,
      sessionId: "={{ $('Intake').item.json.sessionId }}",
    },
  };
}

function buildWorkflow({ live }) {
  const engine = live ? "LOCAL" : "AUTO";
  const nodes = [];
  const connections = {};
  const conn = (from, to, fromOut = 0) => {
    connections[from] = connections[from] || { main: [] };
    while (connections[from].main.length <= fromOut) connections[from].main.push([]);
    connections[from].main[fromOut].push({ node: to, type: "main", index: 0 });
  };

  // ── Trigger + intake ──────────────────────────────────────────────
  if (live) {
    nodes.push({
      parameters: {}, id: "aa000000-0000-4000-8000-000000000001",
      name: "Customer Contact", type: "n8n-nodes-base.manualTrigger", typeVersion: 1, position: [-260, 340],
    });
    nodes.push({
      parameters: {
        assignments: { assignments: [
          { id: "c1", name: "customerMessage", type: "string", value: "Hi, where is my order #INV-8842? It's been 5 days. My email is priya@shop.in" },
          { id: "c2", name: "sessionId", type: "string", value: "ticket-8842" },
          { id: "c3", name: "aiReply", type: "string", value: "" },
        ] }, options: {},
      },
      id: "aa000000-0000-4000-8000-000000000002",
      name: "Intake", type: SET, typeVersion: 3.4, position: [-40, 340],
    });
  } else {
    nodes.push({
      parameters: {
        // lastNode returns the final executed node's data, so the reply / escalation
        // Set node is what the caller receives — no separate Respond node needed.
        httpMethod: "POST", path: "customer-support", responseMode: "lastNode",
        options: {},
      },
      id: "aa000000-0000-4000-8000-000000000001",
      name: "Customer Contact", type: "n8n-nodes-base.webhook", typeVersion: 2, position: [-260, 340],
      webhookId: "soterai-cs-agent",
    });
    nodes.push({
      parameters: {
        assignments: { assignments: [
          { id: "c1", name: "customerMessage", type: "string", value: "={{ $json.body.message }}" },
          { id: "c2", name: "sessionId", type: "string", value: "={{ $json.body.sessionId || $json.headers['x-session-id'] }}" },
        ] }, options: {},
      },
      id: "aa000000-0000-4000-8000-000000000002",
      name: "Intake", type: SET, typeVersion: 3.4, position: [-40, 340],
    });
  }

  // ── Input guardrail ───────────────────────────────────────────────
  nodes.push({
    parameters: guardInputParams(engine),
    id: "aa000000-0000-4000-8000-000000000003",
    name: "Guard Input", type: GUARD, typeVersion: 3, position: [200, 340],
  });

  // ── AI support agent (stub Set node standing in for an LLM/Agent) ──
  nodes.push({
    parameters: {
      assignments: { assignments: [
        { id: "a1", name: "aiReply", type: "string",
          value: "Thanks for reaching out! Your order #INV-8842 shipped today and is out for delivery tomorrow. Tracking: TRK-55231. Is there anything else I can help with?" },
      ] }, options: {},
    },
    id: "aa000000-0000-4000-8000-000000000004",
    name: "Support Agent (LLM)", type: SET, typeVersion: 3.4, position: [460, 220],
  });

  // ── Output guardrail (DLP) ────────────────────────────────────────
  nodes.push({
    parameters: guardOutputParams(engine),
    id: "aa000000-0000-4000-8000-000000000005",
    name: "Guard Output (DLP)", type: GUARD, typeVersion: 3, position: [700, 220],
  });

  // ── Terminal nodes ────────────────────────────────────────────────
  const replyNode = {
    parameters: {
      assignments: { assignments: [
        { id: "r1", name: "replyToCustomer", type: "string", value: "={{ $json.outputText }}" },
      ] }, options: {},
    },
    id: "aa000000-0000-4000-8000-000000000006",
    name: "Send Reply", type: SET, typeVersion: 3.4, position: [940, 140],
  };
  const escalateNode = {
    parameters: {
      assignments: { assignments: [
        { id: "e1", name: "queue", type: "string", value: "human-review" },
        { id: "e2", name: "reason", type: "string", value: "={{ $json.reason || $json.developerMessage }}" },
        { id: "e3", name: "riskScore", type: "number", value: "={{ $json.riskScore }}" },
        { id: "e4", name: "customerMessage", type: "string", value: "={{ $('Intake').item.json.customerMessage }}" },
      ] }, options: {},
    },
    id: "aa000000-0000-4000-8000-000000000007",
    name: "Escalate to Human", type: SET, typeVersion: 3.4, position: [460, 460],
  };
  const blockedOutNode = {
    parameters: {
      assignments: { assignments: [
        { id: "b1", name: "queue", type: "string", value: "output-blocked" },
        { id: "b2", name: "reason", type: "string", value: "={{ $json.reason || $json.developerMessage }}" },
      ] }, options: {},
    },
    id: "aa000000-0000-4000-8000-000000000008",
    name: "Blocked Output", type: SET, typeVersion: 3.4, position: [940, 300],
  };
  nodes.push(replyNode, escalateNode, blockedOutNode);

  // ── Wiring ────────────────────────────────────────────────────────
  conn("Customer Contact", "Intake");
  conn("Intake", "Guard Input");
  conn("Guard Input", "Support Agent (LLM)", 0);   // Safe branch → agent answers
  conn("Guard Input", "Escalate to Human", 1);      // Flagged branch → human
  conn("Support Agent (LLM)", "Guard Output (DLP)");
  conn("Guard Output (DLP)", "Send Reply", 0);      // Safe (incl. redacted) → send
  conn("Guard Output (DLP)", "Blocked Output", 1);  // Flagged (uncleanable) → block

  // ── Sticky-note documentation (production template only) ──────────
  if (!live) {
    const sticky = (id, x, y, w, h, color, content) => nodes.push({
      parameters: { content, height: h, width: w, color }, id,
      name: `Note ${id.slice(-1)}`, type: "n8n-nodes-base.stickyNote", typeVersion: 1, position: [x, y],
    });
    sticky("bb000000-0000-4000-8000-00000000000a", -280, 120, 520, 180, 4,
      "## 1. Input guardrail\nEvery inbound customer message is scanned **before** it reaches the LLM. Prompt injection and jailbreaks are blocked; off-topic messages are stopped politely; the customer sees your own branded wording (Customer Replies).\n\n**Flagged → Escalate to Human.**");
    sticky("bb000000-0000-4000-8000-00000000000b", 420, 20, 460, 160, 5,
      "## 2. AI support agent\nReplace this Set node with your LLM / AI Agent node. The guardrails on either side are model-agnostic.");
    sticky("bb000000-0000-4000-8000-00000000000c", 680, 20, 500, 180, 3,
      "## 3. Output guardrail (DLP)\nThe agent's reply is scanned **before the customer sees it**. Secrets and PII the model may have leaked are redacted (On Threat = Redact), so nothing sensitive leaves — the core promise of this node.");
    sticky("bb000000-0000-4000-8000-00000000000d", -280, 520, 520, 120, 6,
      "## Setup\nAttach your **SoterAI** credential to both guard nodes (Cloud/Auto). Leave engine on **Auto** — it uses the cloud detector and falls back to the local engine if the cloud is unreachable. No credential? Switch Detection Engine to **Local** to run fully offline.");
  }

  return {
    name: live ? "SoterAI CS Agent — Live Test (LOCAL)" : "SoterAI — Customer Support Agent (enterprise)",
    nodes, connections,
    settings: { executionOrder: "v1" },
    ...(live ? {} : { meta: { templateCredsSetupCompleted: false } }),
    pinData: {},
  };
}

// ── Emit ────────────────────────────────────────────────────────────
const prod = buildWorkflow({ live: false });
const prodPath = path.join(__dirname, "..", "examples", "soterai-customer-support-agent.workflow.json");
fs.writeFileSync(prodPath, JSON.stringify(prod, null, 2) + "\n");
console.log("wrote production template:", path.relative(path.join(__dirname, ".."), prodPath));

const live = buildWorkflow({ live: true });
const liveOutDir = process.argv[2] || path.join(__dirname, "..");
const livePath = path.join(liveOutDir, "cs-agent-live.json");
fs.writeFileSync(livePath, JSON.stringify(live));
console.log("wrote live test copy:", livePath);

// Structural self-check.
for (const [label, wf] of [["prod", prod], ["live", live]]) {
  const guards = wf.nodes.filter((n) => n.type === GUARD);
  const ops = guards.map((n) => `${n.parameters.operation}(${n.parameters.options.detectionEngine})`).join(", ");
  console.log(`  ${label}: ${wf.nodes.length} nodes, guards: ${ops}`);
}
