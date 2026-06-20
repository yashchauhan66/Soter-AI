"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * DocViewTracker — fires a POST to /api/docs/track on every page view.
 * Uses sessionStorage to deduplicate within the same browser tab session.
 *
 * Usage: <DocViewTracker /> (add to any server component layout/page)
 */
export function DocViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
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
  }, [pathname, searchParams]);

  return null; // This component renders nothing
}
