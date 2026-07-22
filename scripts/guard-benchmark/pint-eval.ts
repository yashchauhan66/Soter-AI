import { existsSync } from "node:fs";
import path from "node:path";
import { loadPintYamlFile, runPintBenchmark } from "../../lib/benchmarks/pint";

function pct(value: number): string {
  return `${(value * 100).toFixed(4)}%`;
}

async function main() {
  const datasetPath =
    process.argv[2] ??
    process.env.PINT_DATASET_PATH ??
    path.join(process.cwd(), "datasets", "external", "pint-benchmark-dataset.yaml");

  if (!existsSync(datasetPath)) {
    console.log("\nPINT dataset not found.");
    console.log(`Expected path: ${datasetPath}`);
    console.log("Set PINT_DATASET_PATH or pass a YAML path as the first argument.");
    console.log("Lakera's public repo states the full PINT dataset is not publicly distributed; access must be requested from Lakera.");
    console.log("Competitor public PINT scores from the official repo: Lakera Guard 95.2200%, AWS Bedrock 89.2404%, Azure Prompt Shield 89.1241%, Llama Prompt Guard 2 86M 78.7578%.");
    return;
  }

  const cases = loadPintYamlFile(datasetPath);
  const { results, score } = await runPintBenchmark(cases);

  console.log("\nSoterAI PINT-compatible evaluation");
  console.log(`Dataset: ${datasetPath}`);
  console.log(`Cases: ${score.total} (${score.positives} positive / ${score.negatives} negative)`);
  console.log(`Balanced score: ${pct(score.balancedAccuracy)}`);
  console.log(`Raw accuracy:    ${pct(score.rawAccuracy)}`);
  console.log(`Recall:          ${pct(score.recall)} (${score.truePositive}/${score.positives})`);
  console.log(`FPR:             ${pct(score.falsePositiveRate)} (${score.falsePositive}/${score.negatives})`);
  console.log(`Precision:       ${pct(score.precision)}`);

  console.log("\nBy category:");
  for (const row of score.perCategory) {
    console.log(
      `  ${row.category.padEnd(18)} acc ${pct(row.accuracy).padStart(9)} ` +
        `pos ${pct(row.positiveAccuracy).padStart(9)} neg ${pct(row.negativeAccuracy).padStart(9)} ` +
        `n=${row.total}`,
    );
  }

  const misses = results.filter((result) => !result.correct).slice(0, 10);
  if (misses.length) {
    console.log("\nFirst misses:");
    for (const miss of misses) {
      console.log(`  ${miss.id} ${miss.category}: expected ${miss.expectedLabel}, got ${miss.predictedLabel}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
