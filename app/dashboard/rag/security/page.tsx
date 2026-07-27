import { runRagPoisoningBenchmark } from "@/lib/rag/benchmarks/poisoning";
import { FeatureGuide } from "@/components/docs/FeatureGuide";

export const dynamic = "force-dynamic";

export default function RagSecurityPage() {
  const benchmark = runRagPoisoningBenchmark();
  return (
    <div>
      <FeatureGuide
        eyebrow="RAG security - Preview"
        title="Advanced retrieval attack simulation"
        description="Preview simulation for indirect prompt injection, private chunk leakage, citation spoofing, retrieval manipulation, low-trust sources, and no-source high-risk answers. It is defensive regression coverage, not proof of complete RAG protection."
        useCase="Retrieval-augmented generation pulls untrusted documents into a model's context, which opens a wide attack surface: a poisoned chunk can smuggle instructions to the model, a private chunk can leak into an answer, or a fabricated citation can make a wrong answer look sourced. This simulation runs a benchmark of those attack classes against the detection logic so you can see, case by case, which retrieval attacks the current rules catch and which they miss before you rely on them."
        howItWorks={[
          { heading: "Curated attack corpus", body: "The benchmark bundles labelled cases across indirect prompt injection, private chunk leakage, citation spoofing, retrieval manipulation, low-trust sources, and no-source high-risk answers." },
          { heading: "Run detection over each case", body: "Every case is passed through the RAG detection logic and scored as detected or missed, giving a concrete count rather than a marketing claim." },
          { heading: "Read the detected vs total ratio", body: "The tiles below show total cases and how many were detected. Treat the gap as your current blind spots, not as proof of coverage." },
          { heading: "Guard regressions over time", body: "Because it runs deterministically, the same benchmark doubles as a regression check — if a detection change lowers the detected count, you see it here." },
        ]}
        callout="Preview and simulation only. This page runs a benchmark against detection logic; it is defensive regression coverage, not real-time enforcement and not proof of complete RAG protection. It does not block, redact, or intercept live retrieval traffic."
      />
      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        <section className="card p-5"><p className="text-sm text-slate-400">Benchmark cases</p><p className="mt-2 text-2xl font-bold">{benchmark.total}</p></section>
        <section className="card p-5"><p className="text-sm text-slate-400">Detected</p><p className="mt-2 text-2xl font-bold">{benchmark.detected}</p></section>
        <section className="card p-5"><p className="text-sm text-slate-400">Mode</p><p className="mt-2 text-2xl font-bold">Simulation</p></section>
      </div>
    </div>
  );
}
