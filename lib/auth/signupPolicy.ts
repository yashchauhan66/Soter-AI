// Pure, side-effect-free policy helpers for the self-service signup and
// email-verification workflow (CRG-RT-005).
//
// These functions contain NO database or network calls so they can be unit
// tested deterministically. The signup route and the credentials provider
// compose them with the real Prisma/email clients.
//
// Security/consistency goals encoded here:
// - Production must use a real email provider or fail clearly (never commit a
//   half-created account behind a mock-email misconfiguration).
// - Duplicate signups must not create corrupt duplicate users; an existing
//   unverified account is recovered via resend, a verified one is rejected.
// - Verified email is an authorization prerequisite for credentials login in
//   any mode that can actually deliver mail (i.e. real providers / production).

export type EmailDeliveryMode = "live" | "mock" | "blocked";

type SignupEnv = {
  EMAIL_PROVIDER?: string;
  NODE_ENV?: string;
  AUTH_REQUIRE_EMAIL_VERIFICATION?: string;
};

/**
 * Resolves how verification email will be delivered for the current process.
 * - "blocked": production configured with the mock provider — unsafe, must
 *   fail before any database write.
 * - "mock": development/test with the mock provider — verification links are
 *   surfaced in the response for local/e2e flows.
 * - "live": a real provider (resend/aws-ses/smtp) is configured.
 */
export function resolveEmailDeliveryMode(env: SignupEnv = process.env): EmailDeliveryMode {
  const provider = (env.EMAIL_PROVIDER ?? "mock").toLowerCase();
  const isProduction = env.NODE_ENV === "production";
  if (provider === "mock") {
    return isProduction ? "blocked" : "mock";
  }
  return "live";
}

/**
 * Whether a credentials session may only start once the email is verified.
 * Explicit override wins so staging can force-enable enforcement while still
 * using the mock provider for inspection. Otherwise enforcement tracks the
 * ability to actually deliver mail: enforced for "live", relaxed for "mock"
 * (development), and enforced for "blocked" so a misconfigured prod never
 * silently lets unverified users in.
 */
export function requireVerifiedEmailForLogin(env: SignupEnv = process.env): boolean {
  const override = env.AUTH_REQUIRE_EMAIL_VERIFICATION;
  if (override === "true") return true;
  if (override === "false") return false;
  return resolveEmailDeliveryMode(env) !== "mock";
}

export type SignupCandidate = {
  emailVerifiedAt: Date | null;
  passwordHash: string | null;
  ssoOnly: boolean;
} | null;

export type SignupPlan =
  | { kind: "blocked-email-provider" }
  | { kind: "reject-existing" }
  | { kind: "resend" }
  | { kind: "create" };

/**
 * Decides the safe, idempotent action for a signup attempt.
 * - Mock provider in production => block before writing anything.
 * - No existing user => create.
 * - Existing verified / SSO-only / passwordless account => reject (sign in
 *   instead); never create a duplicate.
 * - Existing unverified password account => resend/regenerate verification.
 */
export function planSignup(input: {
  existingUser: SignupCandidate;
  deliveryMode: EmailDeliveryMode;
}): SignupPlan {
  if (input.deliveryMode === "blocked") return { kind: "blocked-email-provider" };
  const user = input.existingUser;
  if (!user) return { kind: "create" };
  if (user.emailVerifiedAt || user.ssoOnly || !user.passwordHash) {
    return { kind: "reject-existing" };
  }
  return { kind: "resend" };
}

/**
 * Whether a credentials session may be established for this user right now.
 * Used by the NextAuth credentials authorizer after the password check.
 */
export function canStartCredentialsSession(
  user: { emailVerifiedAt: Date | null; ssoOnly: boolean } | null,
  env: SignupEnv = process.env,
): boolean {
  if (!user) return false;
  if (!requireVerifiedEmailForLogin(env)) return true;
  if (user.ssoOnly) return true; // SSO accounts are provisioned pre-verified.
  return Boolean(user.emailVerifiedAt);
}
