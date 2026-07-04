const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: false, channel: "chrome" });
  const context = await browser.newContext({
    storageState: ".tmp/n8n-video/auth-state.json",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.goto("http://localhost:5678/workflow/pAfHWUWJYF1GX34y", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  await page.keyboard.press("Escape").catch(() => {});
  await page.mouse.click(20, 21);
  await page.waitForTimeout(2000);
  console.log("--- AFTER ADD CLICK ---");
  console.log((await page.locator("body").innerText()).slice(0, 5000));

  for (const term of ["chat trigger", "soterai", "ollama", "openai", "ai agent", "basic llm", "chat model"]) {
    await page.keyboard.press("Control+A").catch(() => {});
    await page.keyboard.type(term);
    await page.waitForTimeout(2500);
    const text = await page.locator("body").innerText().catch(() => "");
    console.log(`\n--- SEARCH ${term} ---\n${text.slice(0, 5000)}`);
    await page.screenshot({ path: `.tmp/n8n-video/add-search-${term.replace(/\s+/g, "-")}.png`, fullPage: true });
  }
  await browser.close();
})();
