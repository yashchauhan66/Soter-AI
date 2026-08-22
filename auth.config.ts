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

if (!process.env.API_KEY_PEPPER && !process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
  console.warn("WARNING: No API_KEY_PEPPER, AUTH_SECRET, or NEXTAUTH_SECRET set. Passport token hashing will fail.");
}

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
  // Universal AI gateway — authenticates via x-soterai-api-key in the route
  // handler; middleware must not session-gate it (SDKs have no cookies).
  "/api/gateway",
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
  // Advanced-security control plane. Every route below authenticates with
  // authenticateAdvancedSecurity / authenticateApiKeyRequest (x-api-key) and has
  // no cookie path at all, so session-gating them here produced a middleware
  // 401 "Authentication required." for valid API keys before the handler ever
  // ran — the failure the n8n node's universalGuard action hit on
  // /api/semantic-egress/check while its other layers worked.
  "/api/semantic-egress",
  "/api/intent",
  "/api/tool-chain",
  "/api/escrow",
  "/api/dry-run",
  "/api/evidence",
  "/api/a2a",
  // Exact paths, not the whole /api/guard or /api/v1 tree: /api/guard/grounding
  // is session-authenticated via requireProjectPermission and must stay gated.
  "/api/guard/universal",
  "/api/workflow/audit",
  "/api/v1/fleet",
  // Browser-extension control plane — authenticates via x-soter-extension-token
  // (device token) or x-api-key in the route handler; the extension has no
  // session cookie, so the middleware must not session-gate these routes.
  "/api/extension",
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
  // Machine-readable API contract. SDKs ship this path as
  // SOTERAI_OPENAPI_SPEC_PATH and fetch it without a session cookie, and the
  // same document is already published in docs/api/openapi.v1.json.
  "/api/openapi",
  // Cron-driven worker endpoints. They authenticate on an
  // `Authorization: Bearer $WEBHOOK_WORKER_TOKEN` / `$REPORT_WORKER_TOKEN`
  // header and return 403 without it (503 when the token is unset), so they have
  // no cookie path either — session-gating them meant an external cron driver
  // got 401 and the webhook / scheduled-report queues never drained. Exact paths
  // only: the rest of /api/admin stays session- and requireAdmin-gated.
  "/api/admin/webhooks/process",
  "/api/admin/reports/process",
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
      // Machine callers on API routes must get a JSON 401, not an HTML sign-in
      // redirect — a redirect hides the failure in automation and prompts a
      // follow to an unrelated page.
      if (!auth?.user && pathname.startsWith("/api/")) {
        return Response.json(
          { error: true, message: "Authentication required." },
          { status: 401 },
        );
      }
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
