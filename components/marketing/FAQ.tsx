const faqs = [
  ["Does SoterAI guarantee complete security?", "No. SoterAI is a defense-in-depth risk reduction layer. It should be combined with secure application design, identity controls, monitoring, and human review."],
  ["What does it protect?", "SoterAI inspects AI inputs and outputs for prompt injection, jailbreaks, sensitive data, unsafe responses, and risky agent behavior."],
  ["Can I self-host it?", "Yes. The production stack can run with Docker, Postgres, Redis, and optional vector storage, so teams can keep control of deployment and data boundaries."],
  ["Are raw secrets stored?", "No. Secret-bearing and sensitive payloads are persisted only in redacted or hashed form where practical."],
];

export function FAQ() {
  return (
    <section className="border-t border-slate-800 bg-slate-950/35 py-20">
      <div className="container-page">
        <p className="eyebrow">Questions</p>
        <h2 className="mt-3 text-3xl font-bold">Built for serious AI security work</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {faqs.map(([q, a]) => (
            <article className="card p-6" key={q}>
              <h3 className="font-semibold">{q}</h3>
              <p className="mt-3 leading-7 text-slate-400">{a}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}