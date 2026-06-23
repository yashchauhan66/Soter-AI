"use client";

import { KeyRound, LogIn } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { SignOutButton } from "./SignOutButton";

export function HeaderNav() {
  const { data: session, status } = useSession();
  const signedIn = status === "authenticated" && session?.user;

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
      <nav className="hidden items-center gap-5 text-sm text-slate-300 md:flex">
        {signedIn ? (
          <>
            <Link href="/dashboard" className="font-semibold text-cyan hover:text-white">Dashboard</Link>
            <Link href="/docs" className="hover:text-white">Docs</Link>
            <Link href="/benchmarks" className="hover:text-white">Benchmarks</Link>
            <Link href="/playground" className="hover:text-white">Playground</Link>
            <span className="mx-1 h-5 w-px bg-slate-700" />
            {apiKeyLink()}
            <span className="max-w-36 truncate text-xs text-slate-500">{session.user?.email}</span>
            <SignOutButton />
          </>
        ) : (
          <>
            <Link href="/#features" className="hover:text-white">Features</Link>
            <Link href="/docs" className="hover:text-white">Docs</Link>
            <Link href="/demo" className="hover:text-white">Demo</Link>
            <Link href="/pricing" className="hover:text-white">Pricing</Link>
            <Link href="/comparison" className="hover:text-white">Compare</Link>
            <Link href="/benchmarks" className="hover:text-white">Benchmarks</Link>
            <Link href="/playground" className="hover:text-white">Playground</Link>
            {apiKeyLink()}
            <Link href="/signin" className="inline-flex items-center gap-1.5 hover:text-white"><LogIn size={14} aria-hidden="true" /> Sign in</Link>
            <Link href="/signup" className="button-primary !px-4 !py-2">Get started</Link>
          </>
        )}
      </nav>
      <div className="flex items-center gap-3 md:hidden">
        {signedIn ? (
          <>
            {apiKeyLink(true)}
            <Link href="/dashboard" className="button-primary !px-4 !py-2">Dashboard</Link>
          </>
        ) : (
          <>
            {apiKeyLink(true)}
            <Link href="/signup" className="button-primary !px-4 !py-2">Sign up</Link>
          </>
        )}
      </div>
    </>
  );
}
