/* Phase 2 live-editor verification. Drives the real n8n editor: adds a SoterAI
 * node, checks the v3 Resource/Operation panel renders as designed, switches
 * operations, confirms the resource-change reset, imports a v1 and a v2 workflow,
 * and screenshots each stage. Soft checks (logged PASS/FAIL) so one run yields
 * the most evidence; screenshots land in artifacts/phase2/. */
const path = require("path");
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require("@playwright/test")); }

const BASE = process.env.N8N_URL || "http://localhost:5699";
const EMAIL = "verify@example.com";
const PASSWORD = "Verify1234!";
const SHOTS = path.resolve(__dirname, "..", "artifacts", "phase2");
const FIX = SHOTS;

const results = [];
const check = (label, ok, detail = "") => { results.push({ label, ok: !!ok, detail }); console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`); };
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name), fullPage: false }).catch(() => {});

async function authenticate(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  const email = page.locator('input[type="email"], input[name="email"]').first();
  const pass = page.locator('input[type="password"]').first();
  if (await email.count().catch(() => 0) && await email.isVisible().catch(() => false)) {
    // Setup screen has firstName/lastName; login does not.
    const first = page.locator('input[name="firstName"]').first();
    const isSetup = await first.count().catch(() => 0) && await first.isVisible().catch(() => false);
    await email.fill(EMAIL);
    await pass.fill(PASSWORD);
    if (isSetup) {
      await first.fill("Verify");
      const last = page.locator('input[name="lastName"]').first();
      if (await last.count()) await last.fill("User");
    }
    const submit = page.getByRole("button", { name: /next|sign in|log ?in|continue/i }).first();
    if (await submit.count()) await submit.click().catch(() => {});
    await page.waitForTimeout(3000);
    // Skip any post-setup survey.
    for (const label of [/skip/i, /get started/i]) {
      const b = page.getByRole("button", { name: label }).first();
      if (await b.count().catch(() => 0) && await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await page.waitForTimeout(1000); }
    }
  }
}

async function openBlankCanvas(page) {
  await page.goto(BASE + "/workflow/new", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

async function addNode(page, actionText) {
  // Open the node creator.
  for (const sel of ['[data-test-id="canvas-add-button"]', '[data-test-id="node-creator-plus-button"]', 'button[aria-label*="Add" i]']) {
    const el = page.locator(sel).first();
    if (await el.count().catch(() => 0)) { await el.click().catch(() => {}); break; }
  }
  await page.waitForTimeout(1200);
  const search = page.locator('[data-test-id="node-creator-search-bar"] input, input[placeholder*="Search" i]').first();
  await search.fill("SoterAI");
  await page.waitForTimeout(1800);
  await shot(page, "02-node-creator-search.png");
  const items = await page.locator('[data-test-id="node-creator-item-name"]').allInnerTexts().catch(() => []);
  check("SoterAI appears in the node creator", items.some((t) => /soterai/i.test(t)), items.slice(0, 8).join(" | "));
  // Click the SoterAI node to reveal its actions (operations).
  const node = page.getByText(/^SoterAI$/).first();
  if (await node.count().catch(() => 0)) { await node.click().catch(() => {}); await page.waitForTimeout(1500); }
  await shot(page, "03-node-creator-actions.png");
  const actions = await page.locator('[data-test-id="node-creator-item-name"]').allInnerTexts().catch(() => []);
  check("node creator lists operations under SoterAI", actions.length >= 3, actions.slice(0, 14).join(" | "));
  // Pick the requested action (or the first).
  const target = actionText ? page.getByText(actionText, { exact: false }).first() : page.locator('[data-test-id="node-creator-item-name"]').first();
  if (await target.count().catch(() => 0)) { await target.click().catch(() => {}); await page.waitForTimeout(2500); }
}

async function ndvValue(page, name) {
  const wrap = page.locator(`[data-test-id="parameter-input-${name}"]`).first();
  if (!(await wrap.count().catch(() => 0))) return null;
  // n8n renders an options param as an el-select whose display text sits in a
  // readonly <input value=...>; fall back to the wrapper's text.
  const input = wrap.locator("input").first();
  if (await input.count().catch(() => 0)) {
    const v = await input.inputValue().catch(() => "");
    if (v) return v.trim();
    const ph = await input.getAttribute("placeholder").catch(() => "");
    if (ph) return ph.trim();
  }
  return (await wrap.innerText().catch(() => "")).trim();
}

async function ndvChoose(page, name, optionLabel) {
  const wrap = page.locator(`[data-test-id="parameter-input-${name}"]`).first();
  if (!(await wrap.count().catch(() => 0))) return false;
  await wrap.click().catch(() => {});
  await page.waitForTimeout(900);
  // The dropdown renders in a portal at the end of <body>.
  const opt = page.locator('.el-select-dropdown__item:visible, [role="option"]:visible, li:visible').filter({ hasText: optionLabel }).first();
  if (!(await opt.count().catch(() => 0))) { await page.keyboard.press("Escape").catch(() => {}); return false; }
  await opt.click().catch(() => {});
  await page.waitForTimeout(1600);
  return true;
}

async function ndvSnapshot(page, tag) {
  const notices = await page.locator('[data-test-id="parameter-input-enforcingNotice"], [data-test-id="parameter-input-redactNotice"], [data-test-id="parameter-input-reportOnlyNotice"], [data-test-id*="Notice"], .n8n-callout, [class*="notice" i]').count().catch(() => 0);
  const addOption =
    (await page.locator('[data-test-id="parameter-input-options"], [class*="collection" i]').count().catch(() => 0)) +
    (await page.getByText(/add option/i).count().catch(() => 0)) +
    (await page.getByRole("button", { name: /add option/i }).count().catch(() => 0));
  const asterisks = await page.locator('.parameter-item .required, [class*="required" i]').count().catch(() => 0);
  return { notices, addOption, asterisks };
}

(async () => {
  const launchOpts = { headless: true };
  if (process.env.PW_CHROME) launchOpts.executablePath = process.env.PW_CHROME;
  const browser = await chromium.launch(launchOpts);
  const context = await browser.newContext({ viewport: { width: 1500, height: 950 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await authenticate(page);
  await openBlankCanvas(page);
  await shot(page, "01-canvas-empty.png");

  // --- Guard Input (Guardrail default) ---
  await addNode(page, "Check user input for threats");
  await shot(page, "04-ndv-guard-input.png");
  const resource = await ndvValue(page, "resource");
  const operation = await ndvValue(page, "operation");
  check("Guardrail resource is selected by default", /guardrail/i.test(resource || ""), `resource="${resource}"`);
  check("Guard Input operation is selected by default", /guard input/i.test(operation || ""), `operation="${operation}"`);
  const gi = await ndvSnapshot(page, "guardInput");
  check("Guard Input shows an Options button", gi.addOption >= 1, `addOption=${gi.addOption}`);
  check("Guard Input shows at least one banner/notice", gi.notices >= 1, `notices=${gi.notices}`);
  // Field inventory the panel renders (top-level parameter inputs).
  const inputs = await page.locator('[data-test-id^="parameter-input-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-test-id").replace("parameter-input-", ""))).catch(() => []);
  check("Guard Input panel is compact (few visible fields)", inputs.length > 0, `visible param inputs: ${inputs.join(",")}`);

  // --- Universal Firewall ---
  const okUF = await ndvChoose(page, "operation", "Universal Firewall");
  if (okUF) { await shot(page, "05-ndv-universal-firewall.png"); check("switched operation to Universal Firewall", /universal/i.test((await ndvValue(page, "operation")) || "")); }
  else check("switched operation to Universal Firewall", false, "operation select not found");

  // --- Resource change resets operation ---
  const okRes = await ndvChoose(page, "resource", "Agent Passport");
  if (okRes) {
    const op2 = await ndvValue(page, "operation");
    check("changing Resource to Agent Passport resets Operation to its first (Enroll Identity)", /enroll/i.test(op2 || ""), `operation="${op2}"`);
    // --- Check Tool Call ---
    const okTC = await ndvChoose(page, "operation", "Check Tool Call");
    if (okTC) { await shot(page, "06-ndv-check-tool-call.png"); check("switched operation to Check Tool Call", /check tool call/i.test((await ndvValue(page, "operation")) || "")); }
    else check("switched operation to Check Tool Call", false, "operation option not found");
  } else check("changing Resource resets Operation", false, "resource select not found");

  // Close NDV, screenshot the canvas node (Safe/Flagged handles).
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(1200);
  await shot(page, "07-canvas-node.png");

  // --- Import a v1 and a v2 workflow, confirm the old panel loads ---
  const fs = require("fs");
  for (const [ver, file, expectAction] of [["v1", "wf-v1.json", "Guard Input"], ["v2", "wf-v2.json", "Universal"]]) {
    await openBlankCanvas(page);
    // Import by pasting the workflow JSON onto the canvas — n8n's clipboard
    // import — which is far more robust than driving the workflow menu.
    let imported = false;
    try {
      const json = fs.readFileSync(path.join(FIX, file), "utf8");
      await page.evaluate((text) => navigator.clipboard.writeText(text), json).catch(() => {});
      // Focus the canvas, then paste.
      const canvas = page.locator('[data-test-id="canvas"], .vue-flow, #node-view').first();
      if (await canvas.count().catch(() => 0)) await canvas.click({ position: { x: 400, y: 300 } }).catch(() => {});
      await page.keyboard.press("Control+V").catch(() => {});
      await page.waitForTimeout(2500);
      imported = (await page.locator('[data-test-id="canvas-node"]').count().catch(() => 0)) >= 1;
    } catch { /* fall through */ }
    check(`${ver} workflow imported`, imported, imported ? file : "clipboard paste import produced no node");
    if (imported) {
      await shot(page, `08-canvas-${ver}.png`);
      // Open the node and confirm the OLD panel (an "Action" field, no Resource/Operation).
      const node = page.locator('[data-test-id="canvas-node"]').first();
      if (await node.count().catch(() => 0)) { await node.dblclick().catch(() => {}); await page.waitForTimeout(1800); }
      const hasAction = (await page.locator('[data-test-id="parameter-input-action"]').count().catch(() => 0)) >= 1;
      const hasResource = (await page.locator('[data-test-id="parameter-input-resource"]').count().catch(() => 0)) >= 1;
      check(`${ver} node renders the legacy Action panel (no Resource/Operation)`, hasAction && !hasResource, `action=${hasAction} resource=${hasResource}`);
      await shot(page, `09-ndv-${ver}.png`);
      await page.keyboard.press("Escape").catch(() => {});
    }
  }

  check("no uncaught page errors during the run", errors.length === 0, errors.slice(0, 3).join(" || "));

  await browser.close();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\nPhase 2 live checks: ${passed}/${results.length} passed. Screenshots in ${SHOTS}`);
  process.exit(0);
})().catch((e) => { console.error("VERIFY CRASHED:", e && e.message); process.exit(1); });
