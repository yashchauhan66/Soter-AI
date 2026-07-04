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

  // Delete the invalid downstream "Message a model" node so the workflow can execute to SoterAI.
  await page.mouse.move(1006, 466);
  await page.waitForTimeout(500);
  await page.mouse.click(1006, 466);
  await page.waitForTimeout(500);
  await page.mouse.click(1005, 369);
  await page.waitForTimeout(1000);

  // Save workflow if the editor shows unsaved changes.
  await page.keyboard.press("Control+S");
  await page.waitForTimeout(3000);

  // Verify chat execution can now start.
  await page.getByRole("button", { name: "Open chat" }).last().click().catch(async () => {});
  await page.waitForTimeout(1500);
  const textarea = page.locator("textarea:visible").last();
  await textarea.fill("Write a short customer support reply for a delayed order.");
  await page.locator('[data-test-id="send-message-button"]').click().catch(async () => {
    await page.keyboard.press("Enter");
  });
  await page.waitForTimeout(18000);
  console.log((await page.locator("body").innerText()).slice(0, 12000));
  await page.screenshot({ path: ".tmp/n8n-video/prepared-real-workflow-run.png", fullPage: true });
  await browser.close();
})();
