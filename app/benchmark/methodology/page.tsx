import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Benchmark Methodology | SoterAI",
  alternates: { canonical: "/benchmark/methodology" },
};

function loadMethodology() {
  try {
    return readFileSync(join(process.cwd(), "benchmarks/soterai-public-benchmark/methodology.md"), "utf8");
  } catch {
    return "Benchmark methodology is not available. Run the Phase 9 dataset generator.";
  }
}

export default function BenchmarkMethodologyPage() {
  return (
    <main className="container-page py-16">
      <p className="eyebrow">Benchmark</p>
      <h1 className="mt-3 text-4xl font-bold">Methodology</h1>
      <pre className="mt-8 whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 p-5 text-sm leading-6 text-slate-300">
        {loadMethodology()}
      </pre>
    </main>
  );
}
