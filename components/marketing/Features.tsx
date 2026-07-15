import Link from "next/link";
import { ArrowRight, Ban, DatabaseZap, FileSearch, Fingerprint, Gauge, ScanText, ShieldAlert, Users, Eye, Scale, Lock } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { productStatus, roleMessaging } from "@/lib/marketing/launchStatus";

const productFeatures = [
  {
    group: "AI Agent Control",
    accent: "border-orange-500/20 bg-orange-500/5",
    iconAccent: "border-orange-500/30 bg-orange-500/10 text-orange-300",
    items: [
      [ShieldAlert, "Agent firewall", "Authorize or block tool calls such as email sends, database writes, and payment actions before execution."],
      [Gauge, "Approval and rollback", "Hold risky actions for human review and preserve a full audit trail."],
      [Lock, "Agent identity", "Signed agent passports with capability-based authorization and delegation chains."],
    ],
  },
  {
    group: "AI Usage Governance",
    accent: "border-violet-500/20 bg-violet-500/5",
    iconAccent: "border-violet-500/30 bg-violet-500/10 text-violet-300",
    items: [
      [Users, "Department policies", "Apply different AI rules for engineering, marketing, finance, HR, and admin workflows."],
      [Eye, "Employee DLP", "Detect when company data, customer records, or credentials are pasted into AI tools and block or alert."],
      [Scale, "Audit evidence", "Track who used which AI surface, when, and which data classes were detected without storing raw secrets."],
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
        <SectionHeading
          eyebrow="Focused product"
          title="Protect company data before it reaches external AI"
          copy="SoterAI focuses on local-first AI usage and AI-agent control for teams using ChatGPT, Claude, Gemini, Cursor, VS Code, n8n, and internal AI apps."
        />

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {productStatus.map((product) => (
            <article key={product.name} className="card flex flex-col p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{product.name}</h3>
                <span className="rounded-md border border-cyan/30 bg-cyan/10 px-2 py-0.5 text-xs font-semibold text-cyan">{product.status}</span>
              </div>
              <p className="mt-3 flex-1 text-sm leading-6 text-slate-400">{product.copy}</p>
              <Link href={product.href} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan">
                {product.cta} <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-5">
          {roleMessaging.map((item) => (
            <article key={item.role} className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
              <h3 className="text-sm font-semibold text-slate-100">{item.role}</h3>
              <p className="mt-2 text-xs leading-5 text-slate-400">{item.copy}</p>
            </article>
          ))}
        </div>

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
