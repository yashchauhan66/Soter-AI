"use client";

import { KeyRound, LogIn } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { MobileNav } from "@/components/layout/MobileNav";
import { SignOutButton } from "./SignOutButton";

export function HeaderNav() {
  const { data: session, status } = useSession();
  const signedIn = status === "authenticated" && session?.user;
  const isAdmin = Boolean(session?.user?.isAdmin);

  const apiKeyLink = (compact = false) => (
    <Link
      href={signedIn ? "/dashboard/api-keys" : "/signup"}
      className="inline-flex items-center gap-1.5 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-sm font-medium text-yellow-300 transition hover:bg-yellow-500/20"
    >
      <KeyRound size={compact ? 12 : 14} aria-hidden="true" />
      {signedIn ? "API Key" : "Get API Key"}
    </Link>
  );

  return (
    <>
      <nav className="hidden items-center gap-1 text-sm text-slate-300 xl:flex">
        {signedIn ? (
          <>
            <Link href={isAdmin ? "/admin" : "/dashboard"} className="rounded-lg px-3 py-2 font-semibold text-cyan transition hover:bg-cyan/10 hover:text-white">{isAdmin ? "Admin" : "Dashboard"}</Link>
            <Link href="/docs" className="rounded-lg px-3 py-2 transition hover:bg-slate-800/60 hover:text-white">Docs</Link>
            <Link href="/benchmarks" className="rounded-lg px-3 py-2 transition hover:bg-slate-800/60 hover:text-white">Benchmarks</Link>
            <Link href="/playground" className="rounded-lg px-3 py-2 transition hover:bg-slate-800/60 hover:text-white">Playground</Link>
            <span className="mx-2 h-5 w-px bg-slate-700/60" />
            {apiKeyLink()}
            <span className="ml-2 max-w-36 truncate text-xs text-slate-400">{session.user?.email}</span>
            <SignOutButton />
          </>
        ) : (
          <>
            <Link href="/#features" className="rounded-lg px-3 py-2 transition hover:bg-slate-800/60 hover:text-white">Features</Link>
            <Link href="/docs" className="rounded-lg px-3 py-2 transition hover:bg-slate-800/60 hover:text-white">Docs</Link>
            <Link href="/demo" className="rounded-lg px-3 py-2 transition hover:bg-slate-800/60 hover:text-white">Demo</Link>
            <Link href="/comparison" className="rounded-lg px-3 py-2 transition hover:bg-slate-800/60 hover:text-white">Compare</Link>
            <Link href="/benchmarks" className="rounded-lg px-3 py-2 transition hover:bg-slate-800/60 hover:text-white">Benchmarks</Link>
            <Link href="/playground" className="rounded-lg px-3 py-2 transition hover:bg-slate-800/60 hover:text-white">Playground</Link>
            <span className="mx-2 h-5 w-px bg-slate-700/60" />
            {apiKeyLink()}
            <Link href="/signin" className="ml-1 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 transition hover:bg-slate-800/60 hover:text-white"><LogIn size={14} aria-hidden="true" /> Sign in</Link>
            <Link href="/signup" className="button-primary ml-1 !px-4 !py-2">Get started</Link>
          </>
        )}
      </nav>
      <div className="flex items-center gap-3 xl:hidden">
        {signedIn ? (
          <>
            {apiKeyLink(true)}
            <Link href={isAdmin ? "/admin" : "/dashboard"} className="button-primary !px-4 !py-2">{isAdmin ? "Admin" : "Dashboard"}</Link>
          </>
        ) : (
          <>
            {apiKeyLink(true)}
            <Link href="/signup" className="button-primary !px-4 !py-2">Sign up</Link>
          </>
        )}
        {/* Hamburger: without this, a phone/tablet visitor has no way to reach
            Docs, Pricing, Demo, Playground, etc. (desktop nav is hidden). */}
        <MobileNav />
      </div>
    </>
  );
}
