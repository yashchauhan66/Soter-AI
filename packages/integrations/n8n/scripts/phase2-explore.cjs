/* Phase 2 exploration: reach the canvas, open the node creator, and dump enough
 * of the live editor's DOM to pin selectors for the full verification pass. */
const path = require("path");
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require("@playwright/test")); }

const BASE = process.env.N8N_URL || "http://localhost:5699";
const SHOTS = path.resolve(__dirname, "..", "artifacts", "phase2");

const log = (...a) => console.log("[explore]", ...a);

async function completeSetupIfPresent(page) {
  // With owner-setup on first load, fill the form; otherwise no-op.
  const email = page.locator('input[type="email"], input[name="email"]').first();
  if (await email.count().catch(() => 0)) {
    if (await email.isVisible().catch(() => false)) {
      log("owner setup screen present — filling");
      await email.fill("verify@example.com");
      const first = page.locator('input[name="firstName"]').first();
      const last = page.locator('input[name="lastName"]').first();
      const pass = page.locator('input[type="password"]').first();
      if (await first.count()) await first.fill("Verify");
      if (await last.count()) await last.fill("User");
      if (await pass.count()) await pass.fill("Verify1234!");
      await page.screenshot({ path: path.join(SHOTS, "00-setup.png") });
      // "Next" submits the owner form.
      const next = page.getByRole("button", { name: /next|continue|get started/i }).first();
      if (await next.count()) await next.click().catch(() => {});
      await page.waitForTimeout(2500);
    }
  }
  // Survey / "customize" step — skip whatever appears.
  for (const label of [/skip/i, /get started/i, /continue/i]) {
    const b = page.getByRole("button", { name: label }).first();
    if (await b.count().catch(() => 0) && (await b.isVisible().catch(() => false))) {
      await b.click().catch(() => {});
      await page.waitForTimeout(1200);
    }
  }
}

(async () => {
  const launchOpts = { headless: true };
  if (process.env.PW_CHROME) launchOpts.executablePath = process.env.PW_CHROME;
  const browser = await chromium.launch(launchOpts);
  const context = await browser.newContext({ viewport: { width: 1500, height: 950 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  page.on("pageerror", (e) => log("pageerror:", e.message));

  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  await completeSetupIfPresent(page);

  // Land on a workflow. New-workflow URL avoids any project dashboard.
  await page.goto(BASE + "/workflow/new", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SHOTS, "01-canvas-empty.png") });
  log("URL after setup:", page.url());

  // Open the node creator. Try the known trigger test-ids, then a keyboard Tab.
  const triggers = [
    '[data-test-id="canvas-add-button"]',
    '[data-test-id="node-creator-plus-button"]',
    'button[aria-label*="Add" i]',
  ];
  let opened = false;
  for (const sel of triggers) {
    const el = page.locator(sel).first();
    if (await el.count().catch(() => 0)) {
      await el.click().catch(() => {});
      await page.waitForTimeout(1500);
      opened = true;
      log("opened creator via", sel);
      break;
    }
  }
  if (!opened) {
    await page.keyboard.press("Tab").catch(() => {});
    await page.waitForTimeout(1500);
  }

  // Search for the node.
  const search = page.locator('[data-test-id="node-creator-search-bar"] input, input[placeholder*="Search" i]').first();
  if (await search.count().catch(() => 0)) {
    await search.fill("SoterAI");
    await page.waitForTimeout(1800);
    await page.screenshot({ path: path.join(SHOTS, "02-node-creator-search.png") });
    // Dump visible item text so we can see the node + its actions.
    const items = await page.locator('[data-test-id="node-creator-item-name"], [class*="itemName"], [class*="nodeName"]').allInnerTexts().catch(() => []);
    log("creator items:", JSON.stringify(items.slice(0, 30)));
  } else {
    log("NO search bar found");
  }

  // Click the SoterAI result to reveal its actions.
  const soter = page.getByText(/^SoterAI$/).first();
  if (await soter.count().catch(() => 0)) {
    await soter.click().catch(() => {});
    await page.waitForTimeout(1800);
    await page.screenshot({ path: path.join(SHOTS, "03-node-creator-actions.png") });
    const actions = await page.locator('[data-test-id="node-creator-item-name"], [class*="itemName"]').allInnerTexts().catch(() => []);
    log("actions under SoterAI:", JSON.stringify(actions.slice(0, 40)));
  } else {
    log("SoterAI result not found by exact text");
  }

  await browser.close();
  log("done — screenshots in", SHOTS);
})().catch((e) => { console.error("EXPLORE FAILED:", e); process.exit(1); });
