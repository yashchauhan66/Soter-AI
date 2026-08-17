"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeaderNav } from "@/components/auth/HeaderNav";
import { AiAssistantLoader } from "@/components/dashboard/AiAssistantLoader";
import { IdeExtensionBanner } from "@/components/marketing/IdeExtensionBanner";
import { PHLaunchBanner } from "@/components/marketing/PHLaunchBanner";
import Antigravity from "@/components/ui/Antigravity";

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
        <Antigravity fixed color="#ffffff" count={400} magnetRadius={8} ringRadius={7} waveSpeed={0.45} waveAmplitude={0.9} particleSize={1.7} lerpSpeed={0.08} autoAnimate particleVariance={0.8} rotationSpeed={0.08} depthFactor={0.75} pulseSpeed={2.4} fieldStrength={14} particleShape="star" />
        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
      </>
    );
  }

  return (
    <>
      <Antigravity fixed color="#ffffff" count={400} magnetRadius={8} ringRadius={7} waveSpeed={0.45} waveAmplitude={0.9} particleSize={1.7} lerpSpeed={0.08} autoAnimate particleVariance={0.8} rotationSpeed={0.08} depthFactor={0.75} pulseSpeed={2.4} fieldStrength={14} particleShape="star" />
      <IdeExtensionBanner />
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
      <footer className="border-t border-slate-800 bg-slate-950/45 py-12 text-sm text-slate-300">
        <div className="container-page">
          <div className="flex flex-col justify-between gap-8 sm:flex-row">
            <div className="max-w-xs">
              <Link href="/" className="flex items-center font-semibold tracking-wide">
                <Image src="/logo.png" alt="SoterAI" width={97} height={34} className="h-8 w-auto" />
              </Link>
              <p className="mt-3 leading-6 text-slate-300">
                AI security command layer for chatbots, RAG apps, and autonomous agents.
              </p>
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
