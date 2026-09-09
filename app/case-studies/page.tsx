import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Database, ShieldCheck, AlertTriangle } from "lucide-react";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Case Studies: Real AI Security Deployments",
  description:
    "SoterAI case studies of real AI security incidents — RAG data leaks, prompt injection, and how runtime guardrails reduced risk for chatbots and agents.",
  path: "/case-studies",
});

const caseStudies = [
  {
    slug: "prompt-injection-leaks-database",
    category: "RAG & Prompt Injection",
    icon: AlertTriangle,
    tag: "Threat Analysis",
    title: "How a Prompt Injection Leaked an Entire Enterprise Database",
    excerpt:
      "A deep dive into how an innocent-looking HR RAG chatbot became a data exfiltration vector, and how SoterAI's Agent Firewall could have prevented it with zero configuration.",
    readTime: "5 min read",
    date: "2026-09-01",
  },
];

export default function CaseStudiesPage() {
  return (
    <main className="container-page py-16 sm:py-24">
      <div className="text-center">
        <p className="eyebrow">Case studies</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Real AI security incidents
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-7 text-slate-200">
          Deployments and incidents where the guard layer made the difference. Each case study
          documents the attack, why standard defenses failed, and the controls that reduced risk.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {caseStudies.map((cs) => {
          const Icon = cs.icon;
          return (
            <Link
              key={cs.slug}
              href={`/case-studies/${cs.slug}`}
              className="card group flex flex-col p-6 transition hover:border-cyan/40"
            >
              <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
                <Icon className="h-4 w-4" aria-hidden="true" />
                {cs.tag}
              </div>
              <h2 className="mt-3 text-xl font-bold leading-snug text-slate-100 group-hover:text-cyan">
                {cs.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{cs.excerpt}</p>
              <div className="mt-auto flex items-center justify-between pt-6 text-xs text-slate-400">
                <span>{cs.readTime}</span>
                <span className="inline-flex items-center gap-1 text-cyan">
                  Read the analysis <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-16 rounded-3xl border border-cyan/20 bg-gradient-to-br from-cyan/5 to-transparent p-8 text-center sm:p-10">
        <Database className="mx-auto h-10 w-10 text-cyan" aria-hidden="true" />
        <h2 className="mt-4 text-2xl font-bold">Have a deployment to share?</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-300">
          If you run SoterAI in production and want to document the risk you retired, we publish
          approved defensive case studies with full customer sign-off.
        </p>
        <Link
          href="/contact-sales"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan px-6 py-3 font-semibold text-white transition hover:bg-cyan-press"
        >
          Contact us <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
