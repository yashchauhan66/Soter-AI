import { SectionHeading } from "@/components/ui/SectionHeading";

const steps = [
  ["01", "Inspect input", "Evaluate every user message before model execution."],
  ["02", "Enforce policy", "Block, redact, rewrite, or route high-risk traffic for review."],
  ["03", "Inspect output", "Check model responses before users or downstream tools see them."],
  ["04", "Operate from evidence", "Use dashboards, logs, webhooks, and reports to improve controls."],
];

export function HowItWorks() {
  return (
    <section className="border-y border-slate-800 bg-slate-950/40 py-24">
      <div className="container-page">
        <SectionHeading center eyebrow="Operating model" title="Deploy SoterAI where AI risk enters the workflow" />
        <div className="mt-14 grid gap-6 md:grid-cols-4">
          {steps.map(([n, t, c]) => (
            <div className="border-l border-slate-800 pl-5" key={n}>
              <span className="text-sm font-bold text-cyan">{n}</span>
              <h3 className="mt-4 text-lg font-semibold">{t}</h3>
              <p className="mt-2 leading-7 text-slate-400">{c}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}