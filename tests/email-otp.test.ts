import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmailVerificationOtp,
  emailOtpMatches,
  generateEmailOtp,
  hashEmailOtp,
  EMAIL_OTP_TTL_MS,
} from "../lib/auth/emailOtp";
import { getEmailFrom } from "../lib/email/client";
import { renderEmailTemplate } from "../lib/email/templates";

test("verification email keeps the OTP out of the subject and uses professional branding", () => {
  const email = renderEmailTemplate("verify-email-otp", { otp: "249883" });
  assert.equal(email.subject, "Verify your email address | SoterAI");
  assert.doesNotMatch(email.subject, /249883/);
  assert.match(email.html, />249883</);
  assert.match(email.html, /SoterAI Security Team/);
  assert.match(email.html, /<img src="https:\/\/soterai\.in\/logo\.png"/);
  assert.match(email.html, /alt="SoterAI"/);
  assert.match(email.text, /249883/);
});

test("sender display name is always normalized to SoterAI", () => {
  const previous = process.env.EMAIL_FROM;
  process.env.EMAIL_FROM = "CyberRakshak Guard <onboarding@resend.dev>";
  assert.equal(getEmailFrom(), "SoterAI <onboarding@resend.dev>");
  if (previous === undefined) delete process.env.EMAIL_FROM;
  else process.env.EMAIL_FROM = previous;
});

test("email OTP is always six numeric digits", () => {
  for (let index = 0; index < 100; index += 1) {
    assert.match(generateEmailOtp(), /^\d{6}$/);
  }
});

test("email OTP hashes are user-bound and do not contain the raw code", () => {
  const code = "123456";
  const secret = "test-secret-with-enough-entropy";
  const first = hashEmailOtp("user-1", code, secret);
  const second = hashEmailOtp("user-2", code, secret);
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.notEqual(first, code);
  assert.notEqual(first, second);
});

test("constant-time matcher accepts only the correct user/code pair", () => {
  process.env.EMAIL_OTP_SECRET = "test-secret-with-enough-entropy";
  const stored = hashEmailOtp("user-1", "654321");
  assert.equal(emailOtpMatches("user-1", "654321", stored), true);
  assert.equal(emailOtpMatches("user-1", "654320", stored), false);
  assert.equal(emailOtpMatches("user-2", "654321", stored), false);
});

test("creating a new OTP invalidates the prior code and stores only its hash", async () => {
  process.env.EMAIL_OTP_SECRET = "test-secret-with-enough-entropy";
  const rows: Array<{ userId: string; codeHash: string; expiresAt: Date; usedAt: null }> = [];
  const issuedAt = new Date("2026-07-06T12:00:00.000Z");
  const store = {
    emailVerificationOtp: {
      async deleteMany({ where }: { where: { userId: string; usedAt: null } }) {
        for (let index = rows.length - 1; index >= 0; index -= 1) {
          if (rows[index].userId === where.userId && rows[index].usedAt === null) rows.splice(index, 1);
        }
      },
      async updateMany() {},
      async create({ data }: { data: { userId: string; codeHash: string; expiresAt: Date } }) {
        rows.push({ ...data, usedAt: null });
      },
    },
  };

  const first = await createEmailVerificationOtp("user-1", issuedAt, store);
  const second = await createEmailVerificationOtp("user-1", issuedAt, store);
  assert.equal(rows.length, 1);
  assert.notEqual(first, second);
  assert.equal(rows[0].codeHash, hashEmailOtp("user-1", second));
  assert.equal(rows[0].expiresAt.getTime(), issuedAt.getTime() + EMAIL_OTP_TTL_MS);
});

test("resend provider defaults to the verified SoterAI sender domain", () => {
  const previousProvider = process.env.EMAIL_PROVIDER;
  const previousApiKey = process.env.RESEND_API_KEY;
  const previousFrom = process.env.EMAIL_FROM;
  delete process.env.EMAIL_PROVIDER;
  process.env.RESEND_API_KEY = "re_test_key";
  delete process.env.EMAIL_FROM;
  assert.equal(getEmailFrom(), "SoterAI <onboarding@soterai.in>");
  if (previousProvider === undefined) delete process.env.EMAIL_PROVIDER;
  else process.env.EMAIL_PROVIDER = previousProvider;
  if (previousApiKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = previousApiKey;
  if (previousFrom === undefined) delete process.env.EMAIL_FROM;
  else process.env.EMAIL_FROM = previousFrom;
});
