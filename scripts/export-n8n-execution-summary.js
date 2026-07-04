const fs = require("fs");
const { parse } = require("flatted");

const raw = fs.readFileSync(".tmp/n8n-execution-raw-flatted.json", "utf8");
const data = parse(raw);
const runData = data.resultData.runData;
const summary = {};

for (const [nodeName, runs] of Object.entries(runData)) {
  if (!nodeName.startsWith("SoterAI")) continue;
  const main = runs[0]?.data?.main ?? [];
  const first = main[0]?.[0]?.json ?? {};
  summary[nodeName] = first;
}

fs.writeFileSync(".tmp/n8n-real-execution-summary.json", JSON.stringify(summary, null, 2));
console.log(".tmp/n8n-real-execution-summary.json");
