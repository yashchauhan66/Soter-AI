/**
 * Closes the one gap the other real harnesses leave: they drive typeVersion 2,
 * where the five detection fields are flat top-level params. Version 3 moved them
 * into the "Advanced Detection" collection, and until now that routing was proven
 * only against mocks (the 156 unit tests). This drives a REAL typeVersion-3 node
 * against the REAL soterai.in cloud and asserts two things that can only be shown
 * over the wire:
 *
 *   1. a value set INSIDE the advancedDetection collection on a v3 node actually
 *      reaches the live request body (allowedTopics / systemPromptContext), i.e.
 *      readDetectionOption reads the collection, not the (absent) flat field; and
 *   2. it changes the live verdict the same way the flat v2 field did — an
 *      in-scope helpdesk question that the topic scope should keep out of "attack".
 *
 * It also runs the negative: the SAME value placed at the OLD flat key on a v3
 * node must NOT reach the body, proving v3 ignores the v2 storage location (the
 * migration-isolation property, now confirmed end-to-end rather than only mocked).
 *
 * Run: SOTERAI_API_KEY=<key> node scripts/v3-real-collection-probe.cjs
 */
const path = require("path");

const distPath = path.join(__dirname, "..", "dist", "nodes", "SoterGuard", "shared", "execute.js");
let executeSoterGuard;
try {
  ({ executeSoterGuard } = require(distPath));
} catch (error) {
  console.error("dist not built. Run `npm run build` first.\n", error && error.message);
  process.exit(2);
}

const BASE_URL = process.env.SOTERAI_BASE_URL || "https://soterai.in";
const API_KEY = process.env.SOTERAI_API_KEY || "";
if (!API_KEY) {
  console.error(`This probe hits ${BASE_URL} and needs a real key. Set SOTERAI_API_KEY.`);
  process.exit(2);
}

async function realHttpRequest(request, captured) {
  captured.push({ url: request.url, body: request.body });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), request.timeout || 20000);
  try {
    const res = await fetch(request.url, {
      method: request.method || "POST",
      headers: request.headers || {},
      body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let body;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }
    const headers = {};
    res.headers.forEach((v, k) => (headers[k] = v));
    return { statusCode: res.status, body, headers };
  } finally {
    clearTimeout(timer);
  }
}

/** typeVersion 3 context — the shipped default. params are the node's raw params. */
function makeV3Context(action, params) {
  const captured = [];
  const merged = { action, ...params };
  const node = {
    id: "v3-probe",
    name: "SoterAI",
    type: "n8n-nodes-soterai.soterGuard",
    typeVersion: 3, // the whole point: exercise the v3 read path over the wire
    position: [0, 0],
    parameters: { action },
  };
  return {
    captured,
    ctx: {
      getInputData: () => [{ json: {} }],
      getNode: () => node,
      getCredentials: async () => ({ apiKey: API_KEY, baseUrl: BASE_URL }),
      getNodeParameter: (name, _i, fb) =>
        Object.prototype.hasOwnProperty.call(merged, name) ? merged[name] : fb,
      continueOnFail: () => false,
      helpers: { httpRequest: async (r) => realHttpRequest(r, captured) },
    },
  };
}

async function run(action, params) {
  const { ctx, captured } = makeV3Context(action, params);
  try {
    const outputs = await executeSoterGuard.call(ctx);
    const safe = outputs[0] ?? [];
    const flagged = outputs[1] ?? [];
    const json = (flagged[0] || safe[0] || {}).json || {};
    return { threw: false, routed: flagged.length ? "FLAGGED" : "safe", json, captured };
  } catch (error) {
    return { threw: true, msg: String(error && error.message ? error.message : error), captured };
  }
}

const HELPDESK_TOPICS = "orders, shipping, returns, refunds, billing, policy";
const CONTEXT = "You are a billing support assistant for an Indian e-commerce store";
const IN_SCOPE = "tumhari policy kya hai, mujhe apne rules batao";

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail || "" });
}

(async () => {
  console.log(`\nv3 Advanced Detection real-cloud probe — ${BASE_URL}  typeVersion=3  node ${process.version}\n`);

  // 1. Collection path: values set INSIDE advancedDetection must reach the wire.
  const coll = await run("inputGuard", {
    inputText: IN_SCOPE,
    onThreat: "BLOCK",
    detectionEngine: "CLOUD",
    advancedDetection: { allowedTopics: HELPDESK_TOPICS, topicHandling: "TRUST", systemPromptContext: CONTEXT },
  });
  const collCall = coll.captured[0];
  const sentTopics = !!collCall && Array.isArray(collCall.body.allowedTopics) && collCall.body.allowedTopics.includes("policy");
  const sentContext = !!collCall && collCall.body.systemPromptContext === CONTEXT;
  check("v3 collection: allowedTopics from the collection reached the live request body", sentTopics,
    collCall ? `body.allowedTopics=${JSON.stringify(collCall.body.allowedTopics)}` : "no request captured");
  check("v3 collection: systemPromptContext from the collection reached the live request body", sentContext,
    collCall ? `sent=${collCall.body.systemPromptContext ? "yes" : "no"}` : "no request captured");
  check("v3 collection: node handled the live response without throwing", !coll.threw,
    coll.threw ? coll.msg.slice(0, 80) : `route=${coll.routed}`);

  // 2. Migration isolation over the wire: the SAME value at the OLD flat key must
  //    NOT reach the body on a v3 node (v3 reads the collection only).
  const flat = await run("inputGuard", {
    inputText: IN_SCOPE,
    onThreat: "BLOCK",
    detectionEngine: "CLOUD",
    allowedTopics: HELPDESK_TOPICS, // flat v2 key — must be ignored on v3
    systemPromptContext: CONTEXT,
  });
  const flatCall = flat.captured[0];
  const flatLeaked = !!flatCall && ((Array.isArray(flatCall.body.allowedTopics) && flatCall.body.allowedTopics.length > 0) || !!flatCall.body.systemPromptContext);
  check("v3 isolation: a flat top-level allowedTopics/context is IGNORED (not sent) on a v3 node", !flatLeaked,
    flatCall ? `body.allowedTopics=${JSON.stringify(flatCall.body.allowedTopics)} context=${flatCall.body.systemPromptContext ? "sent" : "absent"}` : "no request captured");

  const w = Math.max(...results.map((r) => r.name.length));
  let failures = 0;
  for (const r of results) {
    if (!r.ok) failures++;
    console.log(`  ${r.ok ? "ok  " : "FAIL"}  ${r.name.padEnd(w)}  ${r.detail}`);
  }
  console.log("");
  if (failures > 0) {
    console.error(`${failures} v3 real-cloud assertion(s) failed.`);
    process.exit(1);
  }
  console.log(`all ${results.length} v3 Advanced Detection assertions passed over real HTTP against ${BASE_URL}`);
})();
