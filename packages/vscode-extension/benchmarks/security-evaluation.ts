import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

import { DecisionEngine } from "../../guard-core/src/DecisionEngine";
import { SECURITY_CORPUS } from "./security-corpus";

const extensionRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(extensionRoot, "benchmark-results");
const corpusHash = createHash("sha256")
    .update(JSON.stringify(SECURITY_CORPUS))
    .digest("hex");

async function main(): Promise<void> {
const engine = new DecisionEngine();
const outcomes: Array<{
    id: string;
    category: string;
    context: string;
    expectedRisky: boolean;
    detectedRisky: boolean;
    decision: string;
    riskScore: number;
    findingCategories: string[];
    latencyMs: number;
}> = [];

for (const item of SECURITY_CORPUS) {
    const started = performance.now();
    const result = await engine.scan(item.text, { context: item.context, skipCache: true });
    const latencyMs = performance.now() - started;
    outcomes.push({
        id: item.id,
        category: item.category,
        context: item.context,
        expectedRisky: item.risky,
        detectedRisky: result.findings.length > 0,
        decision: result.decision,
        riskScore: result.riskScore,
        findingCategories: result.categories,
        latencyMs: Number(latencyMs.toFixed(3)),
    });
}

const tp = outcomes.filter((r) => r.expectedRisky && r.detectedRisky).length;
const fn = outcomes.filter((r) => r.expectedRisky && !r.detectedRisky).length;
const tn = outcomes.filter((r) => !r.expectedRisky && !r.detectedRisky).length;
const fp = outcomes.filter((r) => !r.expectedRisky && r.detectedRisky).length;
const recall = tp / Math.max(1, tp + fn);
const precision = tp / Math.max(1, tp + fp);
const falsePositiveRate = fp / Math.max(1, fp + tn);
const latencies = outcomes.map((r) => r.latencyMs).sort((a, b) => a - b);
const percentile = (p: number) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))];
const categories = [...new Set(SECURITY_CORPUS.filter((c) => c.risky).map((c) => c.category))].sort();
const perCategory = Object.fromEntries(categories.map((category) => {
    const rows = outcomes.filter((r) => r.category === category && r.expectedRisky);
    return [category, {
        cases: rows.length,
        detected: rows.filter((r) => r.detectedRisky).length,
        recall: rows.filter((r) => r.detectedRisky).length / rows.length,
    }];
}));

const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    scope: "SoterAI IDE Guard packaged deterministic DecisionEngine; self-maintained regression corpus",
    independence: "NOT INDEPENDENT — cases and implementation are maintained in the same repository",
    limitations: [
        "Small readable corpus; not representative of all real-world code or attacks",
        "Measures detection only, not universal interception or prevention",
        "No competitor products are executed or compared",
        "Synthetic credentials only",
    ],
    corpus: { sha256: corpusHash, total: outcomes.length, risky: tp + fn, benign: tn + fp },
    confusionMatrix: { truePositives: tp, falseNegatives: fn, trueNegatives: tn, falsePositives: fp },
    metrics: { recall, precision, falsePositiveRate, latencyP50Ms: percentile(0.5), latencyP95Ms: percentile(0.95) },
    perCategory,
    failures: outcomes.filter((r) => r.expectedRisky !== r.detectedRisky),
    outcomes,
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, "security-evaluation.json"), JSON.stringify(report, null, 2) + "\n");
const percent = (value: number) => `${(value * 100).toFixed(2)}%`;
const markdown = [
    "# SoterAI IDE Guard security evaluation",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `> ${report.independence}`,
    "",
    `Corpus SHA-256: \`${corpusHash}\``,
    "",
    "| Metric | Result |",
    "| --- | ---: |",
    `| Cases | ${outcomes.length} (${tp + fn} risky / ${tn + fp} benign) |`,
    `| Recall | ${percent(recall)} |`,
    `| Precision | ${percent(precision)} |`,
    `| False-positive rate | ${percent(falsePositiveRate)} |`,
    `| Latency p50 | ${percentile(0.5).toFixed(3)} ms |`,
    `| Latency p95 | ${percentile(0.95).toFixed(3)} ms |`,
    "",
    "## Per-category recall",
    "",
    "| Category | Detected | Recall |",
    "| --- | ---: | ---: |",
    ...Object.entries(perCategory).map(([name, value]) => `| ${name} | ${value.detected}/${value.cases} | ${percent(value.recall)} |`),
    "",
    "## Misclassified cases",
    "",
    ...(report.failures.length ? report.failures.map((failure) => `- \`${failure.id}\`: expected ${failure.expectedRisky ? "risky" : "benign"}, detected ${failure.detectedRisky ? "risky" : "benign"}`) : ["None in this corpus."]),
    "",
    "## Limitations",
    "",
    ...report.limitations.map((item) => `- ${item}`),
    "",
].join("\n");
writeFileSync(join(outputDir, "security-evaluation.md"), markdown);

console.log(`Security evaluation: ${outcomes.length} cases, recall ${percent(recall)}, FPR ${percent(falsePositiveRate)}, p95 ${percentile(0.95).toFixed(3)} ms`);
console.log(`Evidence: ${join(outputDir, "security-evaluation.json")}`);
if (fn > 0 || fp > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
    console.error(`Security evaluation failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
});