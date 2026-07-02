import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const extensionPath = join(root, "apps", "extension", "dist", "extension");
const evidenceDir = join(root, "docs", "extension-testing", "evidence", "live-browser-2026-07-01");
const profileDir = join(root, ".tmp", "live-extension-chrome-profile");
const browserPath = chromium.executablePath();
const port = 41739;
const baseUrl = `http://localhost:${port}`;
const confidentialText =
  "Project Cedar synthetic investor deck revenue forecast is 42 million dollars with launch codename Aurora.";
const results = [];
const requests = [];
const consoleErrors = [];
const pageErrors = [];
let lockdownEnabled = false;

await mkdir(evidenceDir, { recursive: true });
await mkdir(resolve(root, ".tmp"), { recursive: true });
await rm(profileDir, { recursive: true, force: true });

const fingerprintBundle = [
  {
    fingerprintSetId: "fp-synthetic-cedar",
    documentName: "Synthetic Project Cedar investor deck",
    category: "investor_deck",
    sensitivity: "critical",
    action: "block",
    chunkHashes: chunkText(confidentialText).map(hash),
    shingleHashes: [...new Set(shingleText(confidentialText).map(hash))],
  },
];

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", baseUrl);
  const body = await readBody(request);
  const parsedBody = body ? safeJson(body) : undefined;
  const endpoint = url.pathname;

  if (endpoint.startsWith("/api/")) {
    requests.push({
      endpoint,
      method: request.method,
      body: endpoint === "/api/extension/enroll" ? { enrollmentCodePresent: Boolean(parsedBody?.enrollmentCode) } : parsedBody,
      tokenHeaderPresent: Boolean(request.headers["x-soter-extension-token"]),
      at: new Date().toISOString(),
    });
  }

  if (endpoint === "/api/extension/enroll") {
    if (parsedBody?.enrollmentCode === "invalid-code") return json(response, 401, { message: "Invalid enrollment code." });
    if (parsedBody?.enrollmentCode === "expired-code") return json(response, 410, { message: "Enrollment code expired." });
    if (parsedBody?.enrollmentCode !== "valid-synthetic-code") return json(response, 400, { message: "Enrollment code required." });
    return json(response, 200, {
      apiBaseUrl: baseUrl,
      organizationId: "org-synthetic",
      organizationName: "Soter Synthetic QA",
      employeeId: "employee-synthetic",
      employeeEmail: "qa.synthetic@example.test",
      department: "QA",
      role: "Tester",
      deviceToken: "device-token-synthetic-never-display",
    });
  }
  if (endpoint === "/api/extension/policy") return json(response, 200, policy());
  if (endpoint === "/api/extension/destinations") return json(response, 200, { destinations: policy().destinations });
  if (endpoint === "/api/extension/source-apps") {
    return json(response, 200, {
      sourceApps: [{
        id: "source-local-synthetic",
        name: "Synthetic Internal Source",
        domains: ["localhost"],
        category: "internal_app",
        enabled: true,
        sensitivity: "critical",
      }],
    });
  }
  if (endpoint === "/api/extension/fingerprint-bundle") return json(response, 200, { fingerprintBundle });
  if (endpoint === "/api/extension/heartbeat") {
    return json(response, 200, { ok: true, lockdownChanged: lockdownEnabled, shortPollingSeconds: lockdownEnabled ? 30 : 300 });
  }
  if (endpoint === "/api/extension/approval-request") {
    return json(response, 200, { approvalId: `approval-${requests.length}`, status: "pending" });
  }
  if (endpoint === "/api/extension/fingerprint-match") return json(response, 200, { matches: parsedBody?.localMatches ?? [] });
  if (endpoint.startsWith("/api/extension/")) return json(response, 200, { ok: true });

  if (endpoint === "/source") return html(response, sourcePage());
  if (endpoint === "/unrelated") return html(response, unrelatedPage());
  return html(response, aiPage());
});

