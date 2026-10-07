/** Reads a finished execution and reports, per SoterAI node, what actually happened. */
const fs = require("fs");
const path = require("path");

const file = process.argv[2] || path.join(__dirname, "..", "artifacts", "v082-audit", "exec78.json");
const raw = JSON.parse(fs.readFileSync(file, "utf8")).data;
// n8n stores execution data flatted (cyclic-safe), so `data` arrives as a string.
const { parse: unflatten } = require("flatted");
const exec = { ...raw, data: typeof raw.data === "string" ? unflatten(raw.data) : raw.data };
const run = exec.data.resultData.runData;
const wf = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "artifacts", "v082-audit", "create-resp.json"), "utf8")).data;
const soterNames = new Set(wf.nodes.filter((n) => n.type === "n8n-nodes-soterai.soterGuard").map((n) => n.name));

console.log("execution:", exec.id, "| status:", exec.status, "| started:", exec.startedAt, "| stopped:", exec.stoppedAt);
console.log("wall clock ms:", new Date(exec.stoppedAt) - new Date(exec.startedAt));
console.log("error:", exec.data.resultData.error ? JSON.stringify(exec.data.resultData.error).slice(0, 300) : "none");
console.log("nodes with run data:", Object.keys(run).length, "| SoterAI nodes in workflow:", soterNames.size);

const missing = [...soterNames].filter((n) => !run[n]);
console.log("\nSoterAI nodes that never ran (" + missing.length + "):", missing.join(", ") || "none");

const errs = [];
for (const [name, runs] of Object.entries(run)) {
  for (const r of runs) if (r.error) errs.push({ name, msg: r.error.message, desc: r.error.description });
}
console.log("\n=== NODE ERRORS (" + errs.length + ") ===");
for (const e of errs) console.log(" ✗", e.name, "->", e.msg, e.desc ? "| " + String(e.desc).slice(0, 160) : "");

function branches(r) {
  const out = (r.data && r.data.main) || [];
  return out.map((b) => (b ? b.length : 0));
}

console.log("\n=== PER-NODE VERDICTS ===");
for (const name of wf.nodes.filter((n) => n.type === "n8n-nodes-soterai.soterGuard").map((n) => n.name)) {
  const runs = run[name];
  if (!runs) { console.log("\n" + name + "\n  DID NOT RUN"); continue; }
  const r = runs[0];
  const b = branches(r);
  console.log("\n" + name);
  console.log("  ms:", r.executionTime, "| branch item counts:", JSON.stringify(b));
  const all = ((r.data && r.data.main) || []).flatMap((arr, idx) => (arr || []).map((it) => ({ idx, j: it.json })));
  for (const { idx, j } of all.slice(0, 12)) {
    const bits = [];
    if (j.allowed !== undefined) bits.push("allowed=" + j.allowed);
    if (j.decision) bits.push("decision=" + j.decision);
    if (j.riskScore !== undefined) bits.push("risk=" + j.riskScore);
    if (j.trustScore !== undefined) bits.push("trust=" + j.trustScore);
    if (j.trustLevel) bits.push(j.trustLevel);
    if (j.securityScore !== undefined) bits.push("securityScore=" + j.securityScore);
    if (j.categories && j.categories.length) bits.push("cats=" + j.categories.join("/"));
    if (j.mode) bits.push("mode=" + j.mode);
    if (j.engine) bits.push("engine=" + j.engine);
    if (j.blocked !== undefined) bits.push("blocked=" + j.blocked);
    if (j.redacted !== undefined) bits.push("redacted=" + j.redacted);
    if (j.reusedResult) bits.push("REUSED");
    console.log("   out" + idx + " " + (j.ticketId || j.documentId || "") + " " + bits.join(" "));
    if (j.userMessage) console.log("        userMessage: " + String(j.userMessage).slice(0, 120));
    if (j.safeText && j.safeText !== j.inputText) console.log("        safeText: " + String(j.safeText).slice(0, 200));
    if (j.outputText && j.outputText !== j.safeText) console.log("        outputText: " + String(j.outputText).slice(0, 200));
    if (j.error) console.log("        error: " + String(j.error).slice(0, 160));
  }
  if (all.length > 12) console.log("   ... " + (all.length - 12) + " more items");
}
