/* Focused screenshot pass: open the NDV for Guard Input, Universal Firewall and
 * Check Tool Call and capture the parameter panel itself (not the whole canvas),
 * so the Phase 2 deliverable screenshots show the actual v3 panels. */
const path = require("path");
let chromium;
try { ({ chromium } = require("playwright")); } catch { ({ chromium } = require("@playwright/test")); }

const BASE = process.env.N8N_URL || "http://localhost:5699";
const SHOTS = path.resolve(__dirname, "..", "artifacts", "phase2");
const EMAIL = "verify@example.com";
const PASSWORD = "Verify1234!";

async function login(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
  const email = page.locator('input[type="email"], input[name="email"]').first();
  if (await email.count().catch(() => 0) && await email.isVisible().catch(() => false)) {
    await email.fill(EMAIL);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    const first = page.locator('input[name="firstName"]').first();
    if (await first.count().catch(() => 0) && await first.isVisible().catch(() => false)) {
      await first.fill("Verify");
      const last = page.locator('input[name="lastName"]').first();
      if (await last.count()) await last.fill("User");
    }
    await page.getByRole("button", { name: /next|sign in|log ?in/i }).first().click().catch(() => {});
    await page.waitForTimeout(2500);
  }
}

async function shotNdv(page, name) {
  const ndv = page.locator('[data-test-id="ndv"], [data-test-id="ndv-wrapper"], .ndv-wrapper, [class*="ndv" i]').first();
  if (await ndv.count().catch(() => 0) && await ndv.isVisible().catch(() => false)) {
    await ndv.screenshot({ path: path.join(SHOTS, name) }).catch(() => page.screenshot({ path: path.join(SHOTS, name) }));
  } else {
    await page.screenshot({ path: path.join(SHOTS, name) });
  }
}

async function choose(page, param, label) {
  const wrap = page.locator(`[data-test-id="parameter-input-${param}"]`).first();
  if (!(await wrap.count().catch(() => 0))) return;
  await wrap.click().catch(() => {});
  await page.waitForTimeout(800);
  const opt = page.locator('.el-select-dropdown__item:visible, li:visible').filter({ hasText: label }).first();
  if (await opt.count().catch(() => 0)) await opt.click().catch(() => {});
  await page.waitForTimeout(1500);
}

(async () => {
  const opts = { headless: true };
  if (process.env.PW_CHROME) opts.executablePath = process.env.PW_CHROME;
  const browser = await chromium.launch(opts);
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await ctx.newPage();
  await login(page);
  await page.goto(BASE + "/workflow/new", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);

  // Add the node (defaults to Guardrail → Guard Input).
  for (const sel of ['[data-test-id="canvas-add-button"]', 'button[aria-label*="Add" i]']) {
    const el = page.locator(sel).first();
    if (await el.count().catch(() => 0)) { await el.click().catch(() => {}); break; }
  }
  await page.waitForTimeout(1000);
  await page.locator('[data-test-id="node-creator-search-bar"] input, input[placeholder*="Search" i]').first().fill("SoterAI");
  await page.waitForTimeout(1500);
  await page.getByText(/^SoterAI$/).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  await page.getByText("Check user input for threats", { exact: false }).first().click().catch(() => {});
  await page.waitForTimeout(2500);
  await shotNdv(page, "panel-guard-input.png");

  await choose(page, "operation", "Universal Firewall");
  await shotNdv(page, "panel-universal-firewall.png");

  await choose(page, "resource", "Agent Passport");
  await choose(page, "operation", "Check Tool Call");
  await shotNdv(page, "panel-check-tool-call.png");

  await browser.close();
  console.log("panel screenshots written to", SHOTS);
})().catch((e) => { console.error("SHOTS FAILED:", e && e.message); process.exit(1); });
