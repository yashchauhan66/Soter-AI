import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, FileCheck2, Scale, ShieldCheck } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { owaspMappings } from "@/lib/compliance/publicContent";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbList } from "@/lib/seo/schema";

/**
 * Compliance hub.
 *
 * `/compliance` had subroutes (`owasp-llm-top-10`, `soc2-readiness`,
 * `iso27001-readiness`) but no index, so the directory URL returned a 404 —
 * while `scripts/real-user-test-all-services.mjs` and the site navigation both
 * pointed at it. A hub page fixes the dead end and gives the three readiness
 * pages a shared parent for breadcrumbs and internal linking.
 */

export const metadata: Metadata = buildMetadata({
  title: "AI Compliance Mapping: OWASP LLM Top 10, SOC 2 and ISO 27001 Readiness",
  description:
    "See how SoterAI controls map to OWASP LLM Top 10 risk categories, and review the honest state of SOC 2 and ISO 27001 readiness. Alignment guidance, not certification.",
  path: "/compliance",
  keywords: [
    "AI compliance",
    "OWASP LLM Top 10 mapping",
    "LLM security compliance",
    "SOC 2 readiness AI",
    "ISO 27001 readiness AI",
    "AI governance controls",
  ],
});

const frameworks = [
  {
    href: "/compliance/owasp-llm-top-10",
    icon: BadgeCheck,
    title: "OWASP LLM Top 10",
    copy: "Per-risk mapping from LLM01 prompt injection through LLM10 unbounded consumption, with the specific control that addresses each one.",
    state: "Mapped",
  },
  {
    href: "/compliance/soc2-readiness",
    icon: FileCheck2,
    title: "SOC 2 readiness",
    copy: "Which Trust Services criteria the platform is built toward, and what remains outstanding before an audit opinion could exist.",
    state: "Readiness only",
  },
  {
    href: "/compliance/iso27001-readiness",
    icon: Scale,
    title: "ISO 27001 readiness",
    copy: "Information-security management practices in place today, stated separately from certification status.",
    state: "Readiness only",
  },
];

export default function CompliancePage() {
  return (
    <main>
      <JsonLd
        data={breadcrumbList([
          { name: "Home", path: "/" },
          { name: "Compliance", path: "/compliance" },
        ])}
      />

      <section className="relative overflow-hidden border-b border-slate-800 py-16">
        <div className="pointer-events-none absolute inset-0 -z-10 grid-fade mask-radial-fade opacity-40" />
        <div className="container-page">
          <Link href="/trust" className="badge-brand">
            <ShieldCheck size={14} aria-hidden="true" />
            Trust Center
          </Link>
          <h1 className="heading-1 mt-5">
            <span className="text-gradient-brand">Compliance mapping</span>
          </h1>
          <p className="lede mt-5">
            SoterAI maps its controls to recognised AI and information-security frameworks so security reviewers can
            evaluate coverage quickly. These pages describe alignment and readiness. They are not certifications, and no
            external audit opinion is claimed on any page that does not link to a report.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container-page">
          <div className="grid gap-5 md:grid-cols-3">
            {frameworks.map((framework) => (
              <Link
                key={framework.href}
                href={framework.href}
                className="card card-interactive group flex flex-col p-6"
              >
                <span className="inline-flex w-fit rounded-lg border border-cyan/20 bg-cyan/10 p-2.5 text-cyan">
                  <framework.icon size={20} aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-lg font-semibold">{framework.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-300">{framework.copy}</p>
                <span className="badge-neutral mt-4 w-fit">{framework.state}</span>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan">
                  Read the mapping
                  <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>

          <div className="warn-card mt-8 max-w-3xl">
            <strong className="font-semibold">What these pages do not say.</strong> No page here claims SOC 2
            certification, ISO 27001 certification, or completed third-party penetration testing. Where independent
            evidence does not exist yet, it is labelled as outstanding rather than omitted.
          </div>
        </div>
      </section>

      <section className="section-tight border-t border-slate-800 bg-slate-950/40">
        <div className="container-page">
          <h2 className="heading-3">OWASP LLM Top 10 at a glance</h2>
          <p className="body-copy mt-3">
            The full mapping, including the control behind each row, is on the{" "}
            <Link href="/compliance/owasp-llm-top-10" className="font-semibold text-cyan hover:underline">
              OWASP LLM Top 10 page
            </Link>
            .
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {owaspMappings.map(([risk, control]) => (
              <div key={risk} className="surface p-4">
                <h3 className="text-sm font-semibold text-slate-100">{risk}</h3>
                <p className="mt-1.5 text-sm leading-6 text-slate-300">{control}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