await new Promise((resolveStart) => server.listen(port, "127.0.0.1", resolveStart));

let context;
try {
  context = await chromium.launchPersistentContext(profileDir, {
    executablePath: browserPath,
    headless: false,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-component-update",
      "--disable-background-networking",
    ],
    viewport: { width: 1440, height: 1000 },
  });

  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 20_000 });
  worker.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") consoleErrors.push({ scope: "service-worker", type: message.type(), text: message.text() });
  });
  const extensionId = new URL(worker.url()).host;
  record("Extension service worker loaded", Boolean(extensionId), { extensionId, workerUrl: worker.url() });

  const extensionsPage = await context.newPage();
  observePage(extensionsPage, "chrome-extensions");
  await extensionsPage.goto("chrome://extensions/");
  await extensionsPage.waitForTimeout(1500);
  const managerPresent = await extensionsPage.locator("extensions-manager").count();
  const extensionNames = await extensionsPage.evaluate(() => Array.from(document.querySelector("extensions-manager")?.shadowRoot
    ?.querySelector("extensions-item-list")?.shadowRoot?.querySelectorAll("extensions-item") ?? [])
    .map((item) => item.shadowRoot?.querySelector("#name")?.textContent?.trim() ?? ""));
  record("chrome://extensions opened", managerPresent === 1, { extensionNames });
  record("Extension listed in Chrome management UI", extensionNames.some((text) => text.includes("Soter Enterprise AI Control Plane")), { extensionNames });
  await extensionsPage.screenshot({ path: join(evidenceDir, "01-chrome-extensions.png"), fullPage: true });

  const popup = await context.newPage();
  observePage(popup, "popup");
  await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);
  await popup.waitForSelector("[data-enrollment-view='not-enrolled']");
  record("Popup opens in unenrolled state", (await popup.locator("body").innerText()).includes("Not enrolled"));
  record("Extension icon assets resolve", await iconAssetsResolve(popup, extensionId));
  await popup.screenshot({ path: join(evidenceDir, "02-popup-unenrolled.png"), fullPage: true });

  await enrollAttempt(popup, "invalid-code");
  record("Invalid enrollment token rejected", (await popup.locator("[data-enrollment-error]").innerText()).includes("Invalid enrollment code"));
  await enrollAttempt(popup, "expired-code");
  record("Expired enrollment token rejected", (await popup.locator("[data-enrollment-error]").innerText()).includes("expired"));
  await enrollAttempt(popup, "valid-synthetic-code");
  await popup.waitForSelector("[data-enrollment-view='enrolled']");
  const popupText = await popup.locator("body").innerText();
  record("Self-service enrollment succeeds", popupText.includes("Soter Synthetic QA") && popupText.includes("qa.synthetic@example.test"));
  record("Popup does not display device token", !popupText.includes("device-token-synthetic-never-display"));
  record("Policy sync shown fresh after enrollment", popupText.includes("fresh") && popupText.includes("live-e2e-1"));
  record("Heartbeat shown after enrollment", !popupText.includes("Last heartbeat\nnever"), { popupText });
  await popup.screenshot({ path: join(evidenceDir, "03-popup-enrolled.png"), fullPage: true });

  const sidePanel = await context.newPage();
  observePage(sidePanel, "side-panel");
  await sidePanel.goto(`chrome-extension://${extensionId}/sidepanel/index.html`);
  await sidePanel.waitForSelector("[data-enrollment-view='enrolled']");
  const sidePanelText = await sidePanel.locator("body").innerText();
  record("Side panel document opens enrolled", sidePanelText.includes("Soter Control Plane") && sidePanelText.includes("live-e2e-1"));
  record("Side panel does not display device token", !sidePanelText.includes("device-token-synthetic-never-display"));
  await sidePanel.screenshot({ path: join(evidenceDir, "04-side-panel-enrolled.png"), fullPage: true });

  const ai = await context.newPage();
  observePage(ai, "localhost-ai");
  await ai.goto(`${baseUrl}/ai`);
  await ai.waitForFunction(() => document.documentElement.dataset.soterActiveDomain === "true");
  record("Localhost AI destination detected", await ai.locator("html[data-soter-active-domain='true']").count() === 1);

  await ai.locator("#prompt").fill("How do I implement error handling in React?");
  const cleanBefore = await submissionCount(ai);
  const cleanStart = performance.now();
  await ai.locator("#send").click();
  await waitForSubmissionCount(ai, cleanBefore + 1);
  const cleanLatencyMs = round(performance.now() - cleanStart);
  record("Clean prompt allowed and replayed once", await submissionCount(ai) === cleanBefore + 1, { latencyMs: cleanLatencyMs });
  record("Small clean prompt scan under 100 ms", cleanLatencyMs < 100, { latencyMs: cleanLatencyMs });
  const cleanStorage = JSON.stringify(await worker.evaluate(async () => chrome.storage.local.get(null)));
  const cleanEvents = JSON.stringify(requests.filter((item) => item.endpoint === "/api/extension/audit-log" || item.endpoint === "/api/extension/scan"));
  record("Storage omits raw clean prompt immediately after scan", !cleanStorage.includes("How do I implement error handling in React?"));
  record("Backend events omit raw clean prompt", !cleanEvents.includes("How do I implement error handling in React?"));

  await dispatchPaste(ai, "Here is my API_KEY=synthetic_api_key_value");
  await ai.locator("[data-soter-overlay]").waitFor();
  const apiOverlay = await overlaySnapshot(ai);
  record("Paste detection shows overlay for fake API key", apiOverlay.detected.includes("api_key") && apiOverlay.action.includes("BLOCK"), apiOverlay);
  await ai.screenshot({ path: join(evidenceDir, "05-api-key-paste-overlay.png"), fullPage: true });
  await ai.locator("[data-soter-overlay] button[data-action='replace']").click();
  record("Safe rewrite replaces fake API key", !(await ai.locator("#prompt").inputValue()).includes("synthetic_api_key_value"));

  const blockedBefore = await submissionCount(ai);
  await ai.locator("#prompt").fill("DATABASE_URL=postgres://fake:fake@localhost:5432/app\nJWT_SECRET=fake_secret_123456");
  await ai.locator("#send").click();
  await ai.locator("[data-soter-overlay]").waitFor();
  const envOverlay = await overlaySnapshot(ai);
  record("Submit interception blocks fake .env content", await submissionCount(ai) === blockedBefore && envOverlay.action.includes("BLOCK"), envOverlay);
  await ai.screenshot({ path: join(evidenceDir, "06-env-submit-block.png"), fullPage: true });
  await dismissOverlay(ai);

  await fileCase(ai, "fake.env", "text/plain", "API_KEY=synthetic_api_key_value\nDATABASE_URL=postgres://fake:fake@localhost:5432/app", "cleared");
  await fileCase(ai, "fake-customers.csv", "text/csv", "name,email,phone\nTest User,test@example.com,9876543210", "overlay");
  await fileCase(ai, "fake-code.js", "text/javascript", 'const token = "ghp_fakeFakeFakeFakeFakeFakeFakeFake1234";', "cleared");
  await fileCase(ai, "clean.txt", "text/plain", "This is a public product description with no sensitive data.", "allowed");

  await ai.locator("#prompt").fill(confidentialText);
  await ai.locator("#send").click();
  await ai.locator("[data-soter-overlay]").waitFor();
  const exactFingerprint = await overlaySnapshot(ai);
  record("Exact company fingerprint match enforced", exactFingerprint.detected.includes("company_fingerprint_match") && exactFingerprint.action.includes("BLOCK"), exactFingerprint);
  await ai.waitForTimeout(300);
  const fingerprintEvents = JSON.stringify(requests.filter((item) => item.endpoint === "/api/extension/fingerprint-match" || item.endpoint === "/api/extension/audit-log"));
  record("Fingerprint events omit raw reference content", !fingerprintEvents.includes(confidentialText));
  await ai.screenshot({ path: join(evidenceDir, "07-fingerprint-exact.png"), fullPage: true });
  await dismissOverlay(ai);

  const fuzzyText = confidentialText.replace("42 million dollars", "43 million synthetic dollars");
  await ai.locator("#prompt").fill(fuzzyText);
  await ai.locator("#send").click();
  await ai.locator("[data-soter-overlay]").waitFor();
  const fuzzyFingerprint = await overlaySnapshot(ai);
  record("Fuzzy company fingerprint match enforced", fuzzyFingerprint.detected.includes("company_fingerprint_match"), fuzzyFingerprint);
  await dismissOverlay(ai);

  await ai.locator("#prompt").fill("PAN ABCDE1234F and IFSC HDFC0001234 are synthetic test values.");
  await ai.locator("#send").click();
  await ai.locator("[data-soter-overlay]").waitFor();
  const piiOverlay = await overlaySnapshot(ai);
  record("India PII requires approval", piiOverlay.action.includes("REQUIRE_APPROVAL"), piiOverlay);
  await ai.locator("[data-soter-overlay] button[data-action='approval']").click();
  await ai.waitForTimeout(300);
  record("Approval request created", requests.some((item) => item.endpoint === "/api/extension/approval-request"));
  await dismissOverlay(ai);

  const source = await context.newPage();
  observePage(source, "source-lineage");
  await source.goto(`${baseUrl}/source`);
  const sourceListenerActive = await source.waitForFunction(
    () => document.documentElement.dataset.soterSourceLineage === "true",
    undefined,
    { timeout: 5000 },
  ).then(() => true).catch(() => false);
  record("Source page lineage listener activates", sourceListenerActive);
  if (sourceListenerActive) {
    await source.evaluate(() => {
      const node = document.querySelector("#source-text");
      const range = document.createRange();
      range.selectNodeContents(node);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new ClipboardEvent("copy", { bubbles: true }));
    });
    await source.waitForTimeout(1000);
  } else {
    const now = Date.now();
    await worker.evaluate(async ({ createdAt, expiresAt }) => chrome.storage.local.set({
      "soter.lineageContext.v1": {
        sourceDomain: "localhost",
        sourceApp: "Synthetic Internal Source",
        sourceCategory: "internal_app",
        sourceUrlHash: "a".repeat(64),
        sourceTitle: "Synthetic Internal Source",
        selectedTextHash: "b".repeat(64),
        detectedDataTypes: ["customer_data"],
        redactedPreview: "[REDACTED_SYNTHETIC_SOURCE]",
        createdAt,
        expiresAt,
      },
    }), {
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 15 * 60 * 1000).toISOString(),
    });
  }
  const lineageState = await worker.evaluate(async () => chrome.storage.local.get("soter.lineageContext.v1"));
  const lineageContext = lineageState["soter.lineageContext.v1"];
  record(
    sourceListenerActive ? "Source lineage context captured" : "Seeded hashed lineage context for destination test",
    Boolean(lineageContext?.sourceUrlHash && lineageContext?.selectedTextHash),
    lineageContext,
  );
  record("Lineage context expires in 15 minutes", ttlNearFifteenMinutes(lineageContext));
  await ai.bringToFront();
  await ai.locator("#prompt").fill("Synthetic internal source customer email test@example.com");
  await ai.locator("#send").click();
  await ai.locator("[data-soter-overlay]").waitFor();
  await ai.waitForTimeout(300);
  const lineageRequest = [...requests].reverse().find((item) => item.endpoint === "/api/extension/lineage-event");
  record("Source-to-destination lineage event created", Boolean(lineageRequest?.body?.sourceUrlHash && lineageRequest?.body?.destinationDomain === "localhost"), lineageRequest);
  record("Lineage event omits full raw copied text", !JSON.stringify(lineageRequest ?? {}).includes("Synthetic internal source customer email test@example.com and project Cedar notes."));
  await dismissOverlay(ai);

  lockdownEnabled = true;
  await popup.evaluate(() => new Promise((resolveMessage) => chrome.runtime.sendMessage({ type: "SOTER_SYNC_POLICY" }, resolveMessage)));
  await popup.reload();
  await popup.waitForSelector(".lockdown");
  record("Emergency lockdown visible in popup", (await popup.locator("body").innerText()).includes("Emergency lockdown is active"));
  await popup.screenshot({ path: join(evidenceDir, "08-popup-lockdown.png"), fullPage: true });
  await ai.locator("#prompt").fill("Clean prompt during synthetic emergency lockdown.");
  const lockdownBefore = await submissionCount(ai);
  await ai.locator("#send").click();
  await ai.locator("[data-soter-overlay]").waitFor();
  const lockdownOverlay = await overlaySnapshot(ai);
  record("Emergency lockdown blocks local AI prompt", lockdownOverlay.action.includes("BLOCK") && await submissionCount(ai) === lockdownBefore, lockdownOverlay);
  await dismissOverlay(ai);
  lockdownEnabled = false;
  await popup.evaluate(() => new Promise((resolveMessage) => chrome.runtime.sendMessage({ type: "SOTER_SYNC_POLICY" }, resolveMessage)));

  const perf10k = await promptLatency(ai, "Public product description. ".repeat(400));
  const perf100k = await promptLatency(ai, "Public product description. ".repeat(4000));
  const perf1mb = await fileLatency(ai, "large-clean.txt", Buffer.alloc(1024 * 1024, "A"));
  record("10 KB prompt scan under 300 ms", perf10k < 300, { latencyMs: perf10k });
  record("100 KB prompt does not freeze page", perf100k < 3000, { latencyMs: perf100k });
  record("1 MB file scan completes without page freeze", perf1mb < 5000, { latencyMs: perf1mb });

  const unrelated = await context.newPage();
  observePage(unrelated, "unrelated");
  await unrelated.goto(`${baseUrl}/unrelated`);
  await unrelated.waitForTimeout(500);
  const unrelatedActive = await unrelated.locator("html[data-soter-active-domain='true']").count() === 1;
  record("Unrelated localhost page ignored", !unrelatedActive, { active: unrelatedActive });

  const storageDump = await worker.evaluate(async () => chrome.storage.local.get(null));
  const storageJson = JSON.stringify(storageDump);
  record("Storage omits synthetic API key", !storageJson.includes("synthetic_api_key_value"));
  record("Storage omits raw clean prompt", !storageJson.includes("How do I implement error handling in React?"));
  record("Storage omits raw copied text", !storageJson.includes("Synthetic internal source customer"));

  const eventPayloads = requests.filter((item) => [
    "/api/extension/audit-log",
    "/api/extension/scan",
    "/api/extension/file-scan-event",
    "/api/extension/lineage-event",
    "/api/extension/fingerprint-match",
  ].includes(item.endpoint));
  const eventJson = JSON.stringify(eventPayloads);
  record("Backend events omit raw fake API key", !eventJson.includes("synthetic_api_key_value"));
  record("Backend events omit raw file content", !eventJson.includes("ghp_fakeFakeFakeFakeFakeFakeFakeFake1234"));
  record("No response audit when response scanning disabled", !requests.some((item) => item.endpoint === "/api/extension/audit-log" && item.body?.eventType === "response"));

  await attemptExternal(context, "ChatGPT", "https://chatgpt.com/");
  await attemptExternal(context, "Claude", "https://claude.ai/");
  await attemptExternal(context, "Gemini", "https://gemini.google.com/");
  await attemptExternal(context, "Perplexity", "https://www.perplexity.ai/");

  const extensionScopes = new Set(["service-worker", "popup", "side-panel", "localhost-ai", "source-lineage", "unrelated"]);
  const extensionConsoleErrors = consoleErrors.filter((item) => item.type === "error" && extensionScopes.has(item.scope));
  record("No page-level uncaught errors", pageErrors.length === 0, { pageErrors });
  record("No extension console errors", extensionConsoleErrors.length === 0, { extensionConsoleErrors });

  const evidence = {
    generatedAt: new Date().toISOString(),
    browser: { name: "Playwright Chromium", version: context.browser()?.version() ?? "unknown", executablePath: browserPath },
    extensionPath,
    extensionId,
    baseUrl,
    results,
    requests,
    consoleErrors,
    pageErrors,
  };
  await writeFile(join(evidenceDir, "results.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({
    evidenceDir,
    passed: results.filter((item) => item.status === "PASS").length,
    failed: results.filter((item) => item.status === "FAIL").length,
    results,
    consoleErrors,
    pageErrors,
  }, null, 2));
} finally {
  await context?.close().catch(() => undefined);
  await new Promise((resolveClose) => server.close(resolveClose));
}

