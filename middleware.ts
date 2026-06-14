import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Edge-safe middleware: only enforces presence of a session for protected
// routes. Detailed user lookup, role checks, and tenant scoping happen in
// route handlers and server components via lib/auth/guards.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css)$).*)"],
};
