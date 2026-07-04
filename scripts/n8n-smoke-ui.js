const { chromium } = require("@playwright/test");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto("http://localhost:5678", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  if (page.url().includes("/signin")) {
    await page.getByLabel("Email").fill("demo@soterai.local");
    await page.getByLabel("Password").fill("SoterAI-Demo-2026");
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await page.waitForTimeout(6000);
  }
  await page.goto("http://localhost:5678/workflow/soteraiRealDemo01", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(10000);
  const executeButton = page.getByRole("button", { name: /^execute workflow$/i }).first();
  if (await executeButton.isVisible().catch(() => false)) {
    await executeButton.click({ force: true });
    await page.waitForTimeout(25000);
  }
  console.log("url", page.url());
  console.log((await page.locator("body").innerText()).slice(0, 3000));
  await page.screenshot({ path: ".tmp/n8n-real-demo-workflow.png", fullPage: true });
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
