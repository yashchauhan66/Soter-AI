const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: false,
    channel: "chrome",
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto("http://localhost:5678/home/workflows", { waitUntil: "domcontentloaded" });
  console.log("LOGIN_NOW");

  for (let i = 0; i < 600; i++) {
    await page.waitForTimeout(1000);
    const url = page.url();
    if (!url.includes("/signin")) {
      await page.waitForTimeout(3000);
      await context.storageState({ path: ".tmp/n8n-video/auth-state.json" });
      console.log(`AUTH_STATE_SAVED ${page.url()}`);
      await browser.close();
      return;
    }
  }

  throw new Error("Timed out waiting for sign in.");
})();
