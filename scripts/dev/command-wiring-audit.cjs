// Audit: are ALL declared package.json commands actually registered in source?
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
const allSrc = walk(path.join(root, "src")).map((p) => fs.readFileSync(p, "utf8")).join("\n");
const regMatches = [...allSrc.matchAll(/registerCommand\(\s*["'`]([a-zA-Z0-9._-]+)/g)].map((m) => m[1]);
const registered = new Set(regMatches);

const missing = declared.filter((c) => !registered.has(c));
console.log("DECLARED_COMMANDS =", declared.length);
console.log("REGISTERED_IN_SRC =", registered.size);
console.log("MISSING_COUNT     =", missing.length);
console.log("\n--- DECLARED but NOT registerCommand()'d (may be dead or aliased) ---");
missing.forEach((m) => console.log("  MISSING:", m));
console.log("\n--- REGISTERED in src but NOT declared in package.json (internal) ---");
[...registered].filter((r) => !declared.includes(r)).forEach((r) => console.log("  INTERNAL:", r));
