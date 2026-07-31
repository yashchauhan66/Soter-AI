"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeaderNav } from "@/components/auth/HeaderNav";
import { AiAssistantLoader } from "@/components/dashboard/AiAssistantLoader";
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
      <div id="main-content" tabIndex={-1}>
        {children}
      </div>
    );
  }

  return (
    <>
      <PHLaunchBanner />
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-ink/90 backdrop-blur-xl">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/" className="flex min-w-0 items-center font-semibold tracking-wide">
            <Image src="/logo.png" alt="SoterAI" width={114} height={40} priority className="h-9 w-auto" />
          </Link>
          <HeaderNav />
        </div>
      </header>
      <div id="main-content" tabIndex={-1}>
        {children}
      </div>
      <footer className="border-t border-slate-800 bg-slate-950/45 py-12 text-sm text-slate-500">
        <div className="container-page">
          <div className="flex flex-col justify-between gap-8 sm:flex-row">
            <div className="max-w-xs">
              <Link href="/" className="flex items-center font-semibold tracking-wide">
                <Image src="/logo.png" alt="SoterAI" width={97} height={34} className="h-8 w-auto" />
              </Link>
              <p className="mt-3 leading-6 text-slate-500">
                AI security command layer for chatbots, RAG apps, and autonomous agents.
              </p>
            </div>
            <div className="flex flex-wrap gap-10">
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Product</p>
                <div className="flex flex-col gap-2">
                  <Link href="/#features" className="hover:text-slate-300">Features</Link>
                  <Link href="/docs" className="hover:text-slate-300">Documentation</Link>
                  <Link href="/pricing" className="hover:text-slate-300">Pricing</Link>
                  <Link href="/playground" className="hover:text-slate-300">Playground</Link>
                  <Link href="/demo" className="hover:text-slate-300">Demo</Link>
                  {/* Public catalog — the old /dashboard/integrations target sent
                      logged-out visitors to a login wall (a dead end). */}
                  <Link href="/integrations" className="hover:text-slate-300">Integrations</Link>
                  <Link href="/blog" className="hover:text-slate-300">Blog</Link>
                </div>
              </div>
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Company</p>
                <div className="flex flex-col gap-2">
                  <Link href="/trust" className="hover:text-slate-300">Trust</Link>
                  <Link href="/status" className="hover:text-slate-300">Status</Link>
                  <Link href="/terms" className="hover:text-slate-300">Terms</Link>
                  <Link href="/privacy" className="hover:text-slate-300">Privacy</Link>
                  <Link href="/security" className="hover:text-slate-300">Security</Link>
                  <Link href="/support" className="hover:text-slate-300">Support</Link>
                </div>
              </div>
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Compare</p>
                <div className="flex flex-col gap-2">
                  <Link href="/comparison" className="hover:text-slate-300">vs Competitors</Link>
                  <Link href="/benchmarks" className="hover:text-slate-300">Benchmarks</Link>
                  <Link href="/case-studies" className="hover:text-slate-300">Case Studies</Link>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-6 sm:flex-row">
            <p className="text-xs">&copy; {currentYear} SoterAI. All rights reserved.</p>
            <p className="text-xs">Security intelligence for AI systems in production.</p>
          </div>
        </div>
      </footer>
      <AiAssistantLoader />
    </>
  );
}
