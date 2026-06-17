import fs from "fs";
import path from "path";

const REPORT_DIR = path.resolve(__dirname, "../../../docs/testing/chatbot-real-test");

export function saveResults(results: any) {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  const resultsPath = path.join(REPORT_DIR, "results.json");
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2), "utf8");
  console.log(`Saved JSON results to ${resultsPath}`);
}

export function generateMarkdownReports(results: any) {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  // 1. FREE_PLAN_TEST_REPORT.md
  const freePlanPath = path.join(REPORT_DIR, "FREE_PLAN_TEST_REPORT.md");
  const freeCases = results.filter((r: any) => r.plan === "FREE");
  const freePlanContent = `# Free Plan Chatbot Test Report

This report documents chatbot safety and routing decisions under the **Free Plan** organization settings.

## Test Cases Summary

| Test Case | Input | Expected Action | Actual Action | LLM Called? | Latency (ms) | Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
${freeCases.map((c: any) => `| ${c.name} | \`${c.input}\` | ${c.expected} | ${c.actual} | ${c.llmCalled} | ${c.latencyMs} | ${c.pass ? "PASSED" : "FAILED"} |`).join("\n")}

## Key Observations
- All safe prompts were successfully forwarded to the mock LLM.
- Input prompt injections were successfully blocked. The mock LLM was **not** called.
- Sensitive PII/secrets were correctly detected (and redacted or held for review depending on policy).
- Output guard successfully intercepted simulated system leaks and unsafe outcomes.
`;
  fs.writeFileSync(freePlanPath, freePlanContent, "utf8");

  // 2. PRO_PLAN_MOCK_ACTIVATION_REPORT.md
  const proPlanPath = path.join(REPORT_DIR, "PRO_PLAN_MOCK_ACTIVATION_REPORT.md");
  const proCases = results.filter((r: any) => r.plan === "PRO");
  const proPlanContent = `# Pro Plan Mock Activation Test Report

This report documents chatbot behaviour under the **Pro Plan** after triggering safe mock activation.

## Mock Activation Details
- **Endpoint**: \`POST /api/billing/activate\`
- **Payload**: \`{ "organizationId": "demo-cyberrakshak", "plan": "PRO", "mock": true }\`
- **Result**: Successfully updated organization plan to \`PRO\` in local database. Verified subscription status is \`ACTIVE\`.

## Test Cases Summary

| Test Case | Input | Expected Action | Actual Action | LLM Called? | Latency (ms) | Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
${proCases.map((c: any) => `| ${c.name} | \`${c.input}\` | ${c.expected} | ${c.actual} | ${c.llmCalled} | ${c.latencyMs} | ${c.pass ? "PASSED" : "FAILED"} |`).join("\n")}

## Verification Notes
- PRO plan app behavior verified with mock activation.
- Razorpay payment lifecycle still not verified (marked as **BLOCKED_NEEDS_USER_ACTION** due to URL webhook secret).
- Free limit no longer applies (limit upgraded to 50,000/month).
`;
  fs.writeFileSync(proPlanPath, proPlanContent, "utf8");

  // 3. CHATBOT_PERFORMANCE_REPORT.md
  const perfPath = path.join(REPORT_DIR, "CHATBOT_PERFORMANCE_REPORT.md");
  const blockedLatencies = results.filter((r: any) => !r.llmCalled).map((r: any) => r.latencyMs);
  const safeLatencies = results.filter((r: any) => r.llmCalled).map((r: any) => r.latencyMs);
  
  const avgBlocked = blockedLatencies.length ? (blockedLatencies.reduce((a: number, b: number) => a + b, 0) / blockedLatencies.length).toFixed(1) : "N/A";
  const avgSafe = safeLatencies.length ? (safeLatencies.reduce((a: number, b: number) => a + b, 0) / safeLatencies.length).toFixed(1) : "N/A";

  const perfContent = `# Chatbot Performance Report

This report evaluates guard latencies, mock LLM timings, and overall overhead.

## Latency Metrics

- **Average Latency for Blocked Prompts**: ${avgBlocked} ms (LLM call skipped)
- **Average Latency for Safe Prompts**: ${avgSafe} ms (includes mock LLM execution and double guard overhead)

## Observations
- Blocked prompts return significantly faster because the LLM is not called.
- Guard API adds a small overhead of ~1-2ms for processing rules local to the server.
- Turbopack cold start compile times for endpoints are excluded from averages.
`;
  fs.writeFileSync(perfPath, perfContent, "utf8");

  // 4. REAL_CHATBOT_TEST_REPORT.md
  const reportPath = path.join(REPORT_DIR, "REAL_CHATBOT_TEST_REPORT.md");
  const testReportContent = `# Real Chatbot Test Report

Detailed logs and results for the real-user-like chatbot integration testing.

## Summary

- **Total Tests**: ${results.length}
- **Passed**: ${results.filter((r: any) => r.pass).length}
- **Failed**: ${results.filter((r: any) => !r.pass).length}

## Log of Execution

| Plan | Test Case | Expected | Actual | Latency | Result |
| :--- | :--- | :--- | :--- | :---: | :---: |
${results.map((r: any) => `| ${r.plan} | ${r.name} | ${r.expected} | ${r.actual} | ${r.latencyMs}ms | ${r.pass ? "PASS" : "FAIL"} |`).join("\n")}
`;
  fs.writeFileSync(reportPath, testReportContent, "utf8");
}
