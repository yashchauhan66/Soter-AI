"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { SignOutButton } from "./SignOutButton";

export function HeaderNav() {
  const { data: session, status } = useSession();
  const signedIn = status === "authenticated" && session?.user;

  return (
    <>
      <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
        <Link href="/#features" className="hover:text-white">Features</Link>
        <Link href="/docs" className="hover:text-white">Docs</Link>
        <Link href="/demo" className="hover:text-white">Demo</Link>
        <Link href="/pricing" className="hover:text-white">Pricing</Link>
        <Link href="/playground" className="hover:text-white">Playground</Link>
        {signedIn ? (
          <>
            <Link href="/dashboard" className="button-secondary !px-4 !py-2">Dashboard</Link>
            <span className="max-w-48 truncate text-slate-500">{session.user?.email}</span>
            <SignOutButton />
          </>
        ) : (
          <>
            <Link href="/signin" className="inline-flex items-center gap-1.5 hover:text-white"><LogIn size={14} /> Sign in</Link>
            <Link href="/signup" className="button-primary !px-4 !py-2">Get started</Link>
          </>
        )}
      </nav>
      {signedIn
        ? <Link href="/dashboard" className="button-primary !px-4 !py-2 md:hidden">Dashboard</Link>
        : <Link href="/signup" className="button-primary !px-4 !py-2 md:hidden">Sign up</Link>}
    </>
  );
}
