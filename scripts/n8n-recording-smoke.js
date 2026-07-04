const { chromium } = require("@playwright/test");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function login(page) {
  await page.goto("http://localhost:5678/signin", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill("demo@soterai.local");
  await page.getByLabel("Password").fill("SoterAI-Demo-2026");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForTimeout(5000);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await login(page);

  await page.goto("http://localhost:5678/workflow/new", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  await page.locator('[data-test-id="canvas-plus-button"]').click({ force: true });
  await page.waitForTimeout(2500);
  console.log("after plus", (await page.locator("body").innerText()).slice(0, 2000));
  await page.getByText("Trigger manually", { exact: true }).click({ force: true });
  await page.waitForTimeout(4000);
  await page.locator('[data-test-id="node-creator-plus-button"]').click({ force: true });
  await page.waitForTimeout(2000);
  await page.keyboard.type("SoterAI", { delay: 80 });
  await page.waitForTimeout(3000);
  console.log("after action search", (await page.locator("body").innerText()).slice(0, 5000));
  await page.screenshot({ path: ".tmp/recording-smoke-search.png", fullPage: true });

  await page.goto("http://localhost:5678/workflow/soteraiRealDemo01", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  await page.getByRole("button", { name: /^execute workflow$/i }).first().click({ force: true });
  await page.waitForTimeout(25000);
  for (const [name, x, y] of [
    ["SoterAI Safe Input Guard", 637, 505],
    ["SoterAI Prompt Injection Guard", 637, 792],
    ["SoterAI PII Redactor", 1268, 505],
    ["SoterAI Output Guard", 1268, 792],
    ["SoterAI Empty Input Error", 1730, 505],
  ]) {
    await page.mouse.move(x, y, { steps: 10 });
    await page.mouse.click(x, y);
    await wait(3000);
    console.log("\nNODE", name);
    console.log((await page.locator("body").innerText()).slice(0, 3000));
    await page.screenshot({ path: `.tmp/recording-smoke-${name.replace(/[^a-z0-9]+/gi, "-")}.png`, fullPage: true });
  }

  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
