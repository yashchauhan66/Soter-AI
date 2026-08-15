/**
 * Score the fresh-format SECRET eval through the REAL production path.
 *
 * WHY A SEPARATE HARNESS FROM eval-crossdist-production.ts
 *   That one is stratified-sampled and reports one blended recall. Here the
 *   interesting quantity is not the average: it is the split between vendor
 *   formats the detector has a rule for and the ones it does not, and the split
 *   between what the RULES tier catches and what the ML tier adds. A single
 *   number would average a regression guard together with a known blind spot and
 *   report something true of neither.
 *
 *   It composes the tiers identically — analyzeText() then augmentWithMl() —
 *   because analyzeText is synchronous and never calls the ML tier on its own.
 *   See eval-crossdist-production.ts for the full explanation of that bug.
 *
 * WHAT A LOW SCORE HERE MEANS
 *   SECRET has ZERO rows in every crossdist eval set, so its cross-distribution
 *   recall has never been measured, while `DEFAULT_INPUT_RELIABLE_LABELS` trusts
 *   the label on INPUT in production. This harness is what makes that number
 *   exist. It is eval-only; see build-secret-format-eval.ts for why these rows
 *   must never be added to training.
 *
 * USAGE
 *   npx tsx scripts/ml/eval-secret-formats.ts \
 *     --file datasets/secret-format-eval.jsonl \
 *     --out artifacts/ml/secret-format-eval.json
 */
import * as path from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { config as loadEnvFile } from "dotenv";

loadEnvFile({ path: path.resolve(process.cwd(), ".env"), quiet: true });

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : (process.argv[i + 1] ?? fallback);
}

const file = arg("--file", "datasets/secret-format-eval.jsonl");
const outPath = arg("--out", "artifacts/ml/secret-format-eval.json");
process.env.SOTERAI_ML_AUGMENT = arg("--mode", "enforce");

type SecretRow = {
  text: string;
  label: string;
  source: string;
  detectorCovered: boolean;
  carrier: number;
};

type FamilyTally = {
  family: string;
  covered: boolean;
  n: number;
  rulesCaught: number;
  e2eCaught: number;
  mlPredictedSecret: number;
  gates: Record<string, number>;
};

const pct = (a: number, b: number) => (b ? Number(((a / b) * 100).toFixed(2)) : 0);

