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
  await page.locator('[data-test-id="credential-edit-button"]').click().catch(async () => {});
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "Save" }).click().catch(async () => {});
  await page.waitForTimeout(2000);
  await page.keyboard.press("Escape").catch(async () => {});
  await page.waitForTimeout(1000);
  await page.locator('[data-test-id="ndv-close-button"]').click().catch(async () => {});
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "Open chat" }).last().click();
  await page.waitForTimeout(2000);
  const ta = page.locator("textarea:visible").last();
  await ta.fill("Write a short customer support reply for a delayed order.");
  await page.locator('[data-test-id="send-message-button"]').click().catch(async () => {
    await page.keyboard.press("Enter");
  });
  await page.waitForTimeout(15000);
  console.log("BODY AFTER SAFE");
  console.log((await page.locator("body").innerText()).slice(0, 10000));
  await page.screenshot({ path: ".tmp/n8n-video/real-chat-safe-run.png", fullPage: true });
  await page.mouse.dblclick(686, 466);
  await page.waitForTimeout(2000);
  console.log("BODY NODE");
  console.log((await page.locator("body").innerText()).slice(0, 10000));
  await page.screenshot({ path: ".tmp/n8n-video/real-chat-soter-output.png", fullPage: true });
  await browser.close();
})();
