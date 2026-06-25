/**
 * CSRF origin validation for session-cookie-authenticated API routes.
 *
 * For mutating requests (POST/PATCH/PUT/DELETE) that rely on session cookies
 * for authentication, this guard checks that the Origin or Referer header
 * matches the application's canonical origin (NEXTAUTH_URL). This prevents
 * cross-site request forgery attacks where an attacker's site tricks a
 * logged-in user's browser into making unintended API calls.
 *
 * API-key-authenticated routes (guard endpoints, SCIM, webhooks, next-auth
 * internal endpoints) are exempt because they don't use session cookies.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Route prefixes that are exempt from origin validation because they:
 * - Handle their own CSRF (next-auth internal endpoints)
 * - Authenticate via API key / Bearer token instead of session cookies
 * - Receive requests from external services that legitimately omit Origin
 */
const CSRF_EXEMPT_PREFIXES = [
  "/api/auth/",           // next-auth handles its own CSRF token
  "/api/guard/",          // API-key authenticated
  "/api/badge/",          // public badge endpoint
  "/api/billing/webhook", // external webhook callers (Stripe etc.)
  "/api/scim/v2/",        // Bearer-token authenticated (SCIM provisioning)
  "/api/sso/saml/acs",    // SAML IdP sends form POST without Origin
  "/api/ai-assistant",    // public endpoint (rate limited per IP, no session required)
  "/api/scanner",         // public endpoint for lead generation
];

function getCanonicalOrigin(): string {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

/**
 * Returns a 403/400 Response if the request's origin is invalid for a
 * session-cookie-authenticated mutation, or null if the request is safe
 * (safe method, exempt route, or has a valid Origin/Referer).
 */
export function enforceCsrfOrigin(request: Request): Response | null {
  if (SAFE_METHODS.has(request.method)) return null;

  const { pathname } = new URL(request.url);

  // Skip exempt routes (they handle their own auth)
  if (CSRF_EXEMPT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) {
    return null;
  }

  const origin = request.headers.get("origin");

  if (origin) {
    // Origin header present: validate it matches the canonical origin
    const allowedOrigin = getCanonicalOrigin();
    try {
      const parsedOrigin = new URL(origin);
      const parsedAllowed = new URL(allowedOrigin);
      if (parsedOrigin.origin !== parsedAllowed.origin) {
        return new Response(
          JSON.stringify({ error: true, message: "Invalid origin." }),
          { status: 403, headers: { "content-type": "application/json" } },
        );
      }
    } catch {
      return new Response(
        JSON.stringify({ error: true, message: "Malformed origin header." }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }
  } else {
    // No Origin header: check Referer as a fallback
    const referer = request.headers.get("referer");
    if (referer) {
      const allowedOrigin = getCanonicalOrigin();
      try {
        const parsedReferer = new URL(referer);
        const parsedAllowed = new URL(allowedOrigin);
        if (parsedReferer.origin !== parsedAllowed.origin) {
          return new Response(
            JSON.stringify({ error: true, message: "Invalid referer." }),
            { status: 403, headers: { "content-type": "application/json" } },
          );
        }
      } catch {
        return new Response(
          JSON.stringify({ error: true, message: "Malformed referer header." }),
          { status: 400, headers: { "content-type": "application/json" } },
        );
      }
    }
    // If neither Origin nor Referer is present, allow the request to proceed.
    // Direct API calls, server-side fetches, and tools like curl/Postman
    // legitimately omit these headers.
  }

  return null;
}
