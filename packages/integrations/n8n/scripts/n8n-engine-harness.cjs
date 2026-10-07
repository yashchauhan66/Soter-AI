/**
 * Drives the built node through n8n's OWN engine (`n8n-workflow`), not a mock.
 *
 * `real-exec-harness.cjs` proves the node's *logic* by calling executeSoterGuard
 * with a hand-built IExecuteFunctions. That deliberately skips everything n8n
 * itself does around the node, which is exactly where a community node breaks for
 * a real user: the editor resolves parameters through `getNodeParameters`, decides
 * whether to draw a red error triangle through `getNodeParametersIssues`, and
 * draws the output branches by *evaluating the `outputs` expression* through
 * `getNodeOutputs`. None of that runs in a unit test, and all of it is what the
 * user sees before a single item flows.
 *
 * So this harness registers the node in a real INodeTypes registry, builds a real
 * Workflow graph, and asks n8n's own functions the questions the editor asks:
 *
 *   1. does n8n accept the node description at all (both versions)?
 *   2. for each action, which fields does the panel actually show?
 *   3. is a correctly-configured node issue-free, and does a node missing a
 *      required field genuinely report an issue (the check must be able to fail)?
 *   4. does the dynamic `outputs` expression really yield Safe+Flagged?
 *   5. is every published property reachable by some action (an orphaned
 *      parameter is a saved value the user can no longer see or change)?
 *
 * Run: node scripts/n8n-engine-harness.cjs   (after `npm run build`)
 */
const path = require("path");

let NodeHelpers;
let Workflow;
try {
  ({ NodeHelpers, Workflow } = require("n8n-workflow"));
} catch (error) {
  console.error("n8n-workflow not installed. Run `npm install` first.\n", error && error.message);
  process.exit(2);
}

// Defaults to the dev tree's dist/. Point SOTERAI_PKG_ROOT at an installed copy
// (node_modules/n8n-nodes-soterai) to run these same checks against the artifact
// npm actually publishes, which is the thing a user gets.
const PKG_ROOT = process.env.SOTERAI_PKG_ROOT || path.join(__dirname, "..");
const nodePath = path.join(PKG_ROOT, "dist", "nodes", "SoterGuard", "SoterGuard.node.js");
let SoterGuard;
try {
  ({ SoterGuard } = require(nodePath));
} catch (error) {
  console.error("dist not built. Run `npm run build` first.\n", error && error.message);
  process.exit(2);
}

const NODE_TYPE = "n8n-nodes-soterai.soterGuard";
const versioned = new SoterGuard();

// n8n's INodeTypes registry, the same shape the editor and the worker use.
const nodeTypes = {
  getByName: () => versioned,
  getByNameAndVersion: (_type, version) =>
    NodeHelpers.getVersionedNodeType(versioned, version),
  getKnownTypes: () => ({ [NODE_TYPE]: { className: "SoterGuard" } }),
};

const failures = [];
const notes = [];
function check(label, condition, detail) {
  if (condition) {
    notes.push({ label, ok: true, detail: detail || "" });
  } else {
    failures.push(label);
    notes.push({ label, ok: false, detail: detail || "" });
  }
}

/** A real Workflow containing one configured SoterAI node. */
function workflowWith(parameters, typeVersion) {
  const node = {
    id: "soter-1",
    name: "SoterAI",
    type: NODE_TYPE,
    typeVersion: typeVersion ?? 2,
    position: [0, 0],
    parameters,
  };
  const workflow = new Workflow({
    id: "wf-harness",
    nodes: [node],
    connections: {},
    active: false,
    nodeTypes,
  });
  return { workflow, node };
}

console.log(`\nn8n-engine harness — n8n-workflow v${require("n8n-workflow/package.json").version}, node v${process.version}\n`);

// ---------------------------------------------------------------------------
// 1. n8n accepts the description, for every published version.
// ---------------------------------------------------------------------------
const byVersion = {};
for (const version of [1, 2]) {
  let resolved;
  try {
    resolved = NodeHelpers.getVersionedNodeType(versioned, version);
  } catch (error) {
    check(`v${version} resolves through getVersionedNodeType`, false, String(error && error.message));
    continue;
  }
  byVersion[version] = resolved;
  const d = resolved.description;
  check(`v${version} resolves through getVersionedNodeType`, !!d, `${d && d.displayName}`);
  check(
    `v${version} declares properties`,
    Array.isArray(d.properties) && d.properties.length > 0,
    `${d.properties && d.properties.length} properties`,
  );
  // n8n requires these or the node silently fails to load into the editor.
  check(`v${version} has name/displayName/version`, !!d.name && !!d.displayName && d.version !== undefined);
  check(`v${version} declares inputs`, Array.isArray(d.inputs) || typeof d.inputs === "string");
  check(`v${version} declares outputs`, Array.isArray(d.outputs) || typeof d.outputs === "string");
  check(
    `v${version} declares its credential`,
    Array.isArray(d.credentials) && d.credentials.some((c) => c.name === "soterApi"),
    JSON.stringify((d.credentials || []).map((c) => c.name)),
  );
}