function policy() {
  return {
    organizationId: "org-synthetic",
    version: lockdownEnabled ? "live-e2e-lockdown-1" : "live-e2e-1",
    enabled: true,
    allowedDomains: [],
    monitoredDomains: ["localhost"],
    defaultAction: "allow",
    maxPromptChars: 20000,
    riskThresholds: { warn: 10, redact: 25, requireApproval: 55, block: 85 },
    rules: [
      {
        id: "live-secret-block",
        name: "Block credentials and secrets",
        action: "block",
        severity: "critical",
        destinationTypes: ["local_ai", "public_ai", "browser_coding"],
        detectedDataTypes: ["env_file", "api_key", "github_token", "jwt", "private_key", "database_url", "password"],
      },
      {
        id: "live-india-pii-approval",
        name: "Require approval for India PII",
        action: "require_approval",
        severity: "high",
        destinationTypes: ["local_ai", "public_ai"],
        detectedDataTypes: ["aadhaar", "pan", "gstin", "upi_id", "ifsc"],
      },
      {
        id: "live-business-redact",
        name: "Redact business-sensitive text",
        action: "redact",
        severity: "medium",
        destinationTypes: ["local_ai", "public_ai", "browser_coding"],
        detectedDataTypes: ["customer_data", "legal_contract", "source_code", "production_logs"],
      },
    ],
    destinations: [
      destination("localhost-live-e2e", "Synthetic Local AI", "local_ai", ["localhost"], [`${baseUrl}/*`]),
      destination("chatgpt", "ChatGPT", "public_ai", ["chatgpt.com", "chat.openai.com"]),
      destination("claude", "Claude", "public_ai", ["claude.ai"]),
      destination("gemini", "Gemini", "public_ai", ["gemini.google.com"]),
      destination("perplexity", "Perplexity", "public_ai", ["perplexity.ai"]),
    ],
    emergencyLockdown: lockdownEnabled ? {
      enabled: true,
      reason: "Synthetic QA lockdown",
      allowOnlyEnterpriseDestinations: true,
      blockAllFileUploads: true,
      blockedDataTypes: ["api_key", "database_url", "password"],
      requireApprovalDataTypes: ["source_code"],
    } : undefined,
    updatedAt: new Date().toISOString(),
  };
}

