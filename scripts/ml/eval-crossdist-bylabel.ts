/**
 * Same measurement as eval-crossdist.ts, broken out PER LABEL and PER LANGUAGE.
 *
 * WHY A SECOND EVALUATOR RATHER THAN A FLAG
 *   The aggregate number is the one that misleads. crossdist-eval-v3 is 28.6% PII
 *   and 25% non-English — two axes the previous eval set had almost none of — so a
 *   single recall figure silently averages "did we catch an injection" together with
 *   "did we catch a PII string in an inbound prompt", which is a different question
 *   and arguably not an INPUT-direction attack at all in our threat model.
 *
 *   Reporting 42.3% without that split invites exactly the wrong fix: retraining the
 *   injection classifier to chase a PII number. This file exists so the headline can
 *   be attributed before anyone acts on it.
 *
 *   npx tsx scripts/ml/eval-crossdist-bylabel.ts --file datasets/crossdist-eval-v3.jsonl --limit 4000
 */
import * as path from "node:path";
import { config as loadEnvFile } from "dotenv";
import { arg, loadEvalSet, type Row } from "./_evalset";

loadEnvFile({ path: path.resolve(process.cwd(), ".env"), quiet: true });

const file = arg("--file", "datasets/crossdist-eval-v3.jsonl");
const limit = Number(arg("--limit", "0"));

const rows: Row[] = loadEvalSet(file);

/** Stratify by (label, language) so a cap cannot silently drop a whole language. */
function sample(all: Row[], n: number): Row[] {
  if (!n || n >= all.length) return all;
  const buckets = new Map<string, Row[]>();
  for (const r of all) {
    const key = `${r.label}\t${(r as Row & { language?: string }).language ?? "?"}`;
    const list = buckets.get(key) ?? [];
    list.push(r);
    buckets.set(key, list);
  }
  const out: Row[] = [];
  const perBucket = Math.max(1, Math.floor(n / buckets.size));
  for (const list of buckets.values()) {
    const step = Math.max(1, Math.floor(list.length / perBucket));
    for (let i = 0; i < list.length && out.length < n; i += step) out.push(list[i]);
  }
  return out;
}

type Tally = { total: number; flagged: number };

function bump(map: Map<string, Tally>, key: string, flagged: boolean): void {
  const t = map.get(key) ?? { total: 0, flagged: 0 };
  t.total += 1;
  if (flagged) t.flagged += 1;
  map.set(key, t);
}

async function main() {
  const { analyzeText } = await import("../../lib/guard/analyze");
  const cases = sample(rows, limit);

  const byLabel = new Map<string, Tally>();
  const byLanguage = new Map<string, Tally>();
  const benignByLanguage = new Map<string, Tally>();
  let attackTotal = 0;
  let caught = 0;
  let benignTotal = 0;
  let falsePositive = 0;

  for (const r of cases) {
    const language = (r as Row & { language?: string }).language ?? "?";
    const isAttack = r.label !== "SAFE";
    const verdict = await analyzeText(r.text, "INPUT");
    const flagged = verdict.allowed === false || verdict.action !== "ALLOW";

    bump(byLabel, r.label, flagged);
    if (isAttack) {
      attackTotal += 1;
      if (flagged) caught += 1;
      bump(byLanguage, language, flagged);
    } else {
      benignTotal += 1;
      if (flagged) falsePositive += 1;
      bump(benignByLanguage, language, flagged);
    }
  }

  const pct = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(1).padStart(5) : "  n/a");

  console.log(`\nfile     ${file}`);
  console.log(`scored   ${cases.length} of ${rows.length} rows`);
  console.log(`\nAGGREGATE`);
  console.log(`  recall ${caught}/${attackTotal}  (${pct(caught, attackTotal)}%)`);
  console.log(`  FPR    ${falsePositive}/${benignTotal}  (${pct(falsePositive, benignTotal)}%)`);

  console.log(`\nRECALL BY LABEL  (SAFE row shows FPR, not recall)`);
  for (const [label, t] of [...byLabel].sort((a, b) => b[1].total - a[1].total)) {
    const tag = label === "SAFE" ? "FPR   " : "recall";
    console.log(`  ${label.padEnd(28)} ${tag} ${pct(t.flagged, t.total)}%  (${t.flagged}/${t.total})`);
  }

  console.log(`\nATTACK RECALL BY LANGUAGE`);
  for (const [lang, t] of [...byLanguage].sort((a, b) => b[1].total - a[1].total)) {
    console.log(`  ${lang.padEnd(10)} ${pct(t.flagged, t.total)}%  (${t.flagged}/${t.total})`);
  }

  console.log(`\nBENIGN FPR BY LANGUAGE`);
  for (const [lang, t] of [...benignByLanguage].sort((a, b) => b[1].total - a[1].total)) {
    console.log(`  ${lang.padEnd(10)} ${pct(t.flagged, t.total)}%  (${t.flagged}/${t.total})`);
  }

  // The aggregate is only meaningful alongside this. PII-in-INPUT is a different
  // question from instruction-override, and mixing them produces a number that
  // points at the wrong fix.
  const pii = byLabel.get("PII");
  if (pii) {
    const others = [...byLabel].filter(([l]) => l !== "SAFE" && l !== "PII");
    const oTotal = others.reduce((s, [, t]) => s + t.total, 0);
    const oCaught = others.reduce((s, [, t]) => s + t.flagged, 0);
    console.log(`\nATTRIBUTION`);
    console.log(`  PII rows are ${((pii.total / attackTotal) * 100).toFixed(1)}% of all attack rows here.`);
    console.log(`  recall excluding PII: ${pct(oCaught, oTotal)}%  (${oCaught}/${oTotal})`);
    console.log(`  recall on PII only:   ${pct(pii.flagged, pii.total)}%  (${pii.flagged}/${pii.total})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
