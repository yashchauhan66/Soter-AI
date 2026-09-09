import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, CheckCircle2, Database, Gauge } from "lucide-react";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "AI Security Benchmark Methodology",
  description:
    "How the SoterAI AI security benchmark is measured: the production classifier, dataset, scoring rules, metrics, environment and explicit limitations.",
  path: "/benchmark/methodology",
});

const metrics = [
  { name: "Precision", desc: "Of everything flagged, how much was actually an attack. Controlled by the certainty threshold." },
  { name: "Recall", desc: "Of all attack cases, how many were caught. Reported overall and per-category." },
  { name: "F1", desc: "Harmonic mean of precision and recall — a single score that penalises leaning on either one." },
  { name: "False-positive rate", desc: "Benign inputs incorrectly blocked. This is the hard gate: it is held at ≤5% on every set." },
  { name: "False-negative rate", desc: "Attacks that slipped through. The inverse of recall." },
  { name: "Per-category recall", desc: "Recall split by attack family (jailbreak, exfiltration, tool abuse, RAG poisoning, …)." },
  { name: "Per-language recall", desc: "Recall split by language, including multilingual and Hinglish bypass attempts." },
  { name: "Latency percentiles", desc: "p50 / p95 / p99 for a single decision, measured CPU-only with no network round-trip." },
];

export default function BenchmarkMethodologyPage() {
  return (
    <main className="container-page py-16 sm:py-24">
      <div className="text-center">
        <p className="eyebrow">Benchmark methodology</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          How these numbers are measured
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-7 text-slate-200">
          The benchmark runs the <em>same production classifier</em> the API serves — not a
          research model. Reproduce every number from a clean checkout. Hover between the
          precision-first gate and the honest caveats below before you cite it.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <div className="card p-6">
          <BarChart3 className="text-cyan" size={24} aria-hidden="true" />
          <h2 className="mt-3 text-xl font-bold">Dataset</h2>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            The runner loads every JSONL row from the phase-9 public corpus and evaluates it with
            the production guard detector through <code className="text-cyan">lib/guard/analyze.ts</code>.
            The corpus is synthetic and maintained in-repo; it is <strong>not</strong> an independent
            third-party dataset.
          </p>
        </div>
        <div className="card p-6">
          <Database className="text-cyan" size={24} aria-hidden="true" />
          <h2 className="mt-3 text-xl font-bold">Detection rule</h2>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            An attack counts as <strong>detected</strong> when it receives a protective action other
            than <code className="text-cyan">ALLOW</code>. A <strong>false positive</strong> is counted
            when a benign control receives any protective action. Binary, reproducible, no human judgement
            in the loop.
          </p>
        </div>
        <div className="card p-6">
          <Gauge className="text-cyan" size={24} aria-hidden="true" />
          <h2 className="mt-3 text-xl font-bold">Reported metrics</h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
            {metrics.map((m) => (
              <li key={m.name} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 shrink-0 text-lime" size={14} aria-hidden="true" />
                <span><strong className="text-slate-100">{m.name}</strong> — {m.desc}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card border-amber-300/30 p-6">
          <BarChart3 className="text-amber-300" size={24} aria-hidden="true" />
          <h2 className="mt-3 text-xl font-bold">Environment</h2>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            Node version, OS platform, CPU model and core count, and memory are recorded in the report
            so results are reproducible. Latency is measured locally on CPU with no network call and no
            extra LLM round-trip.
          </p>
        </div>
      </div>

      <div className="mt-12 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-amber-200">Before you cite a number</h2>
        <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-200">
          <li>
            The headline recall is a <strong>regression measure</strong> on corpora the detectors were
            iterated against — not a generalization measure. The published blind held-out recall, which
            no detector has ever been tuned against, is <span className="font-semibold text-amber-200">61.54%</span>.
          </li>
          <li>
            The corpus is <strong>self-maintained and synthetic</strong>. There is no independent third-party
            validation. See the{" "}
            <Link href="/limitations" className="text-cyan underline underline-offset-2">published limitations</Link>{" "}
            for the full honesty policy.
          </li>
          <li>
            <strong>Precision is the hard gate, not recall.</strong> Benign false positives break real users,
            so the false-positive rate is held at ≤5% on every set, tuned or blind.
          </li>
        </ul>
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link href="/benchmark" className="button-primary gap-2">
          See the results <BarChart3 size={16} aria-hidden="true" />
        </Link>
        <Link href="/benchmarks" className="button-secondary gap-2">
          Full benchmark data
        </Link>
      </div>
    </main>
  );
}
