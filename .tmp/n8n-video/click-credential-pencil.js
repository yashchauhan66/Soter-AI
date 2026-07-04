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
  for (const [x, y] of [[908, 151], [906, 150], [910, 151], [905, 152]]) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(500);
    await page.mouse.click(x, y);
    await page.waitForTimeout(2000);
    console.log("clicked", x, y, page.url(), (await page.locator("body").innerText()).slice(0, 2000));
    await page.screenshot({ path: `.tmp/n8n-video/pencil-${x}-${y}.png`, fullPage: true });
  }
  await browser.close();
})();
