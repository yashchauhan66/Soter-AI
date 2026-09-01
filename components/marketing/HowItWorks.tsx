import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * "How it works" — the four-stage operating model.
 *
 * The previous version rendered four `border-l` columns with no visible
 * connection between them, so the sequence read as four unrelated facts rather
 * than one pipeline. The numbered markers plus the connecting rule make the
 * order explicit, and the rule is hidden below `md` where the cards stack
 * vertically and a horizontal line would point nowhere.
 */
const steps = [
  ["01", "Inspect input", "Evaluate every user message before the model executes it."],
  ["02", "Enforce policy", "Block, redact, rewrite, or route high-risk traffic for review."],
  ["03", "Inspect output", "Check model responses before users or downstream tools see them."],
  ["04", "Operate from evidence", "Use dashboards, logs, webhooks, and reports to tighten controls."],
];

export function HowItWorks() {
  return (
    <section className="section border-y border-slate-800 bg-slate-950/40">
      <div className="container-page">
        <SectionHeading
          center
          eyebrow="Operating model"
          title="Deploy SoterAI where AI risk enters the workflow"
          copy="Four stages, each observable. Nothing runs as a black box you cannot audit after the fact."
        />

        <ol className="relative mt-14 grid gap-8 md:grid-cols-4 md:gap-6">
          {/* Connector. Decorative, sits behind the markers, and is inset so it
              starts and ends inside the first and last marker. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-4 hidden h-px bg-gradient-to-r from-cyan/10 via-cyan/30 to-cyan/10 md:block"
          />

          {steps.map(([number, title, copy]) => (
            <li key={number} className="relative">
              <span
                data-numeric
                className="relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-cyan/30 bg-ink text-xs font-bold text-cyan"
              >
                {number}
              </span>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 leading-7 text-slate-300">{copy}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
