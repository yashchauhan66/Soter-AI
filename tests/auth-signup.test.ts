import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  resolveEmailDeliveryMode,
  requireVerifiedEmailForLogin,
  planSignup,
  canStartCredentialsSession,
} from "../lib/auth/signupPolicy";
import {
  hashOneTimeToken,
  isOneTimeTokenUsable,
  createEmailVerificationToken,
} from "../lib/auth/tokens";
import { isDatabaseUnavailableError } from "../lib/databaseErrors";

// --- In-memory fakes for the EmailVerificationToken store -------------------
// Mirrors the Prisma surface the token helpers and verify flow rely on, so the
// one-time/expiry/reuse semantics can be tested without a database.

type TokenRow = { id: string; userId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null };

function makeTokenStore() {
  const rows: TokenRow[] = [];
  let seq = 0;
  return {
    rows,
    emailVerificationToken: {
      async deleteMany({ where }: { where: { userId: string; usedAt: null } }) {
        for (let i = rows.length - 1; i >= 0; i--) {
          if (rows[i].userId === where.userId && rows[i].usedAt === null) rows.splice(i, 1);
        }
        return { count: 0 };
      },
      async create({ data }: { data: { userId: string; tokenHash: string; expiresAt: Date } }) {
        const row: TokenRow = { id: `tok_${++seq}`, usedAt: null, ...data };
        rows.push(row);
        return row;
      },
      async findUnique({ where }: { where: { tokenHash: string } }) {
        return rows.find((r) => r.tokenHash === where.tokenHash) ?? null;
      },
      async update({ where, data }: { where: { id: string }; data: { usedAt: Date } }) {
        const row = rows.find((r) => r.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
    },
  };
}

// Replays the consume logic against the fake store (same checks as
// consumeEmailVerificationToken, minus the user.update / real db).
async function consumeAgainst(store: ReturnType<typeof makeTokenStore>, token: string, now = new Date()) {
  const record = await store.emailVerificationToken.findUnique({ where: { tokenHash: hashOneTimeToken(token) } });
  if (!isOneTimeTokenUsable(record, now)) return null;
  await store.emailVerificationToken.update({ where: { id: record!.id }, data: { usedAt: now } });
  return record!.userId;
}

// === Delivery-mode / enforcement policy =====================================

test("CRG-RT-005: production with mock email is a blocked delivery mode", () => {
  assert.equal(resolveEmailDeliveryMode({ EMAIL_PROVIDER: "mock", NODE_ENV: "production" }), "blocked");
  assert.equal(resolveEmailDeliveryMode({ EMAIL_PROVIDER: "mock", NODE_ENV: "development" }), "mock");
  assert.equal(resolveEmailDeliveryMode({ EMAIL_PROVIDER: "resend", NODE_ENV: "production" }), "live");
  assert.equal(resolveEmailDeliveryMode({ EMAIL_PROVIDER: "aws-ses", NODE_ENV: "development" }), "live");
});

test("CRG-RT-005: verification enforced for live/blocked, relaxed for dev mock, override wins", () => {
  assert.equal(requireVerifiedEmailForLogin({ EMAIL_PROVIDER: "resend" }), true);
  assert.equal(requireVerifiedEmailForLogin({ EMAIL_PROVIDER: "mock", NODE_ENV: "development" }), false);
  assert.equal(requireVerifiedEmailForLogin({ EMAIL_PROVIDER: "mock", NODE_ENV: "production" }), true);
  assert.equal(requireVerifiedEmailForLogin({ EMAIL_PROVIDER: "mock", NODE_ENV: "development", AUTH_REQUIRE_EMAIL_VERIFICATION: "true" }), true);
  assert.equal(requireVerifiedEmailForLogin({ EMAIL_PROVIDER: "resend", AUTH_REQUIRE_EMAIL_VERIFICATION: "false" }), false);
});

// === planSignup: idempotency & duplicate safety =============================

test("Test 1 + 8: new signup plans creation; mock-in-prod blocks before any write", () => {
  assert.deepEqual(planSignup({ existingUser: null, deliveryMode: "mock" }), { kind: "create" });
  assert.deepEqual(planSignup({ existingUser: null, deliveryMode: "live" }), { kind: "create" });
  assert.deepEqual(planSignup({ existingUser: null, deliveryMode: "blocked" }), { kind: "blocked-email-provider" });
});

test("Test 2: duplicate UNVERIFIED password signup resends (no duplicate user)", () => {
  const plan = planSignup({
    existingUser: { emailVerifiedAt: null, passwordHash: "$2a$12$hash", ssoOnly: false },
    deliveryMode: "live",
  });
  assert.deepEqual(plan, { kind: "resend" });
});

test("Test 3: duplicate VERIFIED signup is rejected (no second user)", () => {
  const plan = planSignup({
    existingUser: { emailVerifiedAt: new Date(), passwordHash: "$2a$12$hash", ssoOnly: false },
    deliveryMode: "live",
  });
  assert.deepEqual(plan, { kind: "reject-existing" });
});

test("duplicate signup against an SSO-only / passwordless account is rejected", () => {
  assert.deepEqual(
    planSignup({ existingUser: { emailVerifiedAt: null, passwordHash: null, ssoOnly: true }, deliveryMode: "live" }),
    { kind: "reject-existing" },
  );
  assert.deepEqual(
    planSignup({ existingUser: { emailVerifiedAt: null, passwordHash: null, ssoOnly: false }, deliveryMode: "live" }),
    { kind: "reject-existing" },
  );
});

// === Token lifecycle: hashing, expiry, one-time use =========================

test("Test 5: verification token is hashed (raw token never equals stored hash)", () => {
  const raw = "example-raw-token-value-1234567890";
  const hashed = hashOneTimeToken(raw);
  assert.notEqual(hashed, raw);
  assert.match(hashed, /^[0-9a-f]{64}$/);
  // Deterministic + domain-separated.
  assert.equal(hashOneTimeToken(raw), hashed);
});

test("Test 1+4: createEmailVerificationToken stores only a hash and validates", async () => {
  const store = makeTokenStore();
  const token = await createEmailVerificationToken("user-1", new Date(), store);
  assert.equal(store.rows.length, 1);
  assert.equal(store.rows[0].tokenHash, hashOneTimeToken(token));
  assert.notEqual(store.rows[0].tokenHash, token);
  const userId = await consumeAgainst(store, token);
  assert.equal(userId, "user-1");
});

test("Test 5: a used token cannot be reused", async () => {
  const store = makeTokenStore();
  const token = await createEmailVerificationToken("user-2", new Date(), store);
  assert.equal(await consumeAgainst(store, token), "user-2");
  assert.equal(await consumeAgainst(store, token), null);
});

test("Test 6: an expired token fails safely", async () => {
  const store = makeTokenStore();
  const issuedAt = new Date("2026-01-01T00:00:00Z");
  const token = await createEmailVerificationToken("user-3", issuedAt, store);
  const afterExpiry = new Date(issuedAt.getTime() + 25 * 60 * 60 * 1000);
  assert.equal(await consumeAgainst(store, token, afterExpiry), null);
});

test("Test 2: resend regenerates and invalidates the prior unused token", async () => {
  const store = makeTokenStore();
  const first = await createEmailVerificationToken("user-4", new Date(), store);
  const second = await createEmailVerificationToken("user-4", new Date(), store);
  assert.notEqual(first, second);
  assert.equal(store.rows.length, 1, "old unused token should be removed on regenerate");
  // Old link no longer works; new one does.
  assert.equal(await consumeAgainst(store, first), null);
  assert.equal(await consumeAgainst(store, second), "user-4");
});

test("invalid/garbage token is rejected safely", async () => {
  const store = makeTokenStore();
  await createEmailVerificationToken("user-5", new Date(), store);
  assert.equal(await consumeAgainst(store, "not-a-real-token"), null);
});

// === Login gating ===========================================================

test("Test 10 + 11: unverified login blocked when enforced, allowed after verify", () => {
  const live = { EMAIL_PROVIDER: "resend" };
  assert.equal(canStartCredentialsSession({ emailVerifiedAt: null, ssoOnly: false }, live), false);
  assert.equal(canStartCredentialsSession({ emailVerifiedAt: new Date(), ssoOnly: false }, live), true);
});

test("Test 9: development mock mode allows login without verification", () => {
  const dev = { EMAIL_PROVIDER: "mock", NODE_ENV: "development" };
  assert.equal(canStartCredentialsSession({ emailVerifiedAt: null, ssoOnly: false }, dev), true);
});

test("SSO-only accounts may sign in even when verification is enforced", () => {
  const live = { EMAIL_PROVIDER: "resend" };
  assert.equal(canStartCredentialsSession({ emailVerifiedAt: null, ssoOnly: true }, live), true);
});

test("null user can never start a session", () => {
  assert.equal(canStartCredentialsSession(null, { EMAIL_PROVIDER: "mock", NODE_ENV: "development" }), false);
});

// === Route structure (Test 7): email failure cannot corrupt state ==========

test("Test 7: signup route delivers email only after the atomic transaction", () => {
  const src = readFileSync("app/api/auth/signup/route.ts", "utf8");
  const txIndex = src.indexOf("db.$transaction");
  const deliverIndex = src.indexOf("deliverVerification(body.email, created.token)");
  assert.ok(txIndex >= 0, "expected an atomic db.$transaction block");
  assert.ok(deliverIndex >= 0, "expected post-commit email delivery");
  assert.ok(deliverIndex > txIndex, "email for a new account must be sent after the transaction commits");
  // Token is generated inside the transaction (atomic with user creation).
  assert.match(src, /createEmailVerificationToken\(user\.id, new Date\(\), tx\)/);
});

test("signup allows enough time for the complete serverless database transaction", () => {
  const src = readFileSync("app/api/auth/signup/route.ts", "utf8");
  assert.match(src, /SIGNUP_TRANSACTION_OPTIONS\s*=\s*\{\s*maxWait:\s*10_000,\s*timeout:\s*30_000\s*\}/);
  assert.match(src, /}, SIGNUP_TRANSACTION_OPTIONS\);/);
});