function aiPage() {
  return `<!doctype html>
  <html><head><meta charset="utf-8"><title>Synthetic Local AI</title>
  <style>body{font-family:Arial,sans-serif;max-width:860px;margin:40px auto;padding:0 20px}textarea{width:100%;height:180px}button,input{margin-top:12px}.response-content{margin-top:20px;padding:16px;border:1px solid #ccc}</style>
  </head><body>
  <h1>Synthetic Local AI</h1>
  <form id="chat-form"><textarea id="prompt" aria-label="Prompt"></textarea><button id="send" type="submit" aria-label="Send prompt">Send</button></form>
  <input id="file" type="file">
  <div id="submitted-count">0</div><div id="response" class="response-content"></div>
  <script>
    let count=0;
    document.querySelector("#chat-form").addEventListener("submit",event=>{
      event.preventDefault();
      count+=1;
      document.querySelector("#submitted-count").textContent=String(count);
      document.querySelector("#response").textContent="Synthetic response update "+count;
    });
  </script></body></html>`;
}

function sourcePage() {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Synthetic Internal Source</title></head>
  <body><h1>Internal Test Source</h1><p id="source-text">Synthetic internal source customer email test@example.com and project Cedar notes.</p></body></html>`;
}

function unrelatedPage() {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Unrelated Site</title></head>
  <body><h1>Unrelated Local Documentation</h1><textarea aria-label="Feedback"></textarea><button>Submit</button></body></html>`;
}

