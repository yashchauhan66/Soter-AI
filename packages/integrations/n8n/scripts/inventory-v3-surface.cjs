/**
 * The test plan, derived from the node instead of from memory.
 *
 * "Test every field, every action, skip nothing" is only checkable against a
 * list the node itself produces. This walks the compiled v3 panel and prints,
 * per operation, every parameter an author can set and every discrete choice a
 * dropdown offers. The real-run harness reads this file's JSON twin so the
 * coverage claim is measured against the panel as shipped, not a hand list that
 * drifts.
 */

const path = require("path");
const fs = require("fs");

const dist = path.resolve(__dirname, "..", "dist", "nodes", "SoterGuard", "shared");
const { soterGuardPropertiesV3 } = require(path.join(dist, "propertiesV3.js"));
const layout = require(path.join(dist, "layoutV3.js"));

const props = soterGuardPropertiesV3;

/** Every property that could render for this operation, panel and Options alike. */
function visibleFor(operation, resource) {
  const out = [];
  for (const p of props) {
    const show = p.displayOptions?.show;
    if (show) {
      if (show.operation && !show.operation.includes(operation)) continue;
      if (show.resource && !show.resource.includes(resource)) continue;
    }
    out.push(p);
  }
  return out;
}

/** Discrete choices a field offers, so a matrix can cover each one. */
function choicesOf(p) {
  if (p.type === "options" && Array.isArray(p.options)) return p.options.map((o) => o.value);
  if (p.type === "boolean") return [true, false];
  return null;
}

function describe(p, where) {
  const entry = { name: p.name, displayName: p.displayName, type: p.type, where, default: p.default };
  const choices = choicesOf(p);
  if (choices) entry.choices = choices;
  if (p.type === "collection" || p.type === "fixedCollection") {
    const kids = p.options || [];
    entry.children = kids.map((k) => {
      if (k.values) {
        // fixedCollection: a named group holding its own fields
        return { name: k.name, group: true, fields: k.values.map((v) => describe(v, `${where}>${p.name}>${k.name}`)) };
      }
      return describe(k, `${where}>${p.name}`);
    });
  }
  return entry;
}

const inventory = { resources: [], operations: [] };

for (const r of layout.RESOURCES) {
  inventory.resources.push({ value: r.value, name: r.name });
}

for (const op of layout.OPERATIONS) {
  const vis = visibleFor(op.value, op.resource);
  const panel = [];
  let optionsCollection = null;

  for (const p of vis) {
    if (p.name === "resource" || p.name === "operation") continue;
    if (p.type === "notice") continue;
    if (p.name === "options") {
      optionsCollection = describe(p, "options");
      continue;
    }
    panel.push(describe(p, "panel"));
  }

  inventory.operations.push({
    value: op.value,
    name: op.name,
    resource: op.resource,
    action: op.action,
    required: op.required,
    panel,
    options: optionsCollection ? optionsCollection.children : [],
  });
}

// Counts are the honest headline: what the matrix has to cover.
let fieldCount = 0;
let choiceCount = 0;
const countIn = (list) => {
  for (const f of list) {
    fieldCount += 1;
    if (f.choices) choiceCount += f.choices.length;
    if (f.children) countIn(f.children.flatMap((c) => (c.group ? c.fields : [c])));
  }
};
for (const op of inventory.operations) {
  countIn(op.panel);
  countIn(op.options);
}

inventory.totals = {
  resources: inventory.resources.length,
  operations: inventory.operations.length,
  settableFields: fieldCount,
  discreteChoices: choiceCount,
};

const outPath = path.resolve(__dirname, "..", "artifacts", "v3-surface-inventory.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(inventory, null, 2));

console.log("=== v3 panel surface, read from the compiled node ===");
console.log(
  `resources=${inventory.totals.resources} operations=${inventory.totals.operations} ` +
    `settable fields=${inventory.totals.settableFields} discrete choices=${inventory.totals.discreteChoices}`,
);
for (const op of inventory.operations) {
  console.log(`\n-- ${op.value} (${op.name}) [${op.resource}] required=[${op.required.join(", ")}]`);
  console.log(`   panel:   ${op.panel.map((f) => f.name + (f.choices ? `{${f.choices.join("|")}}` : "")).join(", ") || "(none)"}`);
  console.log(`   options: ${op.options.map((f) => f.name + (f.choices ? `{${f.choices.join("|")}}` : "")).join(", ") || "(none)"}`);
}
console.log(`\nwrote ${path.relative(path.resolve(__dirname, ".."), outPath)}`);
