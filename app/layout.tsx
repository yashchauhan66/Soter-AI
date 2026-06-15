import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { HeaderNav } from "@/components/auth/HeaderNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "CyberRakshak Guard | AI Chatbot Security Gateway",
  description: "OWASP LLM Top 10 aligned defense-in-depth for chatbot input and output flows.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-ink/85 backdrop-blur-xl">
            <div className="container-page flex h-16 items-center justify-between">
              <Link href="/" className="flex items-center gap-2 font-bold">
                <span className="rounded-lg bg-cyan/15 p-2 text-cyan"><ShieldCheck size={20} /></span>
                CyberRakshak <span className="text-cyan">Guard</span>
              </Link>
              <HeaderNav />
            </div>
          </header>
          {children}
          <footer className="border-t border-slate-800 py-10 text-sm text-slate-500">
            <div className="container-page flex flex-col justify-between gap-4 sm:flex-row">
              <p>CyberRakshak Guard. Defensive AI security for chatbot flows.</p>
              <div className="flex flex-wrap gap-4"><Link href="/trust">Trust</Link><Link href="/status">Status</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></div>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
