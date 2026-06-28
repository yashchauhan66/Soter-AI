import { Ban, DatabaseZap, FileSearch, Fingerprint, Gauge, ScanText, ShieldAlert, Users, Eye, Scale, Lock } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";

const productFeatures = [
  {
    group: "AI Agent Control",
    accent: "border-orange-500/20 bg-orange-500/5",
    iconAccent: "border-orange-500/30 bg-orange-500/10 text-orange-300",
    items: [
      [ShieldAlert, "Agent firewall", "Authorize or block every tool call — email sends, database writes, payment actions — before execution."],
      [Gauge, "Approval & rollback", "Hold risky actions for human review. Stage compensating actions for safe rollback with full audit trail."],
      [Lock, "Agent identity", "Cryptographically signed agent passports with capability-based authorization and delegation chains."],
    ],
  },
  {
    group: "AI Usage Governance",
    accent: "border-violet-500/20 bg-violet-500/5",
    iconAccent: "border-violet-500/30 bg-violet-500/10 text-violet-300",
    items: [
      [Users, "Department policies", "Different AI rules for engineering, marketing, finance, and HR. Block ChatGPT for finance, allow Claude for engineering."],
      [Eye, "Employee DLP", "Detect when employees paste company data, customer records, or credentials into AI tools and block or alert."],
      [Scale, "Legal accountability", "Complete audit trail with compliance reports. Know who used which AI tool, when, and with what data."],
    ],
  },
];

const coreFeatures = [
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

        {/* Product-specific feature rows */}
        <div className="mt-12 space-y-6">
          {productFeatures.map((group) => (
            <div key={group.group} className={`rounded-2xl border p-6 ${group.accent}`}>
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">{group.group}</h3>
              <div className="grid gap-5 md:grid-cols-3">
                {group.items.map(([Icon, title, copy]) => {
                  const FeatureIcon = Icon as typeof Ban;
                  return (
                    <article key={String(title)} className="card p-5">
                      <span className={`inline-flex rounded-md border p-2.5 ${group.iconAccent}`}>
                        <FeatureIcon aria-hidden="true" size={20} />
                      </span>
                      <h4 className="mt-4 text-lg font-semibold">{String(title)}</h4>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{String(copy)}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Core guardrail features */}
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {coreFeatures.map(([Icon, title, copy]) => {
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
