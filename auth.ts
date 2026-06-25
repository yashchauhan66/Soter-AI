import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "./lib/db";
import { authConfig } from "./auth.config";
import { consumeSamlSessionExchange } from "./lib/enterprise/samlSessionExchange";
import { canStartCredentialsSession } from "./lib/auth/signupPolicy";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

const samlExchangeSchema = z.object({
  token: z.string().min(32).max(200),
});

// How often a live JWT re-checks that its subject still exists in the database.
// A re-seeded / restored / pruned database leaves a cryptographically valid JWT
// whose user row is gone ("zombie session"): the header trusts the cookie and
// shows the user signed in, while DB-backed pages render the sign-in form. We
// close that gap by revalidating the subject and invalidating the token when it
// has disappeared. Throttled so routine session polls don't hit the DB.
const SESSION_REVALIDATE_MS = 60_000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    // Node-runtime JWT callback with database revalidation. This overrides the
    // edge-safe callback in auth.config.ts (which middleware keeps using, since
    // Prisma cannot run on the edge). It backs auth(), /api/auth/session, and
    // every server guard, so invalidating here logs a zombie session out of the
    // header, the sign-in page, and the dashboard simultaneously.
    async jwt({ token, user }) {
      // Initial sign-in: persist identity and stamp the validation time.
      if (user) {
        token.userId = user.id;
        token.email = user.email ?? token.email;
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
        token.checkedAt = Date.now();
        return token;
      }
      // Defensive: a token without a subject is not a usable session.
      if (!token.userId) return null;
      // Throttle: only re-hit the DB once per interval, not on every poll.
      const lastChecked = typeof token.checkedAt === "number" ? token.checkedAt : 0;
      if (Date.now() - lastChecked < SESSION_REVALIDATE_MS) return token;
      // Revalidate the subject still exists (and refresh role/email drift).
      const dbUser = await db.user.findUnique({
        where: { id: token.userId as string },
        select: { id: true, email: true, isAdmin: true },
      });
      // Subject is gone (DB re-seeded/restored/pruned) → invalidate the session.
      // Returning null clears the cookie everywhere, so the UI can never show a
      // "signed in but no account" state again.
      if (!dbUser) return null;
      token.email = dbUser.email;
      token.isAdmin = dbUser.isAdmin;
      token.checkedAt = Date.now();
      return token;
    },
  },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        // Constant-work-shaped: always run bcrypt.compare even on missing user
        // to prevent timing-based user-enumeration attacks.
        const user = await db.user.findUnique({ where: { email } });
        const stored = user?.passwordHash ?? "$2a$12$0000000000000000000000.invalidhash000000000000000000000";
        const ok = await bcrypt.compare(password, stored);
        if (!user || !ok) return null;
        // Verified email is an authorization prerequisite when mail can be
        // delivered (real provider / production). Mock/dev mode is exempt so
        // local and e2e flows keep working. SSO accounts are pre-verified.
        if (!canStartCredentialsSession(user)) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          isAdmin: user.isAdmin,
        };
      },
    }),
    Credentials({
      id: "saml-exchange",
      name: "SAML SSO",
      credentials: {
        token: { label: "One-time SAML exchange", type: "password" },
      },
      async authorize(rawCredentials, request) {
        const parsed = samlExchangeSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const exchange = await consumeSamlSessionExchange(parsed.data.token, {
          ip: request.headers.get("x-forwarded-for"),
          userAgent: request.headers.get("user-agent"),
        });
        if (!exchange) return null;
        return {
          id: exchange.user.id,
          email: exchange.user.email,
          name: exchange.user.name ?? undefined,
          isAdmin: exchange.user.isAdmin,
        };
      },
    }),
  ],
});