function observePage(page, scope) {
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") consoleErrors.push({ scope, type: message.type(), text: message.text() });
  });
  page.on("pageerror", (error) => pageErrors.push({ scope, message: error.message }));
}

async function enrollAttempt(popup, code) {
  await popup.locator("[data-enrollment-code]").fill(code);
  await popup.locator("[data-api-base-url]").fill(baseUrl);
  await popup.locator("[data-enroll]").click();
  if (code !== "valid-synthetic-code") await popup.locator("[data-enrollment-error]:not([hidden])").waitFor();
}

async function iconAssetsResolve(page, extensionId) {
  return page.evaluate(async (id) => {
    for (const size of [16, 32, 48, 128]) {
      const response = await fetch(`chrome-extension://${id}/assets/icon-${size}.png`);
      if (!response.ok || !(await response.arrayBuffer()).byteLength) return false;
    }
    return true;
  }, extensionId);
}

async function dispatchPaste(page, text) {
  await page.locator("#prompt").focus();
  await page.locator("#prompt").evaluate((element, pastedText) => {
    const data = new DataTransfer();
    data.setData("text/plain", pastedText);
    element.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }));
  }, text);
}

async function overlaySnapshot(page) {
  const overlay = page.locator("[data-soter-overlay]");
  return {
    action: await overlay.locator(".value").first().innerText(),
    detected: await overlay.locator(".metric").nth(2).innerText(),
    text: await overlay.locator("textarea").inputValue(),
  };
}

