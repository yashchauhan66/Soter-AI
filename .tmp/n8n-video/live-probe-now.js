const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: ".tmp/n8n-video/auth-state.json",
    viewport: { width: 1600, height: 900 },
  });
  const page = await context.newPage();
  await page.goto("http://localhost:5678/home/workflows", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(5000);
  console.log("URL", page.url());
  console.log((await page.locator("body").innerText().catch((error) => `ERR ${error.message}`)).slice(0, 5000));
  await page.screenshot({ path: ".tmp/n8n-video/live-probe-now.png", fullPage: true });
  await browser.close();
})();
