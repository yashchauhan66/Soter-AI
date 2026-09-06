/**
 * Score an arbitrary held-out attack/benign battery through the REAL production
 * path (analyzeText rules tier -> augmentWithMl), reporting recall and FPR broken
 * out by label and by `category`.
 *
 * WHY THIS EXISTS
 *   eval-crossdist-production.ts scores the canonical crossdist set. This scores an
 *   AD-HOC battery (e.g. the v15 held-out test rows the generation workflow emits,
 *   or the red-team probe corpus dumped to JSONL) so a new corpus can be measured
 *   before and after a retrain on identical rows. It mirrors that harness's ML
 *   wiring exactly: the metadata key is `ml` (not `mlAugment`), mode defaults to
 *   `enforce` so the tier is actually exercised, and it refuses to emit a number if
 *   the tier resolved to `off` (which would silently be a rules-only measurement).
 *
 *   A row is "caught" iff the pipeline does not return ALLOW. Benign rows
 *   (label === "SAFE") are correct only on a clean ALLOW.
 *
 * USAGE
 *   npx tsx scripts/ml/score-battery.ts --file datasets/v15-test-battery.jsonl \
 *       --out artifacts/ml/v15-battery-v14.json
 */
import * as path from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { config as loadEnvFile } from "dotenv";

loadEnvFile({ path: path.resolve(process.cwd(), ".env"), quiet: true });

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i < 0 ? fallback : (process.argv[i + 1] ?? fallback);
}

const file = arg("--file", "datasets/v15-test-battery.jsonl");
const outPath = arg("--out", "artifacts/ml/v15-battery.json");
const missPath = arg("--dump-misses", "artifacts/ml/v15-battery-misses.jsonl");
process.env.SOTERAI_ML_AUGMENT = arg("--mode", "enforce");

type Row = { text: string; label: string; category?: string; language?: string };

function loadRows(p: string): Row[] {
  return readFileSync(p, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Row);
}

type Tally = { attacks: number; caught: number; benign: number; fp: number };
const blank = (): Tally => ({ attacks: 0, caught: 0, benign: 0, fp: 0 });
const pct = (a: number, b: number) => (b ? Number(((a / b) * 100).toFixed(2)) : 0);

