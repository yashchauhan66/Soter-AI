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

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
