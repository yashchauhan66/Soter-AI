"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeaderNav } from "@/components/auth/HeaderNav";
import { AiAssistantLoader } from "@/components/dashboard/AiAssistantLoader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Logo } from "@/components/layout/Logo";
import { IdeExtensionBanner } from "@/components/marketing/IdeExtensionBanner";

type SiteChromeProps = {
  children: React.ReactNode;
  /**
   * The site footer, passed in from the server layout rather than imported here.
   *
   * This is deliberate. `SiteChrome` must be a client component (it reads
   * `usePathname` to decide which chrome to show), and anything it *imports*
   * becomes part of the client bundle. Passing the footer in as a prop keeps it
   * a genuine server component — ~60 static links and the whole navigation tree
   * stay out of the JS payload while still appearing in the initial HTML.
   */
  footer: React.ReactNode;
};

/**
 * Global page chrome: announcement bar, header, breadcrumbs, footer.
 *
 * Two behavioural changes worth knowing about:
 *
 * 1. The "Back to Home" strip that sat under the header on every non-home page
 *    is replaced by a real breadcrumb trail. The old strip offered exactly one
 *    destination (root) regardless of page depth and emitted no structured data.
 *
 * 2. The Product Hunt countdown banner is gone. It counted down to 2026-06-30 —
 *    a date already in the past — so `getTimeLeft()` returned null and the
 *    component rendered nothing on every request while still shipping a client
 *    bundle, a 1-second interval, and a hydration pass. Removing it also removes
 *    a second stacked banner above the header, which had been pushing the hero
 *    further below the fold.
 */
export function SiteChrome({ children, footer }: SiteChromeProps) {
  const pathname = usePathname() ?? "/";
  const adminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const dashboardRoute = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  // Admin ships its own full-bleed shell.
  if (adminRoute) {
    return (
      <div id="main-content" tabIndex={-1}>
        {children}
      </div>
    );
  }

  return (
    <>
      {/* Marketing chrome only. Inside the product, a promo bar competes with the
          work the user came to do. */}
      {!dashboardRoute && <IdeExtensionBanner />}

      <header className="sticky top-0 z-header border-b border-slate-800 bg-white/85 backdrop-blur-xl">
        <div className="container-page flex h-16 items-center gap-4">
          <Link
            href="/"
            aria-label="SoterAI home"
            className="flex shrink-0 items-center rounded-lg"
          >
            <Logo size={30} priority />
          </Link>
          <HeaderNav />
        </div>
      </header>

      {!dashboardRoute && <Breadcrumbs pathname={pathname} />}

      <div id="main-content" tabIndex={-1}>
        {children}
      </div>

      {!dashboardRoute && footer}
      <AiAssistantLoader />
    </>
  );
}
