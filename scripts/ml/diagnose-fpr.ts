/**
 * Attribute every false positive to the exact finding that caused it.
 *
 * WHY
 *   eval-crossdist.ts says FPR is 50%. That is a symptom. A fix needs the cause:
 *   which detector, which risk type, which tier. "Loosen the model" and "delete
 *   one over-broad regex" are completely different repairs, and only one of them
 *   is correct — guessing wrong costs recall for nothing.
 *
 *   npx tsx scripts/ml/diagnose-fpr.ts --limit 400
 */
import * as path from "node:path";
import { config as loadEnvFile } from "dotenv";
import { arg, loadEvalSet, type Row } from "./_evalset";

loadEnvFile({ path: path.resolve(process.cwd(), ".env"), quiet: true });

const file = arg("--file", "datasets/crossdist-eval-v2.jsonl");
const limit = Number(arg("--limit", "400"));

const all: Row[] = loadEvalSet(file);

// Benign only — this run is exclusively about why clean text gets flagged.
const benign = all.filter((r) => r.label === "SAFE").slice(0, limit);

async function main() {
  const { analyzeText } = await import("../../lib/guard/analyze");

  const byRiskType = new Map<string, number>();
  const byFindingLabel = new Map<string, number>();
  const byAction = new Map<string, number>();
  const mlCaused: string[] = [];
  const examples = new Map<string, string[]>();
  let flagged = 0;

  for (const r of benign) {
    const v = await analyzeText(r.text, "INPUT");
    if (v.allowed !== false && v.action === "ALLOW") continue;
    flagged += 1;

    byAction.set(v.action, (byAction.get(v.action) ?? 0) + 1);
    for (const t of v.riskTypes ?? []) byRiskType.set(t, (byRiskType.get(t) ?? 0) + 1);

    for (const f of (v.findings ?? []) as Array<{ label?: string; type?: string }>) {
      const key = f.label ?? f.type ?? "?";
      byFindingLabel.set(key, (byFindingLabel.get(key) ?? 0) + 1);
      const ex = examples.get(key) ?? [];
      if (ex.length < 3) {
        ex.push(r.text.slice(0, 110).replace(/\s+/g, " "));
        examples.set(key, ex);
      }
      // "ML anomaly (...)" is the marker mlAugment stamps on an escalation it
      // caused, so this separates a model false positive from a rules one.
      if (/^ML anomaly/.test(key)) mlCaused.push(r.text.slice(0, 90));
    }
  }

  const pct = (n: number) => ((n / Math.max(1, flagged)) * 100).toFixed(0);
  console.log(`\nscored ${benign.length} benign rows`);
  console.log(`flagged ${flagged}  (FPR ${((flagged / benign.length) * 100).toFixed(1)}%)`);
  console.log(`\nof those, ML tier caused: ${mlCaused.length} (${pct(mlCaused.length)}%)`);
  console.log(`rules caused: ${flagged - mlCaused.length} (${pct(flagged - mlCaused.length)}%)`);

  console.log("\nby action:");
  for (const [k, n] of [...byAction].sort((a, b) => b[1] - a[1]))
    console.log(`  ${k.padEnd(24)} ${n}`);

  console.log("\nby risk type:");
  for (const [k, n] of [...byRiskType].sort((a, b) => b[1] - a[1]))
    console.log(`  ${k.padEnd(32)} ${n}  (${pct(n)}% of FPs)`);

  console.log("\ntop offending findings:");
  for (const [k, n] of [...byFindingLabel].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`\n  ${n.toString().padStart(4)}x  ${k}`);
    for (const e of examples.get(k) ?? []) console.log(`         "${e}"`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
