/**
 * Extracts the exact panel model n8n would render, straight from the built node
 * description — so a preview is faithful, not invented. For each action it walks
 * the properties in panel order and keeps the ones n8n would show (via the real
 * displayParameter), with their label, type, placeholder, description, options and
 * default. Also captures node identity, the rendered subtitle per action, and the
 * output branches. Prints JSON to stdout.
 *
 *   node scripts/extract-panel-model.cjs > /tmp/panel-model.json
 */
const path = require("path");
const { NodeHelpers, Workflow } = require("n8n-workflow");
const { SoterGuard } = require(path.join(__dirname, "..", "dist", "nodes", "SoterGuard", "SoterGuard.node.js"));

const NODE_TYPE = "n8n-nodes-soterai.soterGuard";
const versioned = new SoterGuard();
const nodeTypes = {
  getByName: () => versioned,
  getByNameAndVersion: (_t, v) => NodeHelpers.getVersionedNodeType(versioned, v),
  getKnownTypes: () => ({ [NODE_TYPE]: { className: "SoterGuard" } }),
};
// Extract the version a user actually gets — the default — so the preview shows
// the shipped panel, not a stale hardcoded version.
const CURRENT_VERSION = versioned.currentVersion;
const v2 = NodeHelpers.getVersionedNodeType(versioned, CURRENT_VERSION).description;

// v3 uses a Resource -> Operation pair; v1/v2 a single "action" dropdown. Collect
// the operations from whichever the current default version has, and remember the
// selector name and each operation's resource so the panel renders correctly.
const actionProp = v2.properties.find((p) => p.name === "action");
const operationProps = v2.properties.filter((p) => p.name === "operation");
const SELECTOR = actionProp ? "action" : "operation";

function resourceOf(operationValue) {
  const prop = operationProps.find((p) => (p.options || []).some((o) => o.value === operationValue));
  return prop ? prop.displayOptions?.show?.resource?.[0] : undefined;
}

const ACTIONS = (actionProp ? actionProp.options : operationProps.flatMap((p) => p.options || [])).map((o) => ({
  value: o.value,
  name: o.name,
  description: o.description,
  action: o.action,
  resource: resourceOf(o.value),
}));

// Sensible defaults so the "opening view" of each operation shows (engine/onThreat
// dropdowns pick their own default from the property, which displayParameter reads).
function defaultsFor(operationValue) {
  const values = { [SELECTOR]: operationValue };
  if (SELECTOR === "operation") values.resource = resourceOf(operationValue);
  for (const p of v2.properties) {
    if (![SELECTOR, "resource"].includes(p.name) && p.default !== undefined && values[p.name] === undefined) {
      // Only seed the few switches other fields key off, so we don't force-show
      // everything; the rest are read from the property default by displayParameter.
      if (["detectionEngine", "onThreat", "sensitivity", "topicMode", "protectionProfile"].includes(p.name)) {
        values[p.name] = p.default;
      }
    }
  }
  return values;
}

function visibleFields(actionValue) {
  const values = defaultsFor(actionValue);
  const node = { typeVersion: CURRENT_VERSION };
  const fields = [];
  for (const p of v2.properties) {
    if (p.name === SELECTOR || p.name === "resource") continue;
    let shown = false;
    try {
      shown = NodeHelpers.displayParameter(values, p, node, v2);
    } catch {
      shown = false;
    }
    if (!shown) continue;
    fields.push({
      name: p.name,
      displayName: p.displayName,
      type: p.type,
      required: !!p.required,
      placeholder: p.placeholder || "",
      description: p.description || "",
      hint: p.hint || "",
      default: p.default,
      options: Array.isArray(p.options) ? p.options.map((o) => ({ name: o.name, value: o.value, description: o.description || "" })) : undefined,
      typeOptions: p.typeOptions || undefined,
    });
  }
  return fields;
}

function subtitleFor(actionValue) {
  const raw = String(v2.subtitle || "");
  const body = raw.replace(/^=\{\{/, "").replace(/\}\}$/, "").trim();
   
  const fn = new Function("$parameter", `return (${body});`);
  const params = defaultsFor(actionValue);
  try {
    return String(fn(params));
  } catch {
    return actionValue;
  }
}

function outputsFor(operationValue) {
  const node = { id: "n", name: "SoterAI", type: NODE_TYPE, typeVersion: CURRENT_VERSION, position: [0, 0], parameters: { [SELECTOR]: operationValue } };
  const wf = new Workflow({ id: "wf", nodes: [node], connections: {}, active: false, nodeTypes });
  return NodeHelpers.getNodeOutputs(wf, node, v2).map((o) => (typeof o === "string" ? o : o.displayName || o.type));
}

const model = {
  node: {
    displayName: v2.displayName,
    name: v2.name,
    description: v2.description,
    defaultVersion: v2.version,
    group: v2.group,
    credential: (v2.credentials || []).map((c) => ({ name: c.name, required: !!c.required }))[0] || null,
  },
  actions: ACTIONS.map((a) => ({
    ...a,
    subtitle: subtitleFor(a.value),
    outputs: outputsFor(a.value),
    fields: visibleFields(a.value),
  })),
};

process.stdout.write(JSON.stringify(model, null, 2));
