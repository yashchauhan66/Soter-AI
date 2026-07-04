const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: false, channel: "chrome" });
  const context = await browser.newContext({
    storageState: ".tmp/n8n-video/auth-state.json",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.goto("http://localhost:5678/workflow/pAfHWUWJYF1GX34y", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  await page.mouse.dblclick(686, 466);
  await page.waitForTimeout(2000);
  await page.locator('[data-test-id="credential-edit-button"]').click().catch(async () => {
    await page.mouse.click(894, 150);
  });
  await page.waitForTimeout(3000);
  const inputs = page.locator('input[data-test-id="parameter-input-field"]:visible');
  const count = await inputs.count();
  for (let i = 0; i < count; i++) {
    const input = inputs.nth(i);
    const type = await input.getAttribute("type");
    const value = await input.inputValue();
    if (type !== "password" && /^https?:\/\//.test(value)) {
      await input.fill("https://soterai.in");
      break;
    }
  }
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Retry" }).click().catch(async () => {});
  await page.waitForTimeout(6000);
  console.log((await page.locator("body").innerText()).slice(0, 6000));
  await page.screenshot({ path: ".tmp/n8n-video/real-credential-url.png", fullPage: true });
  await browser.close();
})();
