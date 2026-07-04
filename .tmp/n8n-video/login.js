const { chromium } = require("playwright");

(async () => {
  const context = await chromium.launchPersistentContext(
    ".tmp/n8n-video/profile2",
    {
      headless: false,
      channel: "chrome",
      viewport: { width: 1440, height: 900 },
    },
  );
  const page = context.pages()[0] || (await context.newPage());
  await page.goto("http://localhost:5678", { waitUntil: "domcontentloaded" });
  await page.locator('input[type="password"]').waitFor({ timeout: 30_000 });
  console.log("LOGIN_NOW");
  await page
    .locator('input[type="password"]')
    .waitFor({ state: "detached", timeout: 600_000 });
  await page.waitForTimeout(5_000);
  console.log(`LOGIN_SUCCESS ${page.url()}`);
  await context.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
