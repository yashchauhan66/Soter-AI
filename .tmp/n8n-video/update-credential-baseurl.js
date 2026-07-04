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
  await page.locator('[data-test-id="credential-edit-button"]').click();
  await page.waitForTimeout(3000);
  await page.mouse.click(760, 470);
  await page.keyboard.press("Control+A");
  await page.keyboard.type("http://host.docker.internal:8787");
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "Retry" }).click().catch(async () => {
    await page.mouse.click(1150, 277);
  });
  await page.waitForTimeout(5000);
  console.log((await page.locator("body").innerText()).slice(0, 6000));
  await page.screenshot({ path: ".tmp/n8n-video/credential-updated.png", fullPage: true });
  await browser.close();
})();
