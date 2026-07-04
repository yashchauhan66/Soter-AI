const { chromium } = require("@playwright/test");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

  await page.goto("http://localhost:5678/setup", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  await page.getByLabel("Email").fill("demo@soterai.local");
  await page.getByLabel("First Name").fill("SoterAI");
  await page.getByLabel("Last Name").fill("Demo");
  await page.getByLabel("Password").fill("SoterAI-Demo-2026");

  const updates = page.getByLabel("I want to receive security and product updates");
  if (await updates.isVisible().catch(() => false)) {
    if (await updates.isChecked().catch(() => false)) await updates.uncheck();
  }

  await page.getByRole("button", { name: /next/i }).click();
  await page.waitForTimeout(8000);

  console.log("url", page.url());
  console.log((await page.locator("body").innerText()).slice(0, 2000));
  await page.screenshot({ path: ".tmp/n8n-owner-created.png", fullPage: true });
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
