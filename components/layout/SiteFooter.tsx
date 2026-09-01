import Link from "next/link";
import Image from "next/image";
import { Activity, ArrowUpRight, Github, Mail } from "lucide-react";
import { FOOTER_NAV, LEGAL_NAV } from "@/lib/navigation";

/**
 * Site footer.
 *
 * Extracted from `SiteChrome` and converted to a **server** component. The
 * footer is ~60 static links; it has no state, no effects, and no event
 * handlers, so shipping it inside the client-side chrome bundle bought nothing.
 * Rendering it on the server also guarantees crawlers see the full internal
 * link graph in the initial HTML.
 *
 * Link data comes from `lib/navigation.ts`, so the footer, header, and mobile
 * drawer can no longer disagree about what the site contains.
 *
 * The status indicator intentionally *links* to /status rather than asserting a
 * state. A hard-coded "All systems operational" badge would have kept claiming
 * "operational" straight through the 2026-08-21 outage, and a per-request health
 * fetch would cost every page a round trip. Same rule as the capability
 * registry: no claim without a runtime source behind it.
 */
export function SiteFooter({ currentYear }: { currentYear: number }) {
  return (
    <footer className="border-t border-slate-800/60 bg-slate-950/60 text-sm text-slate-300">
      <div className="container-page py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,18rem)_1fr]">
          {/* Brand column */}
          <div>
            <Link href="/" aria-label="SoterAI home" className="inline-flex items-center">
              <Image src="/logo.png" alt="SoterAI" width={97} height={34} className="h-8 w-auto" />
            </Link>

            <p className="mt-4 max-w-xs leading-6 text-slate-400">
              The control layer that stops sensitive data and risky AI-agent actions across browsers, IDEs, workflows,
              and APIs.
            </p>

            <Link
              href="/status"
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-cyan/40 hover:text-cyan"
            >
              <Activity size={13} aria-hidden="true" />
              System status
              <ArrowUpRight size={12} aria-hidden="true" />
            </Link>

            <div className="mt-5 flex items-center gap-3">
              <a
                href="mailto:support@soterai.in"
                aria-label="Email SoterAI support"
                className="button-icon"
              >
                <Mail size={16} aria-hidden="true" />
              </a>
              <a
                href="https://github.com/yashchauhan66/Soter-AI"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="SoterAI on GitHub"
                className="button-icon"
              >
                <Github size={16} aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* Link columns */}
          <nav aria-label="Footer" className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {FOOTER_NAV.map((group) => (
              <div key={group.label}>
                <h2 className="text-xs font-bold uppercase tracking-micro text-slate-200">{group.label}</h2>
                <ul className="mt-4 space-y-2.5">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-slate-400 transition-colors hover:text-white">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-slate-800 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400">
            &copy; {currentYear} SoterAI. Security intelligence for AI systems in production.
          </p>

          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            {LEGAL_NAV.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-slate-400 transition-colors hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Honest-claims line. Kept in the footer rather than buried on /limitations
            so the disclaimer travels with every page that makes a claim. */}
        <p className="mt-6 max-w-3xl text-xs leading-5 text-slate-500">
          SoterAI reduces risk through defense in depth. It does not provide complete security, and published benchmarks
          are self-maintained rather than independently audited. See{" "}
          <Link href="/limitations" className="font-medium text-slate-400 underline hover:text-white">
            known limitations
          </Link>{" "}
          and{" "}
          <Link href="/benchmark" className="font-medium text-slate-400 underline hover:text-white">
            benchmark methodology
          </Link>
          .
        </p>
      </div>
    </footer>
  );
}
