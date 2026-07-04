const { chromium } = require("playwright");

(async () => {
  const context = await chromium.launchPersistentContext(".tmp/n8n-video/profile2", {
    headless: false,
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
  });
  const page = context.pages()[0] || (await context.newPage());
  await page.goto("http://localhost:5678/home/workflows", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  console.log("URL", page.url());
  console.log("TITLE", await page.title());
  const text = await page.locator("body").innerText({ timeout: 5000 }).catch((error) => `ERR ${error.message}`);
  console.log(text.slice(0, 4000));
  await page.screenshot({ path: ".tmp/n8n-video/probe-ui.png", fullPage: true });
  await context.close();
})();
