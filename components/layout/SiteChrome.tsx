"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeaderNav } from "@/components/auth/HeaderNav";
import { AiAssistantLoader } from "@/components/dashboard/AiAssistantLoader";
import { IdeExtensionBanner } from "@/components/marketing/IdeExtensionBanner";
import { PHLaunchBanner } from "@/components/marketing/PHLaunchBanner";

type SiteChromeProps = {
  children: React.ReactNode;
  currentYear: number;
};

export function SiteChrome({ children, currentYear }: SiteChromeProps) {
  const pathname = usePathname();
  const adminRoute = pathname === "/admin" || pathname?.startsWith("/admin/");

  if (adminRoute) {
    return (
      <>
        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
      </>
    );
  }

  return (
    <>
      <IdeExtensionBanner />
      <PHLaunchBanner />
      <header className="sticky top-0 z-50 border-b border-slate-800/60 bg-ink/85 backdrop-blur-2xl">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/" className="group flex min-w-0 items-center gap-2 font-semibold tracking-wide">
            <Image src="/logo.png" alt="SoterAI" width={114} height={40} priority className="h-9 w-auto transition-transform duration-200 group-hover:scale-[1.02]" />
          </Link>
          <HeaderNav />
        </div>
      </header>
      <div id="main-content" tabIndex={-1}>
        {children}
      </div>
      <footer className="border-t border-slate-800/60 bg-slate-950/60 py-14 text-sm text-slate-300 backdrop-blur">
        <div className="container-page">
          <div className="flex flex-col justify-between gap-10 sm:flex-row">
            <div className="max-w-xs">
              <Link href="/" className="flex items-center font-semibold tracking-wide">
                <Image src="/logo.png" alt="SoterAI" width={97} height={34} className="h-8 w-auto" />
              </Link>
              <p className="mt-4 leading-6 text-slate-400">
                AI security command layer for chatbots, RAG apps, and autonomous agents.
              </p>
              {/* Links to the real status page rather than asserting a state. A
                  hardcoded "All systems operational" badge would have kept saying
                  "operational" through the 2026-08-21 outage, since nothing here is
                  wired to /api/health -- and a per-request health fetch in the footer
                  would cost every page a round trip. Same rule as the capability
                  registry: no claim without a runtime caller behind it. */}
              <div className="mt-4 flex items-center gap-2">
                <Link
                  href="/status"
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/70 bg-slate-900/60 px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-cyan/40 hover:text-white"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan" />
                  System status
                </Link>
              </div>
            </div>
            <div className="flex flex-wrap gap-10">
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-200">Product</p>
                <div className="flex flex-col gap-2">
                  <Link href="/#features" className="hover:text-white">Features</Link>
                  <Link href="/docs" className="hover:text-white">Documentation</Link>
                  <Link href="/playground" className="hover:text-white">Playground</Link>
                  <Link href="/demo" className="hover:text-white">Demo</Link>
                  {/* Public catalog — the old /dashboard/integrations target sent
                      logged-out visitors to a login wall (a dead end). */}
                  <Link href="/integrations" className="hover:text-white">Integrations</Link>
                  <Link href="/extensions/ide" className="hover:text-white">IDE Guard</Link>
                  <Link href="/student-discount" className="hover:text-white">Student Offer</Link>
                  <Link href="/blog" className="hover:text-white">Blog</Link>
                </div>
              </div>
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-200">Company</p>
                <div className="flex flex-col gap-2">
                  <Link href="/trust" className="hover:text-white">Trust</Link>
                  <Link href="/status" className="hover:text-white">Status</Link>
                  <Link href="/terms" className="hover:text-white">Terms</Link>
                  <Link href="/privacy" className="hover:text-white">Privacy</Link>
                  <Link href="/security" className="hover:text-white">Security</Link>
                  <Link href="/support" className="hover:text-white">Support</Link>
                </div>
              </div>
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-200">Compare</p>
                <div className="flex flex-col gap-2">
                  <Link href="/comparison" className="hover:text-white">vs Competitors</Link>
                  <Link href="/benchmarks" className="hover:text-white">Benchmarks</Link>
                  <Link href="/case-studies" className="hover:text-white">Case Studies</Link>
                </div>
              </div>
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-200">Contact</p>
                <div className="flex flex-col gap-2">
                  <a href="mailto:support@soterai.in" className="hover:text-white">support@soterai.in</a>
                  <Link href="/support" className="hover:text-white">Support</Link>
                  <a
                    href="https://github.com/yashchauhan66/Soter-AI"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white"
                  >
                    GitHub
                  </a>
                  <Link href="/status" className="hover:text-white">Status</Link>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-6 sm:flex-row">
            <p className="text-xs text-slate-300">&copy; {currentYear} SoterAI. All rights reserved.</p>
            <p className="text-xs text-slate-300">Security intelligence for AI systems in production.</p>
          </div>
        </div>
      </footer>
      <AiAssistantLoader />
    </>
  );
}
