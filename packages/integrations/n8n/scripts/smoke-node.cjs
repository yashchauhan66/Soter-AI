// Runtime smoke test: proves the versioned node loads and that the dynamic
// outputs expression resolves to the branches the editor will actually draw.
const { SoterGuard } = require("../dist/nodes/SoterGuard/SoterGuard.node.js");

const node = new SoterGuard();
const v1 = node.nodeVersions[1];
const v2 = node.nodeVersions[2];
const v3 = node.nodeVersions[3];

console.log("defaultVersion:", node.description.defaultVersion);
console.log("versions:", Object.keys(node.nodeVersions).join(","));
console.log("v1 outputs:", JSON.stringify(v1.description.outputs));
console.log(
  "v1 props:",
  v1.description.properties.length,
  "| v2 props:",
  v2.description.properties.length,
  "| v3 props:",
  v3.description.properties.length,
);
console.log("v2 hints:", (v2.description.hints || []).length, "| v3 hints:", (v3.description.hints || []).length);

const body = String(v2.description.outputs).slice(3, -2);
// Parenthesised because the expression body starts on its own line, and a bare
// `return` followed by a newline would hit automatic semicolon insertion.
const resolve = new Function("$parameter", "return (" + body + ")");

console.log("\noutputs by action:");
for (const action of [
  "inputGuard",
  "outputGuard",
  "universalGuard",
  "piiRedactor",
  "ragScanner",
  "analyzeText",
  "workflowAudit",
  "enrollIdentity",
  "issuePassport",
  "validatePassport",
  "revokePassport",
  "toolCall",
]) {
  const outputs = resolve({ action });
  const drawn = outputs.map((o) => o.displayName || "(single)").join(" | ");
  console.log("  " + action.padEnd(16) + " -> " + drawn);
}

console.log("\nsubtitles:");
const subtitleBody = String(v2.description.subtitle).slice(3, -2);
const subtitle = new Function("$parameter", "return (" + subtitleBody + ")");
for (const p of [
  { action: "inputGuard", onThreat: "block" },
  { action: "inputGuard", onThreat: "redact" },
  { action: "universalGuard", onThreat: "block" },
  { action: "ragScanner" },
]) {
  console.log("  " + JSON.stringify(p) + " -> " + subtitle(p));
}

// --- Version 3: the Resource -> Operation panel over the same engine ----------
// The default a user gets. Its outputs and subtitle are their own expressions
// keyed on `operation`, so smoke them the same way — a syntax slip in either
// string is invisible until the editor tries to draw the node.
const v3OutputsBody = String(v3.description.outputs).slice(3, -2);
const v3Outputs = new Function("$parameter", "return (" + v3OutputsBody + ")");
const v3SubtitleBody = String(v3.description.subtitle).slice(3, -2);
const v3Subtitle = new Function("$parameter", "return (" + v3SubtitleBody + ")");

console.log("\nv3 outputs by operation:");
const OPERATIONS = [
  "inputGuard",
  "outputGuard",
  "universalGuard",
  "piiRedactor",
  "ragScanner",
  "analyzeText",
  "workflowAudit",
  "enrollIdentity",
  "issuePassport",
  "validatePassport",
  "revokePassport",
  "toolCall",
];
for (const operation of OPERATIONS) {
  const outputs = v3Outputs({ operation });
  const drawn = outputs.map((o) => o.displayName || "(single)").join(" | ");
  const expected = operation === "piiRedactor" ? 1 : 2;
  if (outputs.length !== expected) {
    throw new Error(`v3 ${operation} drew ${outputs.length} outputs, expected ${expected}`);
  }
  console.log("  " + operation.padEnd(16) + " -> " + drawn);
}

console.log("\nv3 subtitles:");
for (const p of [
  { operation: "inputGuard", onThreat: "block" },
  { operation: "inputGuard", onThreat: "redact" },
  { operation: "inputGuard", sensitivity: "LENIENT" },
  { operation: "inputGuard", options: { detectionEngine: "LOCAL" } },
  { operation: "issuePassport" },
]) {
  const line = String(v3Subtitle(p));
  if (!line || /undefined|\[object/i.test(line)) {
    throw new Error(`v3 subtitle rendered "${line}" for ${JSON.stringify(p)}`);
  }
  console.log("  " + JSON.stringify(p) + " -> " + line);
}

// The v3 panel opens on a Resource -> Operation pair. A quick shape check so a
// missing selector or a mislabelled default is caught before the editor is.
const resourceProp = v3.description.properties.find((p) => p.name === "resource");
const operationProps = v3.description.properties.filter((p) => p.name === "operation");
if (!resourceProp || operationProps.length === 0) {
  throw new Error("v3 panel is missing its Resource/Operation selectors");
}
console.log(
  "\nv3 panel:",
  resourceProp.options.length,
  "resources,",
  operationProps.length,
  "operation dropdowns (one per resource)",
);