async function dismissOverlay(page) {
  const overlay = page.locator("[data-soter-overlay]");
  if (await overlay.count()) await overlay.locator("button[data-action='dismiss']").click();
}

async function fileCase(page, name, mimeType, content, expectation) {
  await dismissOverlay(page);
  await page.locator("#file").setInputFiles({ name, mimeType, buffer: Buffer.from(content) });
  await page.waitForTimeout(500);
  const value = await page.locator("#file").inputValue();
  const overlayVisible = await page.locator("[data-soter-overlay]").count() === 1;
  const passed = expectation === "cleared"
    ? value === "" && overlayVisible
    : expectation === "overlay"
      ? overlayVisible
      : value !== "" && !overlayVisible;
  record(`File scanner ${name}`, passed, { expectation, inputValue: value, overlayVisible });
  if (overlayVisible) {
    await page.screenshot({ path: join(evidenceDir, `file-${name.replace(/[^a-z0-9]+/gi, "-")}.png`), fullPage: true });
    await dismissOverlay(page);
  }
}

async function promptLatency(page, text) {
  await dismissOverlay(page);
  await page.locator("#prompt").fill(text);
  const before = await submissionCount(page);
  const started = performance.now();
  await page.locator("#send").click();
  await Promise.race([
    waitForSubmissionCount(page, before + 1),
    page.locator("[data-soter-overlay]").waitFor(),
  ]);
  const elapsed = round(performance.now() - started);
  await dismissOverlay(page);
  return elapsed;
}