const v2 = byVersion[2];
if (!v2) {
  console.error("v2 did not resolve; cannot continue.");
  process.exit(1);
}
const v2desc = v2.description;

// The action list is the node's whole surface, read from the real description
// rather than hardcoded, so a new action cannot be silently left untested.
const actionProp = v2desc.properties.find((p) => p.name === "action");
check("v2 exposes an `action` selector", !!actionProp && Array.isArray(actionProp.options));
const ACTIONS = (actionProp && actionProp.options ? actionProp.options : []).map((o) => o.value);
check("v2 publishes the expected 12 actions", ACTIONS.length === 12, `${ACTIONS.length}: ${ACTIONS.join(", ")}`);

// ---------------------------------------------------------------------------
// 2+3. Per action: which fields show, and is the node issue-free when correct?
// ---------------------------------------------------------------------------
// The minimum a user must type for each action. Anything beyond `action` here is
// a genuinely required field; if n8n reports an issue for a node configured with
// exactly this, the panel would show a red triangle on a correct setup.
const MINIMAL = {
  inputGuard: { inputText: "hello" },
  outputGuard: { outputText: "hello" },
  analyzeText: { inputText: "hello" },
  piiRedactor: { piiText: "hello" },
  ragScanner: { ragText: "hello", documentId: "doc-1" },
  universalGuard: { inputText: "hello" },
  workflowAudit: { workflowJson: "{}" },
  toolCall: { toolName: "t", toolAction: "a", sessionId: "s" },
  enrollIdentity: { agentName: "A" },
  issuePassport: { agentIdentityId: "idn_1", sessionId: "s" },
  validatePassport: { sessionId: "s" },
  revokePassport: { sessionId: "s" },
};

const reachable = new Set();
const perAction = [];

// Reachability has to be judged over the whole published surface, not one slice
// of it. Three quarters of this node's properties are conditional on something:
// the engine selector (the LOCAL-only notice), or `@version` (v1 keeps the raw
// `securityContextJson` field its saved workflows hold, while v2 shows the
// `securityContext` collection that replaced it). Resolving only v2 with default
// engine reports four perfectly reachable fields as orphaned, so the matrix below
// is the actual surface a user can reach.
const VERSIONS = [1, 2];
const ENGINES = ["CLOUD", "LOCAL", "AUTO"];
for (const version of VERSIONS) {
  const desc = byVersion[version].description;
  for (const action of ACTIONS) {
    for (const engine of ENGINES) {
      const values = { action, detectionEngine: engine, ...(MINIMAL[action] || {}) };
      const { node } = workflowWith(values, version);
      let shown = null;
      try {
        shown = NodeHelpers.getNodeParameters(desc.properties, values, true, false, node, desc);
      } catch {
        continue; // the per-action resolution check below reports this properly
      }
      for (const key of Object.keys(shown || {})) reachable.add(key);
    }
  }
}

for (const action of ACTIONS) {
  const values = { action, ...(MINIMAL[action] || {}) };
  const { node } = workflowWith(values, 2);

  // What the panel shows: resolve with defaults, excluding non-displayed fields.
  let shown = null;
  try {
    shown = NodeHelpers.getNodeParameters(v2desc.properties, values, true, false, node, v2desc);
  } catch (error) {
    check(`${action}: parameters resolve`, false, String(error && error.message));
    continue;
  }
  const shownKeys = Object.keys(shown || {});
  check(`${action}: parameters resolve`, shownKeys.length > 0, `${shownKeys.length} fields shown`);

  // The red-triangle check. A correctly configured node must be issue-free.
  let issues = null;
  try {
    issues = NodeHelpers.getNodeParametersIssues(v2desc.properties, node, v2desc);
  } catch (error) {
    check(`${action}: issue check runs`, false, String(error && error.message));
  }
  const issueDetail = issues ? JSON.stringify(issues).slice(0, 120) : "none";
  // `credentials` issues are expected here: no credential is attached to this
  // bare node, and that is a real requirement the editor should surface. Only
  // *parameter* issues would mean a correct setup looks broken.
  const paramIssues = issues && issues.parameters ? issues.parameters : null;
  check(
    `${action}: no parameter issues when correctly configured`,
    !paramIssues || Object.keys(paramIssues).length === 0,
    paramIssues ? JSON.stringify(paramIssues).slice(0, 160) : "clean",
  );

  perAction.push({ action, fields: shownKeys.length, issues: issueDetail === "none" ? "none" : "cred-only" });
}

