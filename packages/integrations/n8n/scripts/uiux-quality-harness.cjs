/**
 * The node's UI/UX, checked the way a user experiences it in the editor panel.
 *
 * The other harnesses prove behaviour; this proves the panel is not rough: every
 * action reads as a titled, described choice; every field a user has to fill has a
 * label and an example; the dynamic subtitle renders a clean status line for every
 * action (no "undefined", no crash); the two output branches are named; and the
 * enforcement-vs-report distinction is surfaced with a notice rather than left for
 * the user to discover by running it. These are the things that make a community
 * node feel finished, and they regress silently because nothing executes them.
 *
 * Run: node scripts/uiux-quality-harness.cjs   (after `npm run build`)
 */
const path = require("path");
const { NodeHelpers, Workflow } = require("n8n-workflow");
const { SoterGuard } = require(path.join(__dirname, "..", "dist", "nodes", "SoterGuard", "SoterGuard.node.js"));

const NODE_TYPE = "n8n-nodes-soterai.soterGuard";
const versioned = new SoterGuard();
// Validate the version a user actually gets when they drop the node — the
// default — rather than a hardcoded number that silently goes stale on a bump.
const CURRENT_VERSION = versioned.currentVersion;
const v2 = NodeHelpers.getVersionedNodeType(versioned, CURRENT_VERSION).description;

const failures = [];
const notes = [];
function check(label, ok, detail) {
  if (!ok) failures.push(label);
  notes.push({ label, ok: !!ok, detail: detail || "" });
}

// Text-ish fields a user types into; these are the ones that need a label + example.
const INPUT_TYPES = new Set(["string", "json"]);
const titleCaseish = (s) => /^[A-Z0-9]/.test(s) && !/[a-z][A-Z]/.test(s.replace(/\s/g, "")); // starts capital, not raw camelCase

console.log(`\nUI/UX quality harness — n8n-workflow, node v${process.version}\n`);

// --- Node identity: the card in the panel ---------------------------------
check("node has a display name", !!v2.displayName, v2.displayName);
check("node has light+dark icons", !!(v2.icon && v2.icon.light && v2.icon.dark), JSON.stringify(v2.icon));
check("node has a one-line description", typeof v2.description === "string" && v2.description.length >= 30, `${(v2.description || "").length} chars`);
check("node declares a default name", !!(v2.defaults && v2.defaults.name), JSON.stringify(v2.defaults));

// --- Operation selector: every choice is titled, described, and has a verb --
// v3 replaced the flat "action" dropdown with a Resource -> Operation pair, so
// the operations are spread across one `operation` dropdown per resource. v1/v2
// keep a single `action`. Collect whichever this version uses, and remember the
// selector name so the subtitle and output checks read the right parameter.
const actionProp = v2.properties.find((p) => p.name === "action");
const operationProps = v2.properties.filter((p) => p.name === "operation");
const SELECTOR = actionProp ? "action" : "operation";
const selectorProps = actionProp ? [actionProp] : operationProps;
const ACTIONS = selectorProps.flatMap((p) => p.options || []);

check("operation selector exists with options", ACTIONS.length > 0, `${SELECTOR}: ${ACTIONS.length} operations`);
if (SELECTOR === "operation") {
  const resource = v2.properties.find((p) => p.name === "resource");
  check("resource selector exists with options", !!resource && Array.isArray(resource.options) && resource.options.length > 0);
  for (const p of selectorProps) {
    check(`operation dropdown is no-data-expression`, p.noDataExpression === true, JSON.stringify(p.noDataExpression));
  }
}

const seenDesc = new Map();
for (const opt of ACTIONS) {
  check(`operation "${opt.value}": has a human name`, !!opt.name && opt.name.length > 2, opt.name);
  check(`operation "${opt.value}": has a real description`, !!opt.description && opt.description.length >= 15, (opt.description || "").slice(0, 50));
  check(`operation "${opt.value}": has an action verb phrase`, !!opt.action && opt.action.length >= 5, opt.action);
  if (opt.description) {
    const dup = seenDesc.get(opt.description);
    check(`operation "${opt.value}": description is not a copy of ${dup || ""}`, !dup, dup ? `same as ${dup}` : "unique");
    seenDesc.set(opt.description, opt.value);
  }
}

