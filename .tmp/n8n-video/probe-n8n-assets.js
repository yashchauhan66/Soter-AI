const { chromium } = require("playwright");

async function dumpPage(page, path, label) {
  await page.waitForTimeout(5000);
  const text = await page.locator("body").innerText().catch((error) => String(error));
  console.log(`\n--- ${label} ${page.url()} ---\n${text.slice(0, 8000)}`);
  await page.screenshot({ path, fullPage: true });
}

(async () => {
  const browser = await chromium.launch({ headless: false, channel: "chrome" });
  const context = await browser.newContext({
    storageState: ".tmp/n8n-video/auth-state.json",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  await page.goto("http://localhost:5678/home/workflows", { waitUntil: "domcontentloaded" });
  await dumpPage(page, ".tmp/n8n-video/assets-home.png", "HOME");

  await page.getByText("Credentials", { exact: true }).click().catch(async () => {
    await page.goto("http://localhost:5678/home/credentials", { waitUntil: "domcontentloaded" });
  });
  await dumpPage(page, ".tmp/n8n-video/assets-credentials.png", "CREDENTIALS");

  await page.goto("http://localhost:5678/workflow/pAfHWUWJYF1GX34y", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  await page.mouse.click(1406, 98);
  await page.waitForTimeout(3000);
  const bodyBefore = await page.locator("body").innerText().catch(() => "");
  console.log(`\n--- ADD PANEL BEFORE SEARCH ---\n${bodyBefore.slice(0, 4000)}`);

  for (const term of ["chat trigger", "openai", "ollama", "gemini", "basic llm", "ai agent", "soterai"]) {
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
    await page.keyboard.type(term);
    await page.waitForTimeout(2500);
    const text = await page.locator("body").innerText().catch(() => "");
    console.log(`\n--- NODE SEARCH: ${term} ---\n${text.slice(0, 3000)}`);
    await page.screenshot({ path: `.tmp/n8n-video/node-search-${term.replace(/\s+/g, "-")}.png`, fullPage: true });
  }

  await browser.close();
})();