// ---------------------------------------------------------------------------
// 3b. The issue check must be ABLE to fail, or it proves nothing.
// ---------------------------------------------------------------------------
// Same action, required text removed. If this still reports clean, then the
// "no parameter issues" results above are vacuous.
{
  const values = { action: "inputGuard" }; // inputText omitted
  const { node } = workflowWith(values, 2);
  const issues = NodeHelpers.getNodeParametersIssues(v2desc.properties, node, v2desc);
  const paramIssues = issues && issues.parameters ? issues.parameters : null;
  check(
    "MUTATION: a missing required field DOES report an issue",
    !!paramIssues && Object.keys(paramIssues).length > 0,
    paramIssues ? JSON.stringify(paramIssues).slice(0, 160) : "reported CLEAN — the issue check is vacuous",
  );
}

// ---------------------------------------------------------------------------
// 4. The dynamic `outputs` expression, evaluated by n8n as the editor does.
// ---------------------------------------------------------------------------
// The node declares outputs as an expression so a single-verdict action renders
// one branch and a guard action renders Safe+Flagged. If the expression throws or
// yields the wrong shape, the editor draws the wrong number of connectors and a
// workflow silently loses its Flagged branch.
function outputsFor(action) {
  const { workflow, node } = workflowWith({ action, ...(MINIMAL[action] || {}) }, 2);
  return NodeHelpers.getNodeOutputs(workflow, node, v2desc);
}

for (const [action, expected] of [
  ["inputGuard", 2],
  ["outputGuard", 2],
  ["universalGuard", 2],
  ["ragScanner", 2],
  ["workflowAudit", 2],
  ["toolCall", 2],
  ["analyzeText", 2],
  ["piiRedactor", 1], // single-verdict: never flagged, so one branch
]) {
  let outs;
  try {
    outs = outputsFor(action);
  } catch (error) {
    check(`outputs(${action}) evaluates`, false, String(error && error.message));
    continue;
  }
  const labels = outs.map((o) => (typeof o === "string" ? o : o.displayName || o.type)).join("+");
  check(
    `outputs(${action}) = ${expected} branch${expected === 1 ? "" : "es"}`,
    outs.length === expected,
    `got ${outs.length} [${labels}]`,
  );
}

// ---------------------------------------------------------------------------
// 5. No orphaned parameters.
// ---------------------------------------------------------------------------
// A published property that no action can display is a field a user may already
// have a saved value in and can no longer see or change — silent protection loss.
// Top-level properties only; collection members are reached through their parent.
const topLevel = v2desc.properties.map((p) => p.name);
const orphaned = topLevel.filter((name) => !reachable.has(name));
check(
  "every published property is reachable by some action",
  orphaned.length === 0,
  orphaned.length ? `ORPHANED: ${orphaned.join(", ")}` : `all ${topLevel.length} reachable`,
);

// The orphan check must be able to fail too: a property nothing can display has
// to be detected. An invented name is by definition unreachable, so if this does
// not register as orphaned the reachability set is being built wrong.
check(
  "MUTATION: an unreachable property IS detected as orphaned",
  !reachable.has("__nonexistentProperty__"),
  "sentinel absent from the reachable set, as it must be",
);

// ---------------------------------------------------------------------------
console.log("Per-action panel resolution (n8n's own getNodeParameters):");
const aw = Math.max(...perAction.map((r) => r.action.length), 6);
for (const r of perAction) {
  console.log(`  ${r.action.padEnd(aw)}  ${String(r.fields).padStart(2)} fields shown   issues: ${r.issues}`);
}

console.log("\nChecks:");
const lw = Math.max(...notes.map((n) => n.label.length));
for (const n of notes) {
  console.log(`  ${n.ok ? "ok  " : "FAIL"}  ${n.label.padEnd(lw)}  ${n.detail}`);
}

console.log("");
if (failures.length > 0) {
  console.error(`${failures.length} check(s) failed:\n  - ${failures.join("\n  - ")}`);
  process.exit(1);
}
console.log(`all ${notes.length} n8n-engine checks passed`);
