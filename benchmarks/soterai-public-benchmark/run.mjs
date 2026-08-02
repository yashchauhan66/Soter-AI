// Neutral same-corpus benchmark runner.
// Any vendor (or third party) implements ONE function `detect(text)` and points
// --adapter at it. The harness feeds the frozen corpus to every adapter the
// same way and reports: recall per category, FP rate, p50/p95 latency, hashes.
// Usage: node run.mjs --adapter ./adapters/soterai.mjs --witness "name,org"
import { readFileSync, readdirSync, createHash } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]);
    return acc;
  }, [])
);

const corpusDir = new URL("./corpus/", import.meta.url).pathname;
const attackFiles = readdirSync(corpusDir).filter((f) => f.startsWith("attack-"));
const benignFile = "benign-controls.jsonl";

function loadJsonl(p) {
  return readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}
function pct(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

const adapterPath = args.adapter || "./adapters/soterai.mjs";
const { detect } = await import(new URL(adapterPath, import.meta.url).href);

const report = {
  benchmark: "soterai-public-benchmark",
  version: "1.0.0",
  adapter: adapterPath,
  witness: args.witness || null,
  corpusHash: null,
  startedAt: new Date().toISOString(),
  categories: [],
  totals: {},
};
const hash = createHash("sha256");

let hits = 0, total = 0, fp = 0, benignTotal = 0;
const lat = [];

for (const f of attackFiles) {
  const items = loadJsonl(join(corpusDir, f));
  let cHit = 0;
  for (const ex of items) {
    hash.update(ex.text);
    const t0 = performance.now();
    const r = await detect(ex.text);
    lat.push(performance.now() - t0);
    const flagged = !!(r && (r.block || r.riskType || r.flagged));
    if (flagged) { hits++; cHit++; }
    total++;
  }
  report.categories.push({ category: f.replace("attack-", "").replace(".jsonl", ""), cases: items.length, detected: cHit, recallPct: +((cHit / items.length) * 100).toFixed(2) });
}
const benign = loadJsonl(join(corpusDir, benignFile));
for (const ex of benign) {
  hash.update(ex.text);
  const r = await detect(ex.text);
  const flagged = !!(r && (r.block || r.riskType || r.flagged));
  if (flagged) fp++;
  benignTotal++;
}

report.corpusHash = hash.digest("hex");
report.totals = {
  attackCases: total,
  attackDetected: hits,
  recallPct: +((hits / total) * 100).toFixed(2),
  benignCases: benignTotal,
  falsePositives: fp,
  fpRatePct: +((fp / benignTotal) * 100).toFixed(3),
  latencyMs: { p50: +pct(lat, 50).toFixed(2), p95: +pct(lat, 95).toFixed(2) },
};
report.finishedAt = new Date().toISOString();

console.log(JSON.stringify(report, null, 2));
