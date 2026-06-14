import type { Metadata } from "next";
import Link from "next/link";
import { LogIn, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { SignOutButton } from "@/components/auth/SignOutButton";
import "./globals.css";

export const metadata: Metadata = {
  title: "CyberRakshak Guard | AI Chatbot Security Gateway",
  description: "OWASP LLM Top 10 aligned defense-in-depth for chatbot input and output flows.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  return (
    <html lang="en">
      <body>
        <AuthProvider session={session}>
          <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-ink/85 backdrop-blur-xl">
            <div className="container-page flex h-16 items-center justify-between">
              <Link href="/" className="flex items-center gap-2 font-bold">
                <span className="rounded-lg bg-cyan/15 p-2 text-cyan"><ShieldCheck size={20} /></span>
                CyberRakshak <span className="text-cyan">Guard</span>
              </Link>
              <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
                <Link href="/#features" className="hover:text-white">Features</Link>
                <Link href="/docs" className="hover:text-white">Docs</Link>
                <Link href="/playground" className="hover:text-white">Playground</Link>
                {session?.user ? (
                  <>
                    <Link href="/dashboard" className="button-secondary !px-4 !py-2">Dashboard</Link>
                    <span className="text-slate-500">{session.user.email}</span>
                    <SignOutButton />
                  </>
                ) : (
                  <>
                    <Link href="/signin" className="hover:text-white inline-flex items-center gap-1.5"><LogIn size={14} /> Sign in</Link>
                    <Link href="/signup" className="button-primary !px-4 !py-2">Get started</Link>
                  </>
                )}
              </nav>
              {session?.user
                ? <Link href="/dashboard" className="button-primary !px-4 !py-2 md:hidden">Dashboard</Link>
                : <Link href="/signup" className="button-primary !px-4 !py-2 md:hidden">Sign up</Link>}
            </div>
          </header>
          {children}
          <footer className="border-t border-slate-800 py-10 text-sm text-slate-500">
            <div className="container-page flex flex-col justify-between gap-3 sm:flex-row">
              <p>CyberRakshak Guard. Defensive AI security for chatbot flows.</p>
              <p>Risk reduction through defense-in-depth. No security control is absolute.</p>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
