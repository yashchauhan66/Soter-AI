// Centralised authentication configuration.
// Security notes:
// - Credentials provider uses bcrypt with cost 12; raw passwords are never stored.
// - Sessions are JWT-encoded and short-lived (24h) by default.
// - Public routes are explicitly listed; everything under /dashboard, /admin, and
//   private /api/* routes require an authenticated session.
import type { NextAuthConfig } from "next-auth";

function assertAuthSecretConfigured() {
  if (process.env.NODE_ENV !== "production") return;
  // Skip during `next build` page-data collection; no secrets are available in
  // the Docker build environment. The real check still runs when the server boots.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32 || secret === "replace-with-a-long-random-secret") {
    throw new Error("AUTH_SECRET or NEXTAUTH_SECRET must be configured with at least 32 characters in production.");
  }
}

assertAuthSecretConfigured();

export const PUBLIC_ROUTES = [
  "/",
  "/docs",
  "/playground",
  "/demo-chatbot",
  "/signin",
  "/signup",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/security-status",
  "/badge.js",
  "/scanner",
  "/case-studies",
];

export const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/guard/analyze",
  "/api/badge",
  "/api/billing/webhook",
  "/api/health",
  // API-key-authenticated SDK routes — middleware lets them through;
  // route handlers enforce their own auth via authenticateApiKeyRequest.
  "/api/agent",
  "/api/agent-firewall",
  "/api/canary",
  "/api/lineage",
  "/api/blast-radius",
  "/api/memory",
  "/api/mcp",
  "/api/cost-firewall",
  "/api/legal-boundary",
  "/api/rag",
  "/api/shadow",
  // Bearer-token-authenticated SCIM v2 routes.
  "/api/scim/v2",
  // SAML SSO — IdP redirect (acs), SP metadata, SP-initiated login
  // all arrive without a session cookie.
  "/api/sso/saml",
  // AI assistant (knowledge-base, no sensitive data)
  "/api/ai-assistant",
  // Public readiness/health check.
  "/api/ready",
  // Public lead-generation forms (rate-limited in handler).
  "/api/ops/contact",
  "/api/ops/pilot",
  "/api/scanner",
];

export const authConfig = {
  pages: { signIn: "/signin" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 },
  // Auth.js v5 rejects requests when the host is not trusted. Default to true
  // for local, Docker, and reverse-proxy deployments; set AUTH_TRUST_HOST=false
  // only if your platform provides a fully managed trusted-host configuration.
  trustHost: process.env.AUTH_TRUST_HOST !== "false",
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublicPage = PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
      const isPublicApi = PUBLIC_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
      // /api/guard/input, /api/guard/output, and /api/guard/streaming authenticate
      // via x-api-key header, not the session cookie, so the middleware lets them
      // through; they enforce their own auth at the route handler level.
      const isGuardApi = pathname === "/api/guard/input" || pathname === "/api/guard/output" || pathname === "/api/guard/streaming";
      if (isPublicPage || isPublicApi || isGuardApi) return true;
      return !!auth?.user;
    },
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.email = user.email;
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.userId) {
        session.user.id = token.userId as string;
        session.user.isAdmin = Boolean(token.isAdmin);
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