test("Test 7: a post-commit email failure is caught, not rethrown into a 500", () => {
  const src = readFileSync("app/api/auth/signup/route.ts", "utf8");
  // The create path wraps delivery in try/catch and reports emailSent=false
  // rather than surfacing a generic failure over a committed, consistent user.
  assert.match(src, /catch \(sendError\)/);
  assert.match(src, /emailSent = false/);
});

test("Test 8: signup checks delivery mode before any user write", () => {
  const src = readFileSync("app/api/auth/signup/route.ts", "utf8");
  const modeIndex = src.indexOf("resolveEmailDeliveryMode()");
  const createIndex = src.indexOf("db.$transaction");
  assert.ok(modeIndex >= 0 && createIndex >= 0);
  assert.ok(modeIndex < createIndex, "delivery mode must be resolved before the create transaction");
});

test("CRG-RT-005: credentials authorizer gates on canStartCredentialsSession", () => {
  const src = readFileSync("auth.ts", "utf8");
  assert.match(src, /canStartCredentialsSession\(user\)/);
});

test("no raw verification token is logged in the signup route", () => {
  const src = readFileSync("app/api/auth/signup/route.ts", "utf8");
  // Error logs reference reason/name only, never the token or password.
  assert.doesNotMatch(src, /console\.(log|info|warn|error)\([^)]*\btoken\b/);
  assert.doesNotMatch(src, /console\.(log|info|warn|error)\([^)]*password/);
});

test("database connectivity failures are classified as temporary outages", () => {
  assert.equal(isDatabaseUnavailableError({ name: "PrismaClientInitializationError" }), true);
  assert.equal(isDatabaseUnavailableError({ code: "P1001" }), true);
  assert.equal(isDatabaseUnavailableError({ code: "P2024" }), true);
  assert.equal(isDatabaseUnavailableError({ code: "P2002" }), false);
  assert.equal(isDatabaseUnavailableError(new Error("ordinary application error")), false);
});

