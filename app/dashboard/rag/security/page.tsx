import { runRagPoisoningBenchmark } from "@/lib/rag/benchmarks/poisoning";

export const dynamic = "force-dynamic";

export default function RagSecurityPage() {
  const benchmark = runRagPoisoningBenchmark();
  return (
    <div>
      <p className="eyebrow">RAG security - Preview</p>
      <h1 className="mt-2 text-3xl font-bold">Advanced retrieval attack simulation</h1>
      <p className="mt-3 max-w-3xl text-slate-400">Preview simulation for indirect prompt injection, private chunk leakage, citation spoofing, retrieval manipulation, low-trust sources, and no-source high-risk answers. It is defensive regression coverage, not proof of complete RAG protection.</p>
      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        <section className="card p-5"><p className="text-sm text-slate-400">Benchmark cases</p><p className="mt-2 text-2xl font-bold">{benchmark.total}</p></section>
        <section className="card p-5"><p className="text-sm text-slate-400">Detected</p><p className="mt-2 text-2xl font-bold">{benchmark.detected}</p></section>
        <section className="card p-5"><p className="text-sm text-slate-400">Mode</p><p className="mt-2 text-2xl font-bold">Simulation</p></section>
      </div>
    </div>
  );
}
