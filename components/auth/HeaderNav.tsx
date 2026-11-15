"use client";

import Link from "next/link";
import { PLAYGROUND_CTA_LABEL } from "@/lib/marketing/cta";
import { useSession } from "next-auth/react";
import { LayoutDashboard } from "lucide-react";
import { DesktopNav } from "@/components/layout/DesktopNav";
import { MobileNav } from "@/components/layout/MobileNav";
import { SignOutButton } from "./SignOutButton";

/**
 * Header right rail: primary navigation plus account actions.
 *
 * One primary action. The previous header carried three: "Get API Key", "Sign in"
 * and "Start free". Phase 2 set the conversion order as try it live, then a free
 * account, then a security review. The header now shows only the first, plus a
 * quiet "Sign in" for returning users. "Start free" and the API key link live
 * where a visitor has just seen a result and has a reason to sign up.
 *
 * Signed-in users see their dashboard instead, unchanged.
 */
export function HeaderNav() {
  const { data: session, status } = useSession();
  const signedIn = status === "authenticated" && Boolean(session?.user);
  const isAdmin = Boolean(session?.user?.isAdmin);

  return (
    <div className="flex flex-1 items-center justify-end gap-2">
      <DesktopNav />

      <span className="mx-2 hidden h-5 w-px bg-slate-800 lg:block" aria-hidden="true" />

      {signedIn ? (
        <>
          <Link href={isAdmin ? "/admin" : "/dashboard"} className="button-primary button-sm min-h-12">
            <LayoutDashboard size={15} aria-hidden="true" />
            {isAdmin ? "Admin" : "Dashboard"}
          </Link>
          {session?.user?.email && (
            <span className="hidden max-w-40 truncate text-xs text-slate-400 xl:inline">{session.user.email}</span>
          )}
          <span className="hidden lg:block">
            <SignOutButton />
          </span>
        </>
      ) : (
        <>
          <Link
            href="/signin"
            className="hidden items-center rounded-md px-3 py-2 font-mono text-[0.8125rem] font-semibold tracking-tight text-slate-400 transition-colors hover:bg-slate-900 hover:text-slate-100 lg:inline-flex"
          >
            Sign in
          </Link>
          <Link href="/playground" className="button-primary button-sm min-h-12">
            {PLAYGROUND_CTA_LABEL}
          </Link>
        </>
      )}

      <MobileNav />
    </div>
  );
}
