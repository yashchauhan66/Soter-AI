import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { checkLegalBoundary } from "../lib/advanced-security/legalBoundary";

process.env.API_KEY_PEPPER = process.env.API_KEY_PEPPER ?? "cybersecurityguard-test-pepper-value-1234567890";

// ===== Agent Legal Boundary Guard (21-30) =====

test("Legal 21: public read-only browsing -> ALLOW", () => {
  const r = checkLegalBoundary({ agentName: "a", domain: "example.com", actionCategory: "READ_ONLY", action: "read_page" });
  assert.equal(r.decision, "ALLOW");
  assert.equal(r.riskLevel, "LOW");
});

test("Legal 22: login without consent -> TAKEOVER_REQUIRED", () => {
  const r = checkLegalBoundary({ agentName: "a", domain: "example.com", actionCategory: "LOGIN", action: "sign_in", userConsentProvided: false });
  assert.equal(r.decision, "TAKEOVER_REQUIRED");
});

test("Legal 23: password/OTP entry -> TAKEOVER_REQUIRED", () => {
  const r = checkLegalBoundary({ agentName: "a", domain: "example.com", actionCategory: "FORM_SUBMIT", action: "enter password and otp" });
  assert.equal(r.decision, "TAKEOVER_REQUIRED");
  assert.equal(r.riskLevel, "CRITICAL");
});

test("Legal 24: purchase/payment -> TAKEOVER_REQUIRED", () => {
  const r = checkLegalBoundary({ agentName: "a", domain: "shop.com", actionCategory: "PURCHASE", action: "submit_order", metadata: { paymentInvolved: true } });
  assert.equal(r.decision, "TAKEOVER_REQUIRED");
});

test("Legal 25: send message/email -> ASK_APPROVAL", () => {
  const r = checkLegalBoundary({ agentName: "a", domain: "mail.com", actionCategory: "MESSAGE_SEND", action: "send_email" });
  assert.equal(r.decision, "ASK_APPROVAL");
});

test("Legal 26: submit personal data to unknown domain -> ASK_APPROVAL/BLOCK", () => {
  const r = checkLegalBoundary({ agentName: "a", domain: "unknown.xyz", actionCategory: "DATA_UPLOAD", action: "upload form", metadata: { personalDataInvolved: true, domainTrusted: false } });
  assert.ok(["ASK_APPROVAL", "BLOCK"].includes(r.decision));
  const blocked = checkLegalBoundary({ agentName: "a", domain: "unknown.xyz", actionCategory: "DATA_UPLOAD", metadata: { personalDataInvolved: true, domainTrusted: false }, policy: { blockDataUploadToUnknown: true } });
  assert.equal(blocked.decision, "BLOCK");
});

test("Legal 27: accept terms/legal agreement -> TAKEOVER_REQUIRED", () => {
  const r = checkLegalBoundary({ agentName: "a", domain: "example.com", actionCategory: "TERMS_ACCEPTANCE", action: "accept terms" });
  assert.equal(r.decision, "TAKEOVER_REQUIRED");
});

test("Legal 28: bypass paywall/access control -> BLOCK", () => {
  const r = checkLegalBoundary({ agentName: "a", domain: "news.com", actionCategory: "READ_ONLY", action: "bypass the paywall" });
  assert.equal(r.decision, "BLOCK");
  assert.equal(r.riskLevel, "CRITICAL");
});

test("Legal 29: blocked domain -> BLOCK", () => {
  const r = checkLegalBoundary({ agentName: "a", domain: "evil.com", actionCategory: "READ_ONLY", action: "read", policy: { blockedDomains: ["evil.com"] } });
  assert.equal(r.decision, "BLOCK");
});

test("Legal 30: dashboard + API route exist on disk", () => {
  assert.equal(existsSync("app/dashboard/legal-boundary/page.tsx"), true);
  assert.equal(existsSync("app/api/legal-boundary/check/route.ts"), true);
});

// Extra: scraping volume + account change coverage
test("Legal extra: scraping over limit -> BLOCK; account change -> approval/takeover", () => {
  const scrape = checkLegalBoundary({ agentName: "a", domain: "x.com", actionCategory: "SCRAPING", metadata: { scrapeCount: 5000 }, policy: { scrapingLimit: 100 } });
  assert.equal(scrape.decision, "BLOCK");
  const acct = checkLegalBoundary({ agentName: "a", domain: "x.com", actionCategory: "ACCOUNT_CHANGE", metadata: { loggedIn: true } });
  assert.equal(acct.decision, "ASK_APPROVAL");
});
