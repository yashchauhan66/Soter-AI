"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { KeyRound, LayoutDashboard, LogIn } from "lucide-react";
import { DesktopNav } from "@/components/layout/DesktopNav";
import { MobileNav } from "@/components/layout/MobileNav";
import { SignOutButton } from "./SignOutButton";

/**
 * Header right rail: primary navigation plus account actions.
 *
 * The previous version inlined nine link definitions per auth state and hid the
 * entire desktop nav below `xl` (1280px) — so a 1024–1279px laptop got the phone
 * drawer. Navigation now comes from `lib/navigation.ts` and the breakpoint is
 * `lg`, which keeps the full menu on real laptop widths.
 *
 * The "Get API Key" affordance is deliberately kept: it is the highest-intent
 * action for a developer audience, and pointing signed-out visitors at /signup
 * rather than a login wall preserves the funnel.
 */
export function HeaderNav() {
  const { data: session, status } = useSession();
  const signedIn = status === "authenticated" && Boolean(session?.user);
  const isAdmin = Boolean(session?.user?.isAdmin);

  const apiKeyHref = signedIn ? "/dashboard/api-keys" : "/signup";
  const apiKeyLabel = signedIn ? "API Key" : "Get API Key";

  return (
    <div className="flex flex-1 items-center justify-end gap-2">
      <DesktopNav />

      {/* Divider only appears once both nav and actions are on screen. */}
      <span className="mx-2 hidden h-5 w-px bg-slate-700/60 lg:block" aria-hidden="true" />

      <Link
        href={apiKeyHref}
        className="hidden items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-200 transition-colors hover:bg-amber-500/20 sm:inline-flex"
      >
        <KeyRound size={14} aria-hidden="true" />
        {apiKeyLabel}
      </Link>

      {signedIn ? (
        <>
          <Link href={isAdmin ? "/admin" : "/dashboard"} className="button-primary button-sm">
            <LayoutDashboard size={15} aria-hidden="true" />
            {isAdmin ? "Admin" : "Dashboard"}
          </Link>
          {/* The email confirms which account is active but is the least
              important item in the row, so it is hidden until there is genuine
              room rather than truncated to an ellipsis on a laptop. */}
          {session?.user?.email && (
            <span className="hidden max-w-40 truncate text-xs text-slate-400 xl:inline">
              {session.user.email}
            </span>
          )}
          <span className="hidden lg:block">
            <SignOutButton />
          </span>
        </>
      ) : (
        <>
          <Link
            href="/signin"
            className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/60 hover:text-white lg:inline-flex"
          >
            <LogIn size={14} aria-hidden="true" /> Sign in
          </Link>
          <Link href="/signup" className="button-primary button-sm">
            Start free
          </Link>
        </>
      )}

      <MobileNav />
    </div>
  );
}
