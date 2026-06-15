export default function BenchmarksPage() {
  return (
    <main className="container-page py-16">
      <p className="eyebrow">Benchmarks - Internal Preview</p>
      <h1 className="mt-2 text-4xl font-bold">Internal detection evaluation preview</h1>
      <p className="mt-4 max-w-3xl text-slate-400">Internal Preview only. Published results must include dataset version, language mix, detector version, thresholds, sample size, and known limitations. Internal customer examples are never published.</p>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {[["Precision", "Measures how often flagged examples were expected to be risky."], ["Recall", "Measures how many expected risky examples were detected."], ["Latency", "Tracks p50, p95, and p99 detector response time."]].map(([title, copy]) => (
          <section className="card p-5" key={title}>
            <h2 className="font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-slate-400">{copy}</p>
          </section>
        ))}
      </div>
      <section className="mt-10 border-t border-slate-800 pt-7">
        <h2 className="text-xl font-semibold">Current publication status</h2>
        <p className="mt-3 text-slate-400">No externally audited benchmark is claimed yet. Public snapshots must be marked as internal benchmarks, include dataset size and limitations, and hide sensitive examples.</p>
      </section>
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Phase 11 benchmark categories</h2>
        <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-300">
          {["Prompt injection", "Jailbreak", "System prompt leakage", "PII leakage", "Secret leakage", "Unsafe output", "RAG poisoning", "Private document leakage", "Tool-call misuse", "Cost abuse", "Hindi/Hinglish", "Multilingual"].map((item) => (
            <span className="rounded border border-slate-700 px-3 py-2" key={item}>{item}</span>
          ))}
        </div>
      </section>
    </main>
  );
}
