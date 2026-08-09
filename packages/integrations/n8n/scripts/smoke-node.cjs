// Runtime smoke test: proves the versioned node loads and that the dynamic
// outputs expression resolves to the branches the editor will actually draw.
const { SoterGuard } = require("../dist/nodes/SoterGuard/SoterGuard.node.js");

const node = new SoterGuard();
const v1 = node.nodeVersions[1];
const v2 = node.nodeVersions[2];

console.log("defaultVersion:", node.description.defaultVersion);
console.log("versions:", Object.keys(node.nodeVersions).join(","));
console.log("v1 outputs:", JSON.stringify(v1.description.outputs));
console.log("v1 props:", v1.description.properties.length, "| v2 props:", v2.description.properties.length);
console.log("v2 hints:", (v2.description.hints || []).length);

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
