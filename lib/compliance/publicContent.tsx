import Link from "next/link";
import { ShieldCheck, ArrowRight } from "lucide-react";

export const trustPrinciples = [
  "OWASP LLM Top 10 aligned controls for prompt injection, sensitive data exposure, insecure output handling, and RAG risks.",
  "Defense-in-depth through detection, blocking, redaction, monitoring, reporting, and human review workflows.",
  "Risk reduction language only: SoterAI does not claim complete protection or certification.",
];

export const owaspMappings = [
  ["LLM01 Prompt Injection", "Input/output guardrails, document scanning, red-team regression tests, and policy enforcement."],
  ["LLM02 Sensitive Information Disclosure", "PII and secret redaction, safe logs, webhook payload minimization, and audit exports."],
  ["LLM03 Supply Chain", "Self-hosted deployment guidance, dependency audit checks, and vendor-risk documentation."],
  ["LLM04 Data and Model Poisoning", "RAG quarantine, trust scoring, approved-source indexing, and feedback review."],
  ["LLM05 Improper Output Handling", "Unsafe output detection, rewrite/block decisions, and downstream webhook safety."],
  ["LLM06 Excessive Agency", "Policy controls, authorized red-team scope, and integration payload redaction."],
  ["LLM07 System Prompt Leakage", "System prompt leak detection and persistence safeguards."],
  ["LLM08 Vector and Embedding Weaknesses", "Tenant namespaces, ACL post-filtering, and retrieval audit logs."],
  ["LLM09 Misinformation", "Grounding guard, citation checks, and no-source fallback."],
  ["LLM10 Unbounded Consumption", "Rate limiting, quotas, billing controls, and admin overrides."],
];

export function ReadinessPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main>
      {/* Futuristic trust-center header, shared by all readiness pages. */}
      <section className="relative overflow-hidden border-b border-slate-800 bg-[radial-gradient(ellipse_at_top,rgba(49,215,200,0.1),transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.6),rgba(2,6,23,0))] py-14">
        <div className="pointer-events-none absolute inset-0 -z-10 grid-fade-anim opacity-40" />
        <div className="pointer-events-none absolute -right-32 -top-32 -z-10 h-[380px] w-[380px] rounded-full bg-cyan/10 blur-[110px]" />
        <div className="container-page">
          <Link
            href="/trust"
            className="inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1 text-xs font-semibold text-cyan transition hover:bg-cyan/20"
          >
            <ShieldCheck size={14} aria-hidden="true" />
            Trust Center
          </Link>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
            <span className="bg-gradient-to-r from-cyan to-lime bg-clip-text text-transparent">{title}</span>
          </h1>
        </div>
      </section>

      <div className="container-page py-14">
        <div className="card max-w-4xl space-y-5 p-7 leading-7 text-slate-300 sm:p-9">{children}</div>
        <div className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span>Part of the SoterAI Trust Center.</span>
          <Link
            href="/trust"
            className="inline-flex items-center gap-1 font-semibold text-cyan hover:text-cyan/80"
          >
            Back to overview <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </main>
  );
}
