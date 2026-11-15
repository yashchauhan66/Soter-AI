import Link from "next/link";
import { Activity, ArrowUpRight, Mail } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { FooterNavGroup } from "@/components/layout/FooterNavGroup";
import { FOOTER_NAV, LEGAL_NAV } from "@/lib/navigation";

/**
 * Server-rendered footer: navigation data and link markup stay on the server.
 * A small client wrapper enhances native disclosures on mobile; all links are
 * present and usable in the first HTML response, including without JavaScript.
 *
 * Link data comes from `lib/navigation.ts`, so the header, the mobile drawer and
 * this footer cannot disagree about what the site contains.
 *
 * The status indicator links to /status instead of asserting a state. A hard-coded
 * "All systems operational" badge would have kept saying "operational" through the
 * 2026-08-21 outage.
 *
 * The honest-claims line stays in the footer so the disclaimer travels with every
 * page that makes a claim, and it links to the pages that hold the detail.
 *
 * The support link keeps its aria-label ("Email SoterAI support"): an e2e test
 * relies on it to tell it apart from the sign-in form's own email field.
 */
export function SiteFooter({ currentYear }: { currentYear: number }) {
  return (
    <footer className="border-t border-slate-800 bg-slate-900 text-sm text-slate-300">
      <div className="container-page py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,19rem)_1fr]">
          <div>
            <Link href="/" aria-label="SoterAI home" className="inline-flex items-center">
              <Logo size={28} />
            </Link>

            <p className="mt-4 max-w-xs font-display text-lg leading-snug text-slate-100">
              Decide what your AI can see, say and do.
            </p>
            <p className="mt-2 max-w-xs leading-6 text-slate-400">
              The AI security command layer. It checks prompts and replies, redacts secrets and personal data, and holds
              risky agent actions for approval.
            </p>

            <Link
              href="/status"
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-white px-3 py-1.5 font-mono text-xs font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:text-slate-100"
            >
              <Activity size={13} aria-hidden="true" />
              System status
              <ArrowUpRight size={12} aria-hidden="true" />
            </Link>

            <div className="mt-5 flex items-center gap-3">
              <a href="mailto:support@soterai.in" aria-label="Email SoterAI support" className="button-icon">
                <Mail size={16} aria-hidden="true" />
              </a>
            </div>
          </div>

          <nav aria-label="Footer" className="grid gap-0 border-t border-slate-800 md:grid-cols-2 md:gap-8 md:border-0 lg:grid-cols-4">
            {FOOTER_NAV.map((group) => (
              <FooterNavGroup key={group.label} title={group.label}>
                <ul className="space-y-1 pb-3 md:mt-4 md:space-y-2.5 md:pb-0">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="inline-flex min-h-11 w-full items-center text-slate-400 transition-colors hover:text-slate-100 md:min-h-0">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </FooterNavGroup>
            ))}
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-slate-800 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">
            &copy; {currentYear} SoterAI. Built and run by{" "}
            <Link href="/about" className="font-medium text-slate-300 underline-offset-2 hover:text-cyan hover:underline">
              Yash Chauhan
            </Link>
            , a solo founder in India.
          </p>

          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            {LEGAL_NAV.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-slate-400 transition-colors hover:text-slate-100">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-6 max-w-3xl text-xs leading-5 text-slate-400">
          SoterAI lowers risk and misses things. It does not provide complete security, and the published benchmarks
          are self-maintained, not independently audited. See{" "}
          <Link href="/limitations" className="font-medium text-slate-300 underline hover:text-slate-100">
            known limitations
          </Link>{" "}
          and{" "}
          <Link href="/benchmarks" className="font-medium text-slate-300 underline hover:text-slate-100">
            the benchmark method
          </Link>
          .
        </p>
      </div>
    </footer>
  );
}