async function fileLatency(page, name, buffer) {
  await dismissOverlay(page);
  const started = performance.now();
  await page.locator("#file").setInputFiles({ name, mimeType: "text/plain", buffer });
  await page.waitForTimeout(100);
  const elapsed = round(performance.now() - started);
  await dismissOverlay(page);
  return elapsed;
}

async function attemptExternal(browserContext, name, url) {
  const page = await browserContext.newPage();
  observePage(page, name.toLowerCase());
  const started = performance.now();
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForTimeout(1500);
    const title = await page.title();
    const active = await page.locator("html[data-soter-active-domain='true']").count() === 1;
    const promptCount = await page.locator("textarea, [contenteditable='true'], [role='textbox']").count();
    const status = response?.status();
    record(`${name} external site reachable`, Boolean(response && status && status < 500), { status, title, active, promptCount, latencyMs: round(performance.now() - started) });
    record(`${name} extension content script active`, active, { status, title, promptCount });
    record(`${name} live prompt box available without account challenge`, promptCount > 0, { status, title, promptCount });
    await page.screenshot({ path: join(evidenceDir, `external-${name.toLowerCase()}.png`), fullPage: false });
  } catch (error) {
    record(`${name} external site reachable`, false, { error: error instanceof Error ? error.message : String(error) });
    record(`${name} extension content script active`, false, { blockedBy: "navigation failure" });
    record(`${name} live prompt box available without account challenge`, false, { blockedBy: "navigation failure" });
  } finally {
    await page.close();
  }
}

