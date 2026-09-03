import { Ban, DatabaseZap, FileSearch, Fingerprint, Gauge, ScanText } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * Detection and control — the six cross-cutting capabilities.
 *
 * ## What this file used to be
 *
 * Four stacked grids in one section: eight product-status cards, five role cards,
 * two bordered panels holding three cards each, and then these six behind a
 * `<details>` toggle. Twenty-five cards under a single heading — and the six that
 * actually describe what the product *detects* were the only ones a reader had to
 * click to see.
 *
 * Each of the other three grids duplicated a section that still exists:
 *
 * - The product-status cards are the canonical surface list. They now render once,
 *   in `Surfaces.tsx`, straight after the hero where an evaluator looks for "can I
 *   install this".
 * - The two bordered panels were titled "AI Agent Control" and "AI Usage
 *   Governance" — the same two headings as `TwoProducts.tsx` directly above it,
 *   whose feature chips already name every item they listed.
 * - The five role cards ("For Developers", "For Security Teams", …) sat at
 *   `xl:grid-cols-5`, which gives each about 140px for a two-line sentence at
 *   `text-xs`. Audience segmentation is worth having; it is not worth having at a
 *   size nobody reads. The copy stays in `lib/marketing/launchStatus.ts` for a page
 *   that can give it room.
 *
 * So the toggle is gone and these six are the section — the answer to the only
 * question this part of the page should be answering.
 */
const capabilities = [
  [Ban, "Prompt attack defense", "Detect instruction overrides, jailbreak personas, prompt extraction, and tool-abuse attempts before they reach the model."],
  [Fingerprint, "Sensitive data control", "Redact PII, India-specific identifiers, credentials, tokens, and database URLs without storing raw secret values."],
  [DatabaseZap, "RAG and memory safety", "Inspect retrieved context, document trust, and memory records so private data does not quietly move into unsafe outputs."],
  [ScanText, "Output inspection", "Check model responses for leaked instructions, unsafe claims, sensitive data, suspicious links, and policy violations."],
  [Gauge, "Explainable decisions", "Convert findings into risk scores and actions: allow, redact, rewrite, human review, or block."],
  [FileSearch, "Evidence and reporting", "Track decisions, redactions, blocked requests, usage, webhooks, and monthly security summaries for operations teams."],
] as const;

export function Features() {
  return (
    <section id="features" className="section border-y border-slate-800 bg-slate-950/40">
      <div className="container-page">
        <SectionHeading
          center
          eyebrow="Detection and control"
          title="What SoterAI inspects on every AI turn"
          copy="Six controls run on the same request path, in both directions — before a prompt reaches the model, and before a response reaches a user, a tool, or another agent."
        />

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {capabilities.map(([Icon, title, copy]) => (
            <article key={title} className="card p-6">
              {/* Neutral icon chip. These were `border-cyan/20 bg-cyan/10 text-cyan`,
                  which put the accent on all six icons at once — so the accent
                  marked "this is an icon" rather than "this is the action". */}
              <span className="inline-flex rounded-md border border-slate-700/60 bg-slate-900/60 p-2.5 text-slate-400">
                <Icon aria-hidden="true" size={19} />
              </span>
              <h3 className="mt-4 text-base font-semibold text-slate-100">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
