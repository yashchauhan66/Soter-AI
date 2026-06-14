export default function PricingPage() {
  return (
    <main className="container-page py-16">
      <p className="eyebrow">Pricing</p>
      <h1 className="mt-2 text-4xl font-bold">Plans for AI security teams</h1>
      <section className="mt-8 grid gap-5 md:grid-cols-3">
        {["Starter", "Pro", "Enterprise"].map((plan) => (
          <div className="card p-5" key={plan}>
            <h2 className="text-xl font-semibold">{plan}</h2>
            <p className="mt-3 text-sm text-slate-400">OWASP LLM Top 10 aligned risk reduction with guard APIs, dashboards, reports, and defensive monitoring.</p>
          </div>
        ))}
      </section>
    </main>
  );
}