async function main(): Promise<void> {
  const { analyzeText } = await import("../../lib/guard/analyze");
  const { augmentWithMl, resolveMlAugmentMode } = await import("../../lib/guard/mlAugment");

  if (resolveMlAugmentMode() === "off") {
    console.error("[FATAL] ML tier resolved to 'off'. Set ML_ONNX_MODEL_PATH; refusing to");
    console.error("        emit a number that would look like an ML measurement but is not.");
    process.exit(2);
  }

  const rows: SecretRow[] = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l) as SecretRow);

  const byFamily = new Map<string, FamilyTally>();
  let rulesCaught = 0;
  let e2eCaught = 0;
  let mlRan = 0;
  let mlErrors = 0;
  const missedExamples: Array<{ family: string; text: string; mlLabel?: string; gate?: string }> = [];

  const flagged = (v: { allowed?: boolean; action?: string }) =>
    v.allowed === false || (v.action !== undefined && v.action !== "ALLOW");

  for (const [i, r] of rows.entries()) {
    const family = r.source.replace(/^secret-format:/, "");
    const before = analyzeText(r.text, "INPUT");
    const after = await augmentWithMl(before, r.text, "INPUT");

    const meta = (after as { metadata?: Record<string, unknown> }).metadata ?? {};
    const ml = meta.ml as
      | { ran?: boolean; error?: unknown; predictedLabel?: string; gatedBy?: string }
      | undefined;
    if (ml?.ran) mlRan++;
    if (ml?.error) mlErrors++;

    const rulesHit = flagged(before);
    const e2eHit = flagged(after);
    if (rulesHit) rulesCaught++;
    if (e2eHit) e2eCaught++;

    const t = byFamily.get(family) ?? {
      family,
      covered: r.detectorCovered,
      n: 0,
      rulesCaught: 0,
      e2eCaught: 0,
      mlPredictedSecret: 0,
      gates: {},
    };
    t.n++;
    if (rulesHit) t.rulesCaught++;
    if (e2eHit) t.e2eCaught++;
    if (ml?.predictedLabel === "SECRET") t.mlPredictedSecret++;
    if (!e2eHit && ml?.gatedBy) t.gates[ml.gatedBy] = (t.gates[ml.gatedBy] ?? 0) + 1;
    byFamily.set(family, t);

    if (!e2eHit && missedExamples.length < 25) {
      missedExamples.push({
        family,
        // Truncated: these are synthetic, but there is no reason for a full
        // credential-shaped string to sit in an artifact that gets committed.
        text: r.text.slice(0, 60) + (r.text.length > 60 ? "…" : ""),
        mlLabel: ml?.predictedLabel,
        gate: ml?.gatedBy,
      });
    }
    if ((i + 1) % 20 === 0) process.stderr.write(`\r[scan] ${i + 1}/${rows.length}`);
  }
  process.stderr.write(`\r[scan] ${rows.length}/${rows.length}\n`);

  const fams = [...byFamily.values()];
  const cov = fams.filter((f) => f.covered);
  const unc = fams.filter((f) => !f.covered);
  const sum = (list: FamilyTally[], k: "n" | "rulesCaught" | "e2eCaught") =>
    list.reduce((a, f) => a + f[k], 0);

  const report = {
    file,
    rows: rows.length,
    families: fams.length,
    mlTierRan: mlRan,
    mlErrors,
    semanticMargin: Number(process.env.SOTERAI_ML_SEMANTIC_MARGIN ?? "0"),
    abstainEntropyOverride: process.env.SOTERAI_ML_ABSTAIN_ENTROPY
      ? Number(process.env.SOTERAI_ML_ABSTAIN_ENTROPY)
      : null,
    detectionTier: process.env.SOTERAI_DETECTION_TIER ?? null,
    modelPath: process.env.ML_ONNX_MODEL_PATH ?? null,
    overall: {
      rulesRecall: pct(rulesCaught, rows.length),
      endToEndRecall: pct(e2eCaught, rows.length),
      mlDeltaPoints: Number((pct(e2eCaught, rows.length) - pct(rulesCaught, rows.length)).toFixed(2)),
    },
    detectorCovered: {
      formats: cov.length,
      rows: sum(cov, "n"),
      rulesRecall: pct(sum(cov, "rulesCaught"), sum(cov, "n")),
      endToEndRecall: pct(sum(cov, "e2eCaught"), sum(cov, "n")),
    },
    detectorBlindSpot: {
      formats: unc.length,
      rows: sum(unc, "n"),
      rulesRecall: pct(sum(unc, "rulesCaught"), sum(unc, "n")),
      endToEndRecall: pct(sum(unc, "e2eCaught"), sum(unc, "n")),
    },
    byFamily: Object.fromEntries(
      fams
        .sort((a, b) => a.e2eCaught / a.n - b.e2eCaught / b.n || a.family.localeCompare(b.family))
        .map((f) => [
          f.family,
          {
            covered: f.covered,
            n: f.n,
            rulesRecall: pct(f.rulesCaught, f.n),
            endToEndRecall: pct(f.e2eCaught, f.n),
            mlPredictedSecret: f.mlPredictedSecret,
            gates: f.gates,
          },
        ]),
    ),
    missedExamples,
  };

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n", "utf8");

  const line = "-".repeat(70);
  console.log("\n" + "=".repeat(70));
  console.log(`  SECRET fresh-format eval — ${rows.length} rows, ${fams.length} vendor formats`);
  console.log(`  model ${report.modelPath ?? "(none)"}   ml ran ${mlRan}/${rows.length}   errors ${mlErrors}`);
  console.log(line);
  console.log(`  OVERALL        rules ${report.overall.rulesRecall}%   end-to-end ${report.overall.endToEndRecall}%   (ML ${report.overall.mlDeltaPoints >= 0 ? "+" : ""}${report.overall.mlDeltaPoints} pts)`);
  console.log(`  has rule       rules ${report.detectorCovered.rulesRecall}%   end-to-end ${report.detectorCovered.endToEndRecall}%   (${report.detectorCovered.formats} formats)`);
  console.log(`  NO rule        rules ${report.detectorBlindSpot.rulesRecall}%   end-to-end ${report.detectorBlindSpot.endToEndRecall}%   (${report.detectorBlindSpot.formats} formats)`);
  console.log(line);
  console.log("  per family (worst first):");
  for (const [name, f] of Object.entries(report.byFamily)) {
    const flag = f.endToEndRecall === 0 ? "MISS" : f.endToEndRecall === 100 ? "ok  " : "part";
    const gates = Object.keys(f.gates).length ? `  gated:${JSON.stringify(f.gates)}` : "";
    console.log(
      `   ${flag} ${name.padEnd(18)} rules ${String(f.rulesRecall).padStart(6)}%  e2e ${String(f.endToEndRecall).padStart(6)}%` +
        `  mlSECRET ${f.mlPredictedSecret}/${f.n}${f.covered ? "" : "  [no detector rule]"}${gates}`,
    );
  }
  console.log("=".repeat(70) + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