async function main(): Promise<void> {
  const { analyzeText } = await import("../../lib/guard/analyze");
  const { augmentWithMl, resolveMlAugmentMode } = await import("../../lib/guard/mlAugment");

  const mode = resolveMlAugmentMode();
  if (mode === "off") {
    console.error("[FATAL] ML tier resolved to 'off'. Set ML_ONNX_MODEL_PATH; refusing to");
    console.error("        emit a number that would look like an ML measurement but is not.");
    process.exit(2);
  }

  const rows = loadRows(file);
  const overall = blank();
  const rulesOnly = blank();
  const byLabel = new Map<string, Tally>();
  const byCategory = new Map<string, Tally>();
  const byLang = new Map<string, Tally>();
  let mlRan = 0;
  let mlErrors = 0;
  const missRows: Array<Row & { predictedLabel?: string; gatedBy?: string; attackProbability?: number }> = [];
  const fpRows: Array<Row & { predictedLabel?: string; rule?: string }> = [];

  const flagged = (v: { allowed?: boolean; action?: string }) =>
    v.allowed === false || (v.action !== undefined && v.action !== "ALLOW");

  const bump = (m: Map<string, Tally>, k: string): Tally => {
    const t = m.get(k) ?? blank();
    m.set(k, t);
    return t;
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const isAttack = r.label !== "SAFE";
    const before = analyzeText(r.text, "INPUT");
    const after = await augmentWithMl(before, r.text, "INPUT");
    const ml = (after.metadata as { ml?: Record<string, unknown> } | undefined)?.ml;
    if (ml?.ran === true) mlRan++;
    if (typeof ml?.error === "string") mlErrors++;

    const rulesHit = flagged(before);
    const e2eHit = flagged(after);
    const lt = bump(byLabel, r.label);
    const ct = r.category ? bump(byCategory, r.category) : null;
    const gt = r.language ? bump(byLang, r.language) : null;

    if (isAttack) {
      overall.attacks++; rulesOnly.attacks++; lt.attacks++;
      if (ct) ct.attacks++;
      if (gt) gt.attacks++;
      if (rulesHit) rulesOnly.caught++;
      if (e2eHit) {
        overall.caught++; lt.caught++;
        if (ct) ct.caught++;
        if (gt) gt.caught++;
      } else {
        missRows.push({
          ...r,
          predictedLabel: ml?.predictedLabel as string | undefined,
          gatedBy: (ml?.gatedBy as string) ?? (ml?.ran ? "model-predicted-safe" : "ml-did-not-run"),
          attackProbability: ml?.attackProbability as number | undefined,
        });
      }
    } else {
      overall.benign++; rulesOnly.benign++; lt.benign++;
      if (ct) ct.benign++;
      if (gt) gt.benign++;
      if (rulesHit) rulesOnly.fp++;
      if (e2eHit) {
        overall.fp++; lt.fp++;
        if (ct) ct.fp++;
        if (gt) gt.fp++;
        fpRows.push({
          ...r,
          predictedLabel: ml?.predictedLabel as string | undefined,
          rule: after.findings?.slice().sort((a, b) => b.score - a.score)[0]?.label,
        });
      }
    }
    if ((i + 1) % 100 === 0) process.stderr.write(`\r[score] ${i + 1}/${rows.length}`);
  }
  process.stderr.write(`\r[score] ${rows.length}/${rows.length}\n`);

  const tallyToJson = (m: Map<string, Tally>) =>
    Object.fromEntries(
      [...m.entries()].sort().map(([k, t]) => [
        k,
        t.attacks > 0
          ? { recall: pct(t.caught, t.attacks), attacks: t.attacks, caught: t.caught }
          : { fpr: pct(t.fp, t.benign), benign: t.benign, fp: t.fp },
      ]),
    );

  const report = {
    file,
    rows: rows.length,
    mlMode: mode,
    mlTierRan: mlRan,
    mlErrors,
    overall: {
      recall: pct(overall.caught, overall.attacks),
      attacks: overall.attacks,
      caught: overall.caught,
      fpr: pct(overall.fp, overall.benign),
      benign: overall.benign,
      fp: overall.fp,
    },
    rulesOnly: {
      recall: pct(rulesOnly.caught, rulesOnly.attacks),
      fpr: pct(rulesOnly.fp, rulesOnly.benign),
    },
    mlDelta: {
      recallPoints: Number((pct(overall.caught, overall.attacks) - pct(rulesOnly.caught, rulesOnly.attacks)).toFixed(2)),
    },
    byLabel: tallyToJson(byLabel),
    byCategory: tallyToJson(byCategory),
    byLanguage: tallyToJson(byLang),
  };

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  writeFileSync(missPath, missRows.map((m) => JSON.stringify(m)).join("\n") + (missRows.length ? "\n" : ""));
  const fpDump = missPath.replace(/misses/, "fps").replace(/\.jsonl$/, "") + ".jsonl";
  writeFileSync(fpDump, fpRows.map((m) => JSON.stringify(m)).join("\n") + (fpRows.length ? "\n" : ""));

  console.log("=".repeat(70));
  console.log(`BATTERY  ${file}`);
  console.log(`  rows ${rows.length}   ml ran ${mlRan}   errors ${mlErrors}`);
  console.log(`  rules only   recall ${report.rulesOnly.recall}%   FPR ${report.rulesOnly.fpr}%`);
  console.log(`  rules + ML   recall ${report.overall.recall}%   FPR ${report.overall.fpr}%   (+${report.mlDelta.recallPoints} pts)`);
  console.log("-".repeat(70));
  console.log("  weakest labels:");
  const weak = Object.entries(report.byLabel)
    .filter(([, v]) => "recall" in (v as object))
    .sort((a, b) => (a[1] as { recall: number }).recall - (b[1] as { recall: number }).recall)
    .slice(0, 8);
  for (const [k, v] of weak) {
    const r = v as { recall: number; caught: number; attacks: number };
    console.log(`    ${k.padEnd(28)} ${String(r.recall).padStart(6)}%  (${r.caught}/${r.attacks})`);
  }
  console.log(`\n[write] ${outPath}`);
  console.log(`[write] ${missPath}  (${missRows.length} misses)`);
  console.log(`[write] ${fpDump}  (${fpRows.length} FPs)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
