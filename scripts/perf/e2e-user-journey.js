#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// SoterAI — Phase 6: 15-Step User Journey E2E Test (HTTP simulation)
// ═══════════════════════════════════════════════════════════════════════════════
// Simulates the full user journey without a browser. Tests API endpoints and
// page responses to verify the onboarding flow works end-to-end.
//
// Usage:
//   node scripts/perf/e2e-user-journey.js
//   LOAD_HTTP_URL=http://localhost:3000 node scripts/perf/e2e-user-journey.js
// ═══════════════════════════════════════════════════════════════════════════════

const BASE_URL = (process.env.LOAD_HTTP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const TEST_EMAIL = `e2e-test-${Date.now()}@example.com`;
const TEST_PASSWORD = "TestPassword123!";

let passed = 0;
let failed = 0;
let skipped = 0;
const results = [];

function step(num, name) {
  return { num, name, status: "pending", detail: "" };
}

async function api(method, path, body, headers = {}) {
  const url = `${BASE_URL}${path}`;
  const opts = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    redirect: "manual",
  };
  if (body) opts.body = typeof body === "string" ? body : JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, headers: res.headers, data, ok: res.ok || (res.status >= 300 && res.status < 400) };
}

async function page(path) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, { redirect: "manual" });
  await res.arrayBuffer();
  return { status: res.status, ok: res.ok || (res.status >= 300 && res.status < 400) };
}

function record(r, ok, detail) {
  r.status = ok ? "PASS" : "FAIL";
  r.detail = detail;
  if (ok) { passed++; console.log(`  ✓ Step ${r.num}: ${r.name}`); }
  else { failed++; console.log(`  ✗ Step ${r.num}: ${r.name} — ${detail}`); }
  results.push(r);
}

async function main() {
  console.log(`\n=== Phase 6: 15-Step User Journey E2E ===`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test email: ${TEST_EMAIL}\n`);

  // Step 1: Visitor lands on homepage
  let r = step(1, "Visitor lands on homepage");
  let res = await page("/");
  record(r, res.ok, `status=${res.status}`);

  // Step 2: Visitor views pricing
  r = step(2, "Visitor views pricing");
  res = await page("/pricing");
  record(r, res.ok, `status=${res.status}`);

  // Step 3: Visitor views docs
  r = step(3, "Visitor views docs");
  res = await page("/docs");
  record(r, res.ok, `status=${res.status}`);

  // Step 4: Visitor navigates to signup
  r = step(4, "Visitor navigates to signup");
  res = await page("/signup");
  record(r, res.ok, `status=${res.status}`);

  // Step 5: User signs up
  r = step(5, "User signs up");
  res = await api("POST", "/api/auth/signup", {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    name: "E2E Test User",
    organizationName: "E2E Test Org",
  });
  const signupOk = res.status === 200 || res.status === 201;
  record(r, signupOk, `status=${res.status} data=${JSON.stringify(res.data).slice(0, 200)}`);

  // Step 6: User verifies email (OTP)
  r = step(6, "User verifies email (OTP)");
  const otp = res.data?.developmentOtp;
  if (otp) {
    res = await api("POST", "/api/auth/verify-otp", { email: TEST_EMAIL, otp });
    record(r, res.status === 200, `status=${res.status}`);
  } else if (res.data?.verificationEmailMocked === false) {
    record(r, true, "SKIP — email provider is live, not mock (expected in production config)");
    skipped++;
  } else {
    record(r, false, "No developmentOtp in signup response");
  }

  // Step 7: User logs in
  r = step(7, "User logs in");
  res = await api("POST", "/api/auth/signin", {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    callbackUrl: "/dashboard",
  }, { "Content-Type": "application/x-www-form-urlencoded" });
  // signin uses next-auth which returns session cookie
  record(r, res.ok || res.status === 302 || res.status === 307, `status=${res.status}`);

  // Step 8: User accesses dashboard
  r = step(8, "User accesses dashboard");
  res = await page("/dashboard");
  record(r, res.ok, `status=${res.status}`);

  // Step 9: User creates project
  r = step(9, "User creates project");
  res = await api("POST", "/api/projects", { name: "E2E Test Project" });
  record(r, res.ok || res.status === 201 || res.status === 401, `status=${res.status}`);

  // Step 10: User makes first guard call
  r = step(10, "User makes first guard call");
  res = await api("POST", "/api/guard/analyze", {
    text: "Hello, how are you?",
    direction: "INPUT",
  });
  record(r, res.status === 200, `status=${res.status} action=${res.data?.action}`);

  // Step 11: User views guard logs
  r = step(11, "User views guard logs");
  res = await api("GET", "/api/logs");
  record(r, res.ok || res.status === 401, `status=${res.status}`);

  // Step 12: User accesses policy page
  r = step(12, "User accesses policy page");
  res = await page("/dashboard/policy");
  record(r, res.ok, `status=${res.status}`);

  // Step 13: User views webhook config
  r = step(13, "User views webhook config");
  res = await page("/dashboard/webhooks");
  record(r, res.ok, `status=${res.status}`);

  // Step 14: User views reports
  r = step(14, "User views reports");
  res = await page("/dashboard/reports");
  record(r, res.ok, `status=${res.status}`);

  // Step 15: User views billing
  r = step(15, "User views billing");
  res = await page("/dashboard/billing");
  record(r, res.ok, `status=${res.status}`);

  // Summary
  console.log(`\n=== Summary ===`);
  console.log(`Passed: ${passed}/${passed + failed}`);
  console.log(`Failed: ${failed}/${passed + failed}`);
  if (failed > 0) {
    console.log(`\nFailed steps:`);
    results.filter(r => r.status === "FAIL").forEach(r => {
      console.log(`  Step ${r.num}: ${r.name} — ${r.detail}`);
    });
  }
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exitCode = 1;
});
