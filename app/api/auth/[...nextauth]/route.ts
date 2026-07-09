import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { enforcePublicRateLimit } from "@/lib/publicRateLimit";

export const { GET } = handlers;

/**
 * SECURITY: Rate-limited POST handler for NextAuth routes.
 *
 * The credentials sign-in callback (/api/auth/callback/credentials) is the
 * primary target for brute-force and credential-stuffing attacks. We rate
 * limit it by client IP and by account email to block rapid-fire attempts
 * while giving legitimate users enough headroom to correct typos.
 *
 * Other auth routes (signout, session, csrf, providers) are excluded because
 * they are either idempotent, already CSRF-protected by NextAuth, or do not
 * accept sensitive credentials.
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Rate-limit only the credentials sign-in callback.
  // Other POST routes (signout, callback for other providers, etc.) are not
  // rate-limited here because they either have their own protections or do not
  // accept password credentials.
  if (pathname.endsWith("/callback/credentials")) {
    const limited = await enforcePublicRateLimit({
      request,
      scope: "auth:signin",
      limit: 10,
      windowMs: 60 * 60_000, // 10 attempts per hour per IP
      message: "Too many sign-in attempts. Please try again later.",
    });
    if (limited) return limited;

    // Per-account rate limiting: read the body to extract email, then apply
    // a secondary limit based on the account to prevent credential-stuffing
    // attacks that distribute attempts across many IPs.
    try {
      const cloned = request.clone();
      const body = await cloned.json();
      const email = body.email?.toLowerCase();
      if (email) {
        const accountLimited = await enforcePublicRateLimit({
          request,
          scope: "auth:signin:account",
          limit: 5,
          windowMs: 15 * 60_000, // 5 attempts per 15 minutes per account
          subject: email,
          message: "Too many failed attempts for this account. Please try again in 15 minutes.",
        });
        if (accountLimited) return accountLimited;
      }
    } catch {
      // If body parsing fails, continue — the IP-based limit still applies.
    }
  }

  return handlers.POST(request);
}
