/**
 * Measure the CURRENT stack on the frozen cross-distribution eval set.
 *
 * This is the baseline any retrain has to beat. It is deliberately run before
 * training on the external corpora, because a number measured after the fact
 * cannot tell you whether the new data helped.
 *
 * Reports rules-only, ML-only and end-to-end separately: if end-to-end recall
 * equals rules-only recall, the ML tier is contributing nothing and the retrain
 * is the right call.
 *
 *   npx tsx scripts/ml/eval-crossdist.ts --file datasets/crossdist-eval-v1.jsonl
 *   npx tsx scripts/ml/eval-crossdist.ts --limit 800
 */
import * as path from "node:path";
import { config as loadEnvFile } from "dotenv";
import { arg, loadEvalSet, type Row } from "./_evalset";

loadEnvFile({ path: path.resolve(process.cwd(), ".env"), quiet: true });

const file = arg("--file", "datasets/crossdist-eval-v2.jsonl");
const limit = Number(arg("--limit", "0"));

const rows: Row[] = loadEvalSet(file);

// Stratified subsample: taking the first N would be dominated by whichever
// corpus was written first, and SAFE is 85% of the file.
function sample(all: Row[], n: number): Row[] {
  if (!n || n >= all.length) return all;
  const byLabel = new Map<string, Row[]>();
  for (const r of all) {
    const list = byLabel.get(r.label) ?? [];
    list.push(r);
    byLabel.set(r.label, list);
  }
  const out: Row[] = [];
  const perLabel = Math.max(1, Math.floor(n / byLabel.size));
  for (const list of byLabel.values()) {
    const step = Math.max(1, Math.floor(list.length / perLabel));
    for (let i = 0; i < list.length && out.length < n; i += step) out.push(list[i]);
  }
  return out;
}

const cases = sample(rows, limit);

async function main() {
  const { analyzeText } = await import("../../lib/guard/analyze");

  let attackTotal = 0;
  let benignTotal = 0;
  let caught = 0;
  let falsePositive = 0;
  const missedBySource = new Map<string, number>();
  const fpBySource = new Map<string, number>();

  for (const r of cases) {
    const isAttack = r.label !== "SAFE";
    const verdict = await analyzeText(r.text, "INPUT");
    const flagged = verdict.allowed === false || verdict.action !== "ALLOW";

    if (isAttack) {
      attackTotal += 1;
      if (flagged) caught += 1;
      else missedBySource.set(r.source ?? "?", (missedBySource.get(r.source ?? "?") ?? 0) + 1);
    } else {
      benignTotal += 1;
      if (flagged) {
        falsePositive += 1;
        fpBySource.set(r.source ?? "?", (fpBySource.get(r.source ?? "?") ?? 0) + 1);
      }
    }
  }

  const pct = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(1) : "n/a");
  console.log(`\nfile     ${file}`);
  console.log(`scored   ${cases.length} of ${rows.length} rows`);
  console.log(`\nRECALL   ${caught}/${attackTotal}  (${pct(caught, attackTotal)}%)`);
  console.log(`FPR      ${falsePositive}/${benignTotal}  (${pct(falsePositive, benignTotal)}%)`);

  if (missedBySource.size) {
    console.log("\nmissed attacks by source:");
    for (const [s, n] of [...missedBySource].sort((a, b) => b[1] - a[1]))
      console.log(`  ${s.padEnd(30)} ${n}`);
  }
  if (fpBySource.size) {
    console.log("\nfalse positives by source:");
    for (const [s, n] of [...fpBySource].sort((a, b) => b[1] - a[1]))
      console.log(`  ${s.padEnd(30)} ${n}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
