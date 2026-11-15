"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

/**
 * DocViewTracker — fires a POST to /api/docs/track on every page view.
 * Uses sessionStorage to deduplicate within the same browser tab session.
 *
 * It only sends the request for a signed-in reader. The route is documented as
 * anonymous, but `/api/docs/track` is not in `PUBLIC_API_PREFIXES`
 * (auth.config.ts), so the auth middleware answers 401 to everyone else. Before
 * this check, every anonymous docs page view produced a failed request and a red
 * console error, and no event was recorded. Skipping the call keeps what is
 * recorded exactly as it was and removes the error.
 *
 * To record anonymous views, the route has to be added to the public list, with
 * bounds on `page` and `referrer` first. That opens an unauthenticated database
 * write, so it is a decision for the owner and is not made here.
 *
 * Usage: <DocViewTracker /> (add to any server component layout/page)
 */
export function DocViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status } = useSession();

  useEffect(() => {
    // "loading" resolves to one of the other two and re-runs this effect.
    if (status !== "authenticated") return;

    // Build a simple session fingerprint (not a real visitor ID)
    let sessionId = sessionStorage.getItem("soter_docs_session");
    if (!sessionId) {
      try {
        sessionId = crypto.randomUUID();
      } catch {
        // Fallback for non-HTTPS environments where crypto.randomUUID() throws
        sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      }
      sessionStorage.setItem("soter_docs_session", sessionId);
    }

    // Derive a clean page slug from the path
    const page = pathname.replace(/^\/docs\/?/, "") || "hub";

    // Build a cache key so we don't re-track the same page within 30s
    const cacheKey = `soter_docs_viewed_${page}`;
    const lastTracked = sessionStorage.getItem(cacheKey);
    const now = Date.now();
    if (lastTracked && now - Number(lastTracked) < 30_000) {
      return; // debounce: don't re-track within 30 seconds
    }
    sessionStorage.setItem(cacheKey, String(now));

    // Fire the tracking request
    fetch("/api/docs/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page,
        referrer: document.referrer || null,
        sessionId,
        url: window.location.href,
      }),
    }).catch(() => {
      // Silently fail — tracking should never break the page
    });
  }, [pathname, searchParams, status]);

  return null; // This component renders nothing
}
