/**
 * The example workflows ship in the tarball and are the first thing a real user
 * imports. A stale one — an action that no longer exists, or a saved value for a
 * parameter the node hides for that action and never reads — imports without
 * error and then silently does nothing, which is worse than a missing example.
 *
 * This validates each shipped example against the node's REAL description, using
 * n8n's own getNodeParameters to decide which parameters an action actually shows
 * (across both versions and all three engines). A key present on a Soter node that
 * no action/version/engine combination would display is a dead value and fails the
 * check. Run: node scripts/validate-examples.cjs   (after `npm run build`)
 */
const fs = require("fs");
const path = require("path");
const { NodeHelpers } = require("n8n-workflow");
const { SoterGuard } = require(path.join(__dirname, "..", "dist", "nodes", "SoterGuard", "SoterGuard.node.js"));

const SOTER_TYPE = "n8n-nodes-soterai.soterGuard";
const inst = new SoterGuard();
const descOf = (v) => NodeHelpers.getVersionedNodeType(inst, v).description;
const validActions = new Set(descOf(2).properties.find((p) => p.name === "action").options.map((o) => o.value));

// A generous superset of scalar field values, so resolving an action shows every
// field that action could display regardless of which one it actually needs.
const PROBE = {
  inputText: "x", outputText: "x", piiText: "x", ragText: "x", documentId: "d",
  documentSource: "email", workflowJson: "{}", toolName: "t", toolAction: "a",
  toolDestination: "EXTERNAL", sessionId: "s", agentName: "A", agentType: "CHATBOT",
  agentIdentityId: "i", systemPromptContext: "x",
};

function shownParams(action) {
  const names = new Set(["action", "detectionEngine"]);
  for (const v of [1, 2]) {
    const d = descOf(v);
    for (const engine of ["CLOUD", "LOCAL", "AUTO"]) {
      const values = { action, detectionEngine: engine, ...PROBE };
      const shown = NodeHelpers.getNodeParameters(d.properties, values, true, false, { typeVersion: v }, d) || {};
      for (const k of Object.keys(shown)) names.add(k);
    }
  }
  return names;
}

const dir = path.join(__dirname, "..", "examples");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
let bad = 0;
for (const f of files) {
  let wf;
  try {
    wf = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  } catch (e) {
    console.log(`  BADJSON ${f}: ${e.message}`);
    bad++;
    continue;
  }
  const nodes = (wf.nodes || []).filter((n) => n.type === SOTER_TYPE);
  const issues = [];
  for (const n of nodes) {
    const p = n.parameters || {};
    const action = p.action;
    if (action && !validActions.has(action)) issues.push(`unknown action "${action}"`);
    if (action) {
      const valid = shownParams(action);
      for (const key of Object.keys(p)) {
        if (!valid.has(key)) issues.push(`param "${key}" is never shown for action ${action}`);
      }
    }
  }
  console.log(`  ${issues.length ? "ISSUE" : "ok   "} ${f}${issues.length ? "  -> " + issues.join("; ") : ""}`);
  if (issues.length) bad++;
}

console.log("");
if (bad > 0) {
  console.error(`${bad} example file(s) reference stale actions or dead parameters.`);
  process.exit(1);
}
console.log(`all ${files.length} example workflows reference real actions and live parameters`);
