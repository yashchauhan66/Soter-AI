import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runBenchmarkCases } from "../lib/benchmarks";
import { classifyWithGuard, loadExternalDatasets } from "../lib/benchmarks/externalDatasets";
import { generateOwaspAgentic2026Report, generateOwaspLlm2025Report, getComplianceGaps } from "../lib/compliance/owaspMapping";

type PublicBenchmarkSummary = {
  generated_at?: string;
  dataset?: {
    total_cases?: number;
    attack_cases?: number;
    benign_cases?: number;
    independent_third_party?: boolean;
    source_types?: string[];
  };
  metrics?: {
    precision?: number;
    recall?: number;
    f1?: number;
    false_positive_rate?: number;
    false_negative_rate?: number;
    latency_ms?: {
      p50?: number;
      p95?: number;
      p99?: number;
    };
  };
  threshold_passed?: boolean;
};

const REPORT_DATE = new Date().toISOString().slice(0, 10);
const PUBLIC_BENCHMARK_PATH = path.join(process.cwd(), "benchmarks", "results", "latest.json");

function pct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

function wholePct(value: number): string {
  return `${Math.round(value)}%`;
}

function readPublicBenchmark(): PublicBenchmarkSummary | null {
  if (!existsSync(PUBLIC_BENCHMARK_PATH)) return null;
  return JSON.parse(readFileSync(PUBLIC_BENCHMARK_PATH, "utf8")) as PublicBenchmarkSummary;
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function main() {
  const publicBenchmark = readPublicBenchmark();
  const externalReports = [];

  for (const dataset of loadExternalDatasets()) {
    const { metrics, results } = await runBenchmarkCases(dataset.cases, classifyWithGuard);
    externalReports.push({
      dataset: {
        name: dataset.name,
        source: dataset.source,
        attribution: dataset.attribution,
        license: dataset.license,
        isRepresentativeSample: dataset.isRepresentativeSample,
      },
      metrics,
      misses: results.filter((result) => !result.correct).map((result) => ({
        id: result.id,
        expected: result.expectedLabel,
        predicted: result.predictedLabel,
      })),
    });
  }

  const owaspLlm = generateOwaspLlm2025Report();
  const owaspAgentic = generateOwaspAgentic2026Report();
  const externalMeanF1 = mean(externalReports.map((report) => report.metrics.f1));
  const externalFullDataset = externalReports.every((report) => report.dataset.source === "file");
  const externalRepresentativeOnly = externalReports.some((report) => report.dataset.isRepresentativeSample);
  const publicF1 = publicBenchmark?.metrics?.f1 ?? 0;
  const publicThresholdPass = publicBenchmark?.threshold_passed === true ? 100 : 0;

  const internalSecurityScore =
    owaspLlm.overallCoverage * 0.25 +
    owaspAgentic.overallCoverage * 0.25 +
    publicF1 * 100 * 0.25 +
    externalMeanF1 * 100 * 0.15 +
    publicThresholdPass * 0.1;

  const roundedInternalScore = Math.round(internalSecurityScore);
  const claimSafeSecurityScore = externalFullDataset ? roundedInternalScore : Math.min(92, roundedInternalScore);
  const independentValidationConfidence = externalFullDataset ? 90 : 72;
  const status = externalFullDataset ? "FULL_EXTERNAL_DATASET_VALIDATED" : "PARTIAL_REPRESENTATIVE_EXTERNAL_VALIDATION";

  const summary = {
    generatedAt: new Date().toISOString(),
    status,
    securityPercent: {
      claimSafe: claimSafeSecurityScore,
      internalValidated: roundedInternalScore,
      independentValidationConfidence,
      note:
        "Claim-safe score is capped until full third-party JailbreakBench/HarmBench JSONL files are present under datasets/external/.",
    },
    owaspCoverage: {
      llmTop10_2025: owaspLlm.overallCoverage,
      agentic_2026: owaspAgentic.overallCoverage,
      openGapCount: getComplianceGaps().length,
    },
    publicBenchmark: publicBenchmark
      ? {
          generatedAt: publicBenchmark.generated_at,
          totalCases: publicBenchmark.dataset?.total_cases ?? 0,
          attackCases: publicBenchmark.dataset?.attack_cases ?? 0,
          benignCases: publicBenchmark.dataset?.benign_cases ?? 0,
          independentThirdParty: publicBenchmark.dataset?.independent_third_party ?? false,
          precision: publicBenchmark.metrics?.precision ?? 0,
          recall: publicBenchmark.metrics?.recall ?? 0,
          f1: publicBenchmark.metrics?.f1 ?? 0,
          falsePositiveRate: publicBenchmark.metrics?.false_positive_rate ?? 0,
          falseNegativeRate: publicBenchmark.metrics?.false_negative_rate ?? 0,
          p95LatencyMs: publicBenchmark.metrics?.latency_ms?.p95 ?? 0,
          thresholdPassed: publicBenchmark.threshold_passed ?? false,
        }
      : null,
    externalBenchmarks: externalReports.map((report) => ({
      dataset: report.dataset.name,
      source: report.dataset.source,
      representativeSample: report.dataset.isRepresentativeSample,
      cases: report.metrics.total,
      precision: report.metrics.precision,
      recall: report.metrics.recall,
      f1: report.metrics.f1,
      falsePositiveRate: report.metrics.falsePositiveRate,
      falseNegativeRate: report.metrics.falseNegativeRate,
      misses: report.misses,
    })),
    limitations: [
      "No AI security product can honestly guarantee 100% protection.",
      "The public 3,200-case benchmark is self-maintained synthetic data, not an independent audit.",
      "External JailbreakBench/HarmBench validation is partial unless real JSONL corpora are supplied locally.",
      "Security percentage is a readiness score, not a warranty against every future attack.",
    ],
  };

  const lines: string[] = [];
  lines.push(`# Independent Benchmark Validation - ${REPORT_DATE}`);
  lines.push("");
  lines.push("## Executive Verdict");
  lines.push("");
  lines.push(`- Claim-safe security score: **${claimSafeSecurityScore}%**`);
  lines.push(`- Internal validated security score: **${roundedInternalScore}%**`);
  lines.push(`- Independent validation confidence: **${independentValidationConfidence}%**`);
  lines.push(`- Validation status: **${status}**`);
  lines.push("");
  lines.push(
    externalRepresentativeOnly
      ? "The current external run uses representative JailbreakBench/HarmBench-style samples. This is useful validation, but it is not a full independent benchmark claim."
      : "The current external run used full local third-party dataset files from `datasets/external/`.",
  );
  lines.push("");
  lines.push("## Score Formula");
  lines.push("");
  lines.push("| Signal | Weight | Result |");
  lines.push("| --- | ---: | ---: |");
  lines.push(`| OWASP LLM Top 10 2025 coverage | 25% | ${owaspLlm.overallCoverage}% |`);
  lines.push(`| OWASP Agentic 2026 coverage | 25% | ${owaspAgentic.overallCoverage}% |`);
  lines.push(`| Public synthetic benchmark F1 | 25% | ${pct(publicF1)} |`);
  lines.push(`| External benchmark mean F1 | 15% | ${pct(externalMeanF1)} |`);
  lines.push(`| Public benchmark threshold gate | 10% | ${publicThresholdPass}% |`);
  lines.push("");
  lines.push("## Benchmark Results");
  lines.push("");
  lines.push("| Benchmark | Source | Cases | Precision | Recall | F1 | FP Rate | FN Rate |");
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  if (publicBenchmark) {
    lines.push(
      `| SoterAI public benchmark | self-maintained synthetic | ${publicBenchmark.dataset?.total_cases ?? 0} | ${pct(
        publicBenchmark.metrics?.precision ?? 0,
      )} | ${pct(publicBenchmark.metrics?.recall ?? 0)} | ${(publicBenchmark.metrics?.f1 ?? 0).toFixed(4)} | ${pct(
        publicBenchmark.metrics?.false_positive_rate ?? 0,
      )} | ${pct(publicBenchmark.metrics?.false_negative_rate ?? 0)} |`,
    );
  }
  for (const report of externalReports) {
    lines.push(
      `| ${report.dataset.name} | ${
        report.dataset.source === "file" ? "full local third-party file" : "representative sample"
      } | ${report.metrics.total} | ${pct(report.metrics.precision)} | ${pct(report.metrics.recall)} | ${report.metrics.f1.toFixed(
        4,
      )} | ${pct(report.metrics.falsePositiveRate)} | ${pct(report.metrics.falseNegativeRate)} |`,
    );
  }
  lines.push("");
  lines.push("## Security Percentage");
  lines.push("");
  lines.push(`- **${claimSafeSecurityScore}%** is the public claim-safe score today.`);
  lines.push(`- **${roundedInternalScore}%** is the internal readiness score from benchmarks and framework coverage.`);
  lines.push(
    `- **100% security is not claimed**, even when a benchmark shows 100% detection, because unknown future attacks and deployment mistakes remain possible.`,
  );
  lines.push("");
  lines.push("## Remaining Gaps");
  lines.push("");
  for (const gap of getComplianceGaps()) {
    lines.push(`- ${gap.framework} ${gap.id} ${gap.name}: ${gap.gaps.join("; ")}`);
  }
  lines.push("");
  lines.push("## How To Upgrade To Full Independent Validation");
  lines.push("");
  lines.push("1. Place authorized full corpora at `datasets/external/jailbreakbench.jsonl` and `datasets/external/harmbench.jsonl`.");
  lines.push("2. Run `npm run benchmark:independent`.");
  lines.push("3. Publish the JSON report plus test command output with dataset version, license, and limitations.");

  const reportDir = path.join(process.cwd(), "reports");
  mkdirSync(reportDir, { recursive: true });
  const mdPath = path.join(reportDir, `INDEPENDENT-BENCHMARK-VALIDATION-${REPORT_DATE}.md`);
  const jsonPath = path.join(reportDir, "independent-benchmark-validation.json");
  writeFileSync(mdPath, lines.join("\n"), "utf8");
  writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(`Claim-safe security score: ${wholePct(claimSafeSecurityScore)}`);
  console.log(`Internal validated security score: ${wholePct(roundedInternalScore)}`);
  console.log(`Independent validation confidence: ${wholePct(independentValidationConfidence)}`);
  console.log(`Report written: ${path.relative(process.cwd(), mdPath)}`);
  console.log(`JSON written: ${path.relative(process.cwd(), jsonPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
