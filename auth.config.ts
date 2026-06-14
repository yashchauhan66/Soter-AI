// Centralised authentication configuration.
// Security notes:
// - Credentials provider uses bcrypt with cost 12; raw passwords are never stored.
// - Sessions are JWT-encoded and short-lived (24h) by default.
// - Public routes are explicitly listed; everything under /dashboard, /admin, and
//   private /api/* routes require an authenticated session.
import type { NextAuthConfig } from "next-auth";

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
];

export const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/guard/analyze",
  "/api/badge",
  "/api/billing/webhook",
];

export const authConfig = {
  pages: { signIn: "/signin" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 },
  trustHost: true,
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isPublicPage = PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
      const isPublicApi = PUBLIC_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
      // /api/guard/input and /api/guard/output authenticate via x-api-key header,
      // not the session cookie, so the middleware lets them through; they enforce
      // their own auth at the route handler level.
      const isGuardApi = pathname === "/api/guard/input" || pathname === "/api/guard/output";
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
