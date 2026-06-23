import { Ban, DatabaseZap, FileSearch, Fingerprint, Gauge, ScanText } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";

const features = [
  [Ban, "Prompt attack defense", "Detect instruction overrides, jailbreak personas, prompt extraction, and tool-abuse attempts before they reach the model."],
  [Fingerprint, "Sensitive data control", "Redact PII, India-specific identifiers, credentials, tokens, and database URLs without storing raw secret values."],
  [DatabaseZap, "RAG and memory safety", "Inspect retrieved context, document trust, and memory records so private data does not quietly move into unsafe outputs."],
  [ScanText, "Output inspection", "Check model responses for leaked instructions, unsafe claims, sensitive data, suspicious links, and policy violations."],
  [Gauge, "Explainable decisions", "Convert findings into risk scores and actions: allow, redact, rewrite, human review, or block."],
  [FileSearch, "Evidence and reporting", "Track decisions, redactions, blocked requests, usage, webhooks, and monthly security summaries for operations teams."],
];

export function Features() {
  return (
    <section id="features" className="py-24">
      <div className="container-page">
        <SectionHeading eyebrow="Defense in depth" title="Security controls around every AI turn" copy="SoterAI sits between users, models, retrieval systems, and agents, turning risky behavior into explainable decisions." />
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map(([Icon, title, copy]) => {
            const FeatureIcon = Icon as typeof Ban;
            return (
              <article key={String(title)} className="card p-6">
                <span className="inline-flex rounded-md border border-cyan/20 bg-cyan/10 p-3 text-cyan"><FeatureIcon aria-hidden="true" /></span>
                <h3 className="mt-5 text-xl font-semibold">{String(title)}</h3>
                <p className="mt-3 leading-7 text-slate-400">{String(copy)}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}