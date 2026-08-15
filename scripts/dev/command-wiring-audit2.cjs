// Improved audit: a declared command is "wired" if its exact id string appears
// anywhere in extension src (registerCommand, helper reg(), executeCommand, menus).
const fs = require("fs");
const path = require("path");
const root = "c:/Users/USER/OneDrive/Desktop/Ai-Agent-Security-Guard/packages/vscode-extension";
const pj = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const declared = (pj.contributes.commands || []).map((c) => c.command);

function walk(d, out = []) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (!p.includes("__tests__") && !p.includes("node_modules")) walk(p, out); }
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}
const files = walk(path.join(root, "src"));
const blob = files.map((p) => fs.readFileSync(p, "utf8")).join("\n");

const wired = declared.filter((c) => blob.includes(JSON.stringify(c).slice(1, -1)) || blob.includes(c));
const missing = declared.filter((c) => !blob.includes(c));
console.log("DECLARED =", declared.length);
console.log("WIRED (id string present in src) =", wired.length);
console.log("TRULY ABSENT (id never appears in src) =", missing.length);
missing.forEach((m) => console.log("  ABSENT:", m));