async function submissionCount(page) {
  return Number(await page.locator("#submitted-count").innerText());
}

async function waitForSubmissionCount(page, expected) {
  await page.waitForFunction((value) => Number(document.querySelector("#submitted-count")?.textContent) >= value, expected);
}

function ttlNearFifteenMinutes(context) {
  if (!context?.createdAt || !context?.expiresAt) return false;
  const ttl = new Date(context.expiresAt).getTime() - new Date(context.createdAt).getTime();
  return Math.abs(ttl - 15 * 60 * 1000) < 1000;
}

function record(name, passed, details = undefined) {
  results.push({ name, status: passed ? "PASS" : "FAIL", details });
}

function destination(destinationId, name, category, domains, urlPatterns = []) {
  return {
    id: destinationId,
    destinationId,
    organizationId: "org-synthetic",
    name,
    category,
    domains,
    urlPatterns,
    defaultRiskLevel: "high",
    riskLevel: "high",
    enabled: true,
    allowedDepartments: ["all"],
    allowedRoles: ["all"],
    policyOverrides: {},
    responseScanningEnabled: false,
    loggingMode: "metadata_only",
  };
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeText(text) {
  return text.normalize("NFKC").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().toLowerCase();
}

function chunkText(text, chunkSize = 900) {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const chunks = [];
  for (let index = 0; index < normalized.length; index += chunkSize) {
    const chunk = normalized.slice(index, index + chunkSize).trim();
    if (chunk.length >= 24) chunks.push(chunk);
  }
  return chunks.length ? chunks : [normalized];
}

function shingleText(text, nGram = 5) {
  const words = normalizeText(text).replace(/[^\p{L}\p{N}]+/gu, " ").split(/\s+/).filter(Boolean);
  if (words.length < nGram) return words.length ? [words.join(" ")] : [];
  const shingles = [];
  for (let index = 0; index <= words.length - nGram; index += 1) shingles.push(words.slice(index, index + nGram).join(" "));
  return shingles;
}

function readBody(request) {
  return new Promise((resolveBody) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => resolveBody(body));
  });
}

function safeJson(value) {
  try { return JSON.parse(value); } catch { return undefined; }
}

function json(response, status, value) {
  response.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" });
  response.end(JSON.stringify(value));
}

function html(response, value) {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(value);
}

function round(value) {
  return Math.round(value * 10) / 10;
}
