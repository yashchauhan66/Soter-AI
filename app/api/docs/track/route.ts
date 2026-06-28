// SECURITY: Anonymous doc page-view tracking. Records only the page slug,
// referrer, and a session-based fingerprint for approximate unique-visitor
// counts. No PII, no API key, no raw IP stored.
// This endpoint is unauthenticated and rate-limited per IP.

import { enforcePublicRateLimit } from "@/lib/publicRateLimit";
import { recordProductEvent } from "@/lib/ops/onboarding";

export async function POST(request: Request) {
  try {
    const limited = await enforcePublicRateLimit({
      request,
      scope: "docs:track",
      limit: 60,
      windowMs: 60_000,
      message: "Too many tracking requests. Please slow down.",
    });
    if (limited) return limited;

    const body = await request.json() as {
      page: string;
      referrer?: string;
      sessionId?: string;
    };
    const { page, referrer, sessionId } = body;

    if (!page || typeof page !== "string") {
      return Response.json({ error: true, message: "page is required" }, { status: 400 });
    }

    // Fire-and-forget: don't block the response on DB writes
    void recordProductEvent({
      eventType: "docs.page_view",
      properties: {
        page,
        referrer: referrer ?? null,
        sessionId: sessionId ?? null,
        timestamp: new Date().toISOString(),
      },
    }).catch((error) => {
      console.error("[DocTracker] Failed to record page view:", error);
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: true, message: "Invalid request" }, { status: 400 });
  }
}
