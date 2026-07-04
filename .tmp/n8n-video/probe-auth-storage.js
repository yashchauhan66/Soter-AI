const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: ".tmp/n8n-video/auth-state.json",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.goto("http://localhost:5678/home/workflows", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const data = await page.evaluate(() => ({
    localStorage: Object.fromEntries(Object.entries(localStorage)),
    sessionStorage: Object.fromEntries(Object.entries(sessionStorage)),
    cookies: document.cookie,
  }));
  console.log(JSON.stringify(data, null, 2).slice(0, 12000));
  await browser.close();
})();
