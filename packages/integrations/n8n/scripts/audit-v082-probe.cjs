/** Dumps full item JSON + node parameters for named nodes, to confirm/refute specific findings. */
const fs = require("fs");
const path = require("path");
const { parse: unflatten } = require("flatted");

const dir = path.join(__dirname, "..", "artifacts", "v082-audit");
const raw = JSON.parse(fs.readFileSync(path.join(dir, "exec78.json"), "utf8")).data;
const exec = { ...raw, data: typeof raw.data === "string" ? unflatten(raw.data) : raw.data };
const run = exec.data.resultData.runData;
const wf = JSON.parse(fs.readFileSync(path.join(dir, "create-resp.json"), "utf8")).data;
const byName = new Map(wf.nodes.map((n) => [n.name, n]));

const targets = process.argv.slice(2);
for (const t of targets) {
  const node = [...byName.keys()].find((n) => n.startsWith(t));
  console.log("\n" + "=".repeat(78) + "\nNODE: " + node);
  const cfg = byName.get(node);
  console.log("-- parameters --");
  console.log(JSON.stringify(cfg.parameters, null, 1));
  console.log("-- onError:", cfg.onError || "(default)", "| alwaysOutputData:", cfg.alwaysOutputData || false);
  const runs = run[node];
  if (!runs) { console.log("-- DID NOT RUN"); continue; }
  const main = (runs[0].data && runs[0].data.main) || [];
  main.forEach((branch, idx) => {
    (branch || []).forEach((it, i) => {
      console.log("-- out" + idx + " item" + i + " --");
      console.log(JSON.stringify(it.json, null, 1).slice(0, 4000));
    });
  });
}
