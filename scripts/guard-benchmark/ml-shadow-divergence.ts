/**
 * WS1.1 — ML shadow-divergence report (committed, reproducible).
 *
 * Runs the guard in SHADOW mode over the frozen corpora and reports exactly
 * what the ML tier WOULD change if it were enforcing. This is the evidence
 * artefact required before flipping SOTERAI_ML_AUGMENT to "enforce".
 *
 * Reports, for INPUT direction:
 *   - rules-only action distribution (baseline)
 *   - ML would-escalate count on the untuned attack corpus (recall lift)
 *   - ML would-escalate count on benign corpora (false-positive cost)
 *   - per-case divergence table for manual review
 *
 * Requires the model weights (Git-LFS) and trust boundary to be configured;
 * exits with a clear message when the model cannot load.
 *
 * Run:
 *   npx tsx scripts/guard-benchmark/ml-shadow-divergence.ts
 */

import { analyzeText } from "../../lib/guard/analyze";
import { augmentWithMl, __resetMlBackendForTests } from "../../lib/guard/mlAugment";
import { BENIGN_CONTROL_EXPANDED } from "../../lib/classifiers/datasets/expanded/benignControlExpanded";
import { HELDOUT_UNTUNED_ATTACKS, HELDOUT_UNTUNED_BENIGN } from "./_heldout-corpora";

process.env.SOTERAI_ML_AUGMENT = "shadow";
__resetMlBackendForTests();

interface Row {
  id: string;
  corpus: string;
  baseAction: string;
  mlRan: boolean;
  wouldEscalate: boolean;
  predictedLabel?: string;
  confidence?: number;
  error?: string;
}

async function evaluate(id: string, corpus: string, text: string): Promise<Row> {
  const base = analyzeText(text, "INPUT");
  const augmented = await augmentWithMl(base, text, "INPUT");
  const ml = (augmented.metadata as Record<string, unknown> | undefined)?.ml as
    | { ran?: boolean; wouldEscalate?: boolean; predictedLabel?: string; confidence?: number; error?: string }
    | undefined;
  return {
    id,
    corpus,
    baseAction: base.action,
    mlRan: ml?.ran === true,
    wouldEscalate: ml?.wouldEscalate === true,
    predictedLabel: ml?.predictedLabel,
    confidence: ml?.confidence,
    error: ml?.error,
  };
}

async function main() {
  const rows: Row[] = [];

  for (const [index, text] of HELDOUT_UNTUNED_ATTACKS.entries()) {
    rows.push(await evaluate(`atk-${String(index + 1).padStart(3, "0")}`, "heldout-attack", text));
  }
  for (const [index, text] of HELDOUT_UNTUNED_BENIGN.entries()) {
    rows.push(await evaluate(`hbn-${String(index + 1).padStart(3, "0")}`, "heldout-benign", text));
  }
  const control = BENIGN_CONTROL_EXPANDED as { id: string; text: string; direction?: "INPUT" | "OUTPUT" }[];
  for (const item of control.filter((entry) => (entry.direction ?? "INPUT") === "INPUT")) {
    rows.push(await evaluate(item.id, "benign-control", item.text));
  }

  const mlErrors = rows.filter((row) => row.error);
  if (mlErrors.length === rows.length) {
    console.error(
      "ML model could not be loaded (all rows fail-open). Pull Git-LFS weights and configure " +
        "the signed-manifest trust boundary (see .env.example ML section), then re-run.",
    );
    console.error(`First error: ${mlErrors[0]?.error}`);
    process.exit(2);
  }

  const summarise = (corpus: string) => {
    const subset = rows.filter((row) => row.corpus === corpus);
    const caught = subset.filter((row) => row.baseAction !== "ALLOW").length;
    const wouldEscalate = subset.filter((row) => row.wouldEscalate).length;
    return {
      corpus,
      total: subset.length,
      rulesCaught: caught,
      rulesRecall: Number((caught / Math.max(1, subset.length)).toFixed(4)),
      mlWouldEscalate: wouldEscalate,
      mlEscalateRate: Number((wouldEscalate / Math.max(1, subset.length)).toFixed(4)),
    };
  };

  const summary = {
    mode: "shadow",
    date: new Date().toISOString().slice(0, 10),
    corpora: [summarise("heldout-attack"), summarise("heldout-benign"), summarise("benign-control")],
    divergences: rows.filter((row) => row.wouldEscalate),
  };

  console.log(JSON.stringify(summary, null, 2));

  const attack = summary.corpora[0];
  const benignFp = summary.corpora[1].mlWouldEscalate + summary.corpora[2].mlWouldEscalate;
  const benignTotal = summary.corpora[1].total + summary.corpora[2].total;
  console.log("\n=== WS1.1 shadow-divergence verdict ===");
  console.log(
    `Attack corpus: rules ${attack.rulesCaught}/${attack.total} caught; ` +
      `ML would additionally escalate ${attack.mlWouldEscalate} (recall lift evidence).`,
  );
  console.log(
    `Benign corpora: ML would escalate ${benignFp}/${benignTotal} ` +
      `(${(100 * (benignFp / Math.max(1, benignTotal))).toFixed(2)}% FP cost of enforcing).`,
  );
}

main().catch((error) => {
  console.error("Shadow-divergence run failed:", error);
  process.exit(1);
});
