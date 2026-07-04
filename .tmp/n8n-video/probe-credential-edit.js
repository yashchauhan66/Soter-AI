const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: false, channel: "chrome" });
  const context = await browser.newContext({
    storageState: ".tmp/n8n-video/auth-state.json",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.goto("http://localhost:5678/workflow/pAfHWUWJYF1GX34y/a6e806", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  await page.mouse.click(907, 151);
  await page.waitForTimeout(6000);
  console.log("URL", page.url());
  console.log((await page.locator("body").innerText()).slice(0, 8000));
  await page.screenshot({ path: ".tmp/n8n-video/credential-edit.png", fullPage: true });
  await browser.close();
})();