// --- Fields a user fills: label + example ----------------------------------
// Every visible text/json input (except notices/hidden) should carry a
// displayName and either a placeholder or a description, or the panel shows a
// bare box with no hint of what goes in it.
const inputFields = v2.properties.filter((p) => INPUT_TYPES.has(p.type) && !["action", "operation", "resource"].includes(p.name));
for (const f of inputFields) {
  check(`field "${f.name}": has a display name`, !!f.displayName, f.displayName);
  const guided = !!(f.placeholder || (f.description && f.description.length > 0) || f.hint);
  check(`field "${f.name}": guides the user (placeholder/description/hint)`, guided, f.placeholder ? "placeholder" : f.description ? "description" : f.hint ? "hint" : "NONE");
}

// --- The dynamic subtitle: renders a clean status line for every action -----
// It is an expression; extract the inner function and run it per action with the
// defaults the panel would carry, then assert it never yields "undefined"/blank.
function evalSubtitle(params) {
  const raw = String(v2.subtitle || "");
  const body = raw.replace(/^=\{\{/, "").replace(/\}\}$/, "").trim();
   
  const fn = new Function("$parameter", `return (${body});`);
  return fn(params);
}
for (const opt of ACTIONS) {
  // Detection Engine lives on the panel for v2 and inside Options for v3, so seed
  // both places; the subtitle reads whichever its own version knows about.
  const params = { [SELECTOR]: opt.value, onThreat: "BLOCK", sensitivity: "BALANCED", detectionEngine: "AUTO", options: { detectionEngine: "AUTO" } };
  let label = "";
  let ok = true;
  try {
    label = String(evalSubtitle(params));
  } catch (error) {
    ok = false;
    label = `THREW ${error && error.message}`;
  }
  const clean = ok && label.length > 0 && !/undefined|null|NaN|\[object/i.test(label);
  check(`subtitle renders cleanly for "${opt.value}"`, clean, label);
}
// And that it reflects enforcement mode — an enforcing action shows its On Threat.
const enforcingSub = evalSubtitle({ [SELECTOR]: "inputGuard", onThreat: "REDACT", sensitivity: "BALANCED", detectionEngine: "AUTO", options: {} });
check("subtitle reflects On Threat for enforcing actions", /redact/i.test(String(enforcingSub)), String(enforcingSub));

// --- Output branches are named, so the canvas reads Safe vs Flagged --------
function outputsFor(actionValue) {
  const node = { id: "n", name: "SoterAI", type: NODE_TYPE, typeVersion: CURRENT_VERSION, position: [0, 0], parameters: { [SELECTOR]: actionValue } };
  const wf = new Workflow({ id: "wf", nodes: [node], connections: {}, active: false, nodeTypes: {
    getByName: () => versioned,
    getByNameAndVersion: (_t, v) => NodeHelpers.getVersionedNodeType(versioned, v),
    getKnownTypes: () => ({ [NODE_TYPE]: { className: "SoterGuard" } }),
  } });
  return NodeHelpers.getNodeOutputs(wf, node, v2);
}
const guardOuts = outputsFor("inputGuard");
const named = guardOuts.map((o) => (typeof o === "string" ? o : o.displayName)).filter(Boolean);
check("guard actions render two NAMED output branches", named.length === 2 && named.every((n) => /safe|flag/i.test(n)), named.join(" + "));

// --- The enforcement-vs-report distinction is surfaced, not hidden ---------
const notices = v2.properties.filter((p) => p.type === "notice");
check("panel carries guidance notices (enforcement/local-engine/etc.)", notices.length >= 3, `${notices.length} notices`);

// --- No obvious authoring debris in any user-facing string -----------------
const allText = JSON.stringify(v2);
check("no TODO/FIXME/placeholder debris in panel strings", !/\b(TODO|FIXME|XXX|lorem ipsum)\b/i.test(allText), "clean");

// ---------------------------------------------------------------------------
console.log(`Panel inventory: ${ACTIONS.length} operations, ${inputFields.length} input fields, ${notices.length} notices, ${v2.properties.filter((p) => p.placeholder).length} placeholders, ${v2.properties.filter((p) => p.hint).length} hints\n`);
const pass = notes.filter((n) => n.ok).length;
// Print only failures + a compact summary, or the list is unreadable at ~120 checks.
for (const n of notes.filter((x) => !x.ok)) console.log(`  FAIL  ${n.label}  ${n.detail}`);
console.log("");
if (failures.length > 0) {
  console.error(`${failures.length} UI/UX check(s) failed (of ${notes.length}).`);
  process.exit(1);
}
console.log(`all ${notes.length} UI/UX quality checks passed`);
