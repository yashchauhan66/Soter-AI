const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: false, channel: "chrome" });
  const context = await browser.newContext({
    storageState: ".tmp/n8n-video/auth-state.json",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.goto("http://localhost:5678/home/workflows", { waitUntil: "domcontentloaded" });
  await page.locator('[data-test-id="workflow-card-name"]').first().click();
  await page.waitForTimeout(10000);
  console.log("URL", page.url());
  console.log((await page.locator("body").innerText()).slice(0, 5000));
  await page.screenshot({ path: ".tmp/n8n-video/workflow-open.png", fullPage: true });
  await browser.close();
})();
