/**
 * SoterAI red-team weakness probe — v14 classifier + deterministic rules tier.
 *
 * WHY THIS EXISTS
 *   models/ml-classifier-v14/eval_results.json reports four label families with
 *   materially lower recall than the rest of the head:
 *     ENCODING_OBFUSCATION   recall 0.682
 *     MULTI_TURN_ESCALATION  recall 0.719
 *     MODEL_EXTRACTION       recall 0.699  (precision 0.780 — worst of the 14)
 *     TOOL_CALL_ABUSE        recall 0.932
 *   Those are in-distribution validation numbers. This script measures what
 *   actually reaches a caller: it runs an adversarial corpus through the
 *   PRODUCTION path (analyzeText rules tier, then augmentWithMl) and reports
 *   which attacks come out ALLOW.
 *
 *   Retraining is out of scope by design. The output of this script is the
 *   requirement list for the deterministic (regex) tier.
 *
 * Usage:
 *   npx tsx scripts/guard-benchmark/redteam-weakness-probe.ts
 *   npx tsx scripts/guard-benchmark/redteam-weakness-probe.ts --rules-only
 *   npx tsx scripts/guard-benchmark/redteam-weakness-probe.ts --json out.json
 */
import * as fs from "node:fs";
import { analyzeText } from "../../lib/guard/analyze";
import { augmentWithMl } from "../../lib/guard/mlAugment";
import { REDTEAM_CORPUS, type RedteamCase } from "./_redteam-corpus";

process.env.SOTERAI_MODEL_TRUST_STORE ??= "artifacts/security/model-trust-store.json";
process.env.SOTERAI_MODEL_APPROVED_SOURCES ??= "local-training";

const RULES_ONLY = process.argv.includes("--rules-only");
const JSON_INDEX = process.argv.indexOf("--json");
const JSON_OUT = JSON_INDEX >= 0 ? process.argv[JSON_INDEX + 1] : null;

if (!RULES_ONLY) {
  // The production wiring lives in .env; make it explicit here so the probe does
  // not silently measure a rules-only pipeline and report it as rules+ML.
  process.env.ML_BACKEND = "onnx";
  process.env.SOTERAI_ML_AUGMENT = "enforce";
  process.env.ML_ONNX_MODEL_PATH ??= "models/ml-classifier-v14/model.onnx";
  process.env.ML_ONNX_LABELS_PATH ??= "models/ml-classifier-v14/labels.json";
  process.env.ML_ONNX_CALIBRATION_PATH ??= "models/ml-classifier-v14/calibration.json";
  process.env.ML_ONNX_MAX_LENGTH ??= "256";
  process.env.ML_ONNX_CONFIDENCE_FLOOR ??= "0.5";
}

interface Outcome {
  testCase: RedteamCase;
  action: string;
  riskScore: number;
  riskTypes: string[];
  topFinding: string;
  mlLabel: string;
  mlGatedBy: string;
  caught: boolean;
}

async function evaluate(testCase: RedteamCase): Promise<Outcome> {
  const direction = testCase.direction ?? "INPUT";
  const base = analyzeText(testCase.text, direction, testCase.context);
  const result = RULES_ONLY ? base : await augmentWithMl(base, testCase.text, direction);
  const ml = (result.metadata?.ml ?? {}) as Record<string, unknown>;
  const scored = result.findings.filter((f) => !f.advisoryOnly);

  return {
    testCase,
    action: result.action,
    riskScore: result.riskScore,
    riskTypes: result.riskTypes,
    topFinding: scored.slice().sort((a, b) => b.score - a.score)[0]?.label ?? "(none)",
    mlLabel: String(ml.predictedLabel ?? "-"),
    mlGatedBy: String(ml.gatedBy ?? "-"),
    // An attack is "caught" when the pipeline does not hand the text through
    // as-is; a benign control is "caught" (i.e. correct) only on a clean ALLOW.
    caught: testCase.expect === "safe" ? result.action === "ALLOW" : result.action !== "ALLOW",
  };
}

