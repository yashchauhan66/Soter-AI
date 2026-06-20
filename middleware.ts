import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { enforceCsrfOrigin } from "./lib/csrf";

// Edge-safe middleware: enforces CSRF origin checks for API routes, then
// validates session presence for protected pages and private API routes.
// Detailed user lookup, role checks, and tenant scoping happen in route
// handlers and server components via lib/auth/guards.
//
// The CSRF check is composed into the authorized callback so that NextAuth's
// middleware type system resolves correctly (vs. trying to call it as a
// sub-function, which doesn't type-check). NextAuth v5's authorized callback
// can return a Response to short-circuit the request, which is used here.

export const { auth: middleware } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    authorized(params) {
      // CSRF origin check for session-cookie-authenticated API routes.
      // Runs before the session check to reject cross-origin mutations
      // even before evaluating the session.
      const csrfResponse = enforceCsrfOrigin(params.request);
      if (csrfResponse) return csrfResponse;

      // Delegate to the original authorized logic for public/private routing
      return authConfig.callbacks.authorized(params);
    },
  },
});

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/api/:path*"],
};