async function main(): Promise<number> {
  const attacks = REDTEAM_CORPUS.filter((c) => c.expect === "attack");
  const benign = REDTEAM_CORPUS.filter((c) => c.expect === "safe");

  console.log("=".repeat(112));
  console.log(
    `SOTERAI RED-TEAM WEAKNESS PROBE  |  mode=${RULES_ONLY ? "rules-only" : "rules+ML(v14,enforce)"}  ` +
      `|  ${attacks.length} attacks / ${benign.length} benign controls`,
  );
  console.log("=".repeat(112));

  const outcomes: Outcome[] = [];
  for (const testCase of REDTEAM_CORPUS) {
    outcomes.push(await evaluate(testCase));
  }

  // ── Per-family recall ────────────────────────────────────────────────────
  const families = Array.from(new Set(attacks.map((c) => c.family))).sort();
  console.log("\nPER-FAMILY DETECTION (attacks)\n" + "-".repeat(112));
  const familyRows: Array<{ family: string; hit: number; total: number; pct: number }> = [];
  for (const family of families) {
    const rows = outcomes.filter(
      (o) => o.testCase.expect === "attack" && o.testCase.family === family,
    );
    const hit = rows.filter((o) => o.caught).length;
    familyRows.push({ family, hit, total: rows.length, pct: (hit / rows.length) * 100 });
  }
  for (const row of familyRows.slice().sort((a, b) => a.pct - b.pct)) {
    const bar = "#".repeat(Math.round(row.pct / 4)).padEnd(25, ".");
    const flag = row.pct === 100 ? "" : row.pct >= 80 ? "  <- gap" : "  <- WEAK";
    console.log(
      `  ${row.family.padEnd(30)} ${String(row.hit).padStart(3)}/${String(row.total).padEnd(3)} ` +
        `${row.pct.toFixed(1).padStart(6)}%  ${bar}${flag}`,
    );
  }

  // ── Misses ──────────────────────────────────────────────────────────────
  const misses = outcomes.filter((o) => o.testCase.expect === "attack" && !o.caught);
  console.log(`\nMISSED ATTACKS (${misses.length})\n` + "-".repeat(112));
  for (const miss of misses) {
    console.log(
      `  [${miss.testCase.family}] ${miss.testCase.id}  ml=${miss.mlLabel} gate=${miss.mlGatedBy} score=${miss.riskScore}\n` +
        `      "${miss.testCase.text.replace(/\s+/g, " ").slice(0, 148)}"`,
    );
  }

  // ── False positives ─────────────────────────────────────────────────────
  const fps = outcomes.filter((o) => o.testCase.expect === "safe" && !o.caught);
  console.log(
    `\nFALSE POSITIVES ON BENIGN CONTROLS (${fps.length}/${benign.length})\n` + "-".repeat(112),
  );
  for (const fp of fps) {
    console.log(
      `  ${fp.testCase.id}  action=${fp.action} score=${fp.riskScore} rule="${fp.topFinding}" ml=${fp.mlLabel}\n` +
        `      "${fp.testCase.text.replace(/\s+/g, " ").slice(0, 148)}"`,
    );
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  const attackHits = outcomes.filter((o) => o.testCase.expect === "attack" && o.caught).length;
  const recall = (attackHits / attacks.length) * 100;
  const fpr = (fps.length / benign.length) * 100;
  console.log("\n" + "=".repeat(112));
  console.log(
    `SUMMARY  detection ${attackHits}/${attacks.length} = ${recall.toFixed(2)}%   |   ` +
      `benign FPR ${fps.length}/${benign.length} = ${fpr.toFixed(2)}%`,
  );
  console.log("=".repeat(112));

  if (JSON_OUT) {
    fs.writeFileSync(
      JSON_OUT,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          mode: RULES_ONLY ? "rules-only" : "rules+ml-v14-enforce",
          detection: { hit: attackHits, total: attacks.length, pct: Number(recall.toFixed(2)) },
          benignFpr: { hit: fps.length, total: benign.length, pct: Number(fpr.toFixed(2)) },
          perFamily: familyRows,
          misses: misses.map((m) => ({
            id: m.testCase.id,
            family: m.testCase.family,
            text: m.testCase.text,
            mlLabel: m.mlLabel,
            mlGatedBy: m.mlGatedBy,
          })),
          falsePositives: fps.map((f) => ({
            id: f.testCase.id,
            text: f.testCase.text,
            action: f.action,
            rule: f.topFinding,
          })),
        },
        null,
        2,
      ),
    );
    console.log(`\n[probe] wrote ${JSON_OUT}`);
  }

  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);

