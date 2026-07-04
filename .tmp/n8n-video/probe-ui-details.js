const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: ".tmp/n8n-video/auth-state.json",
    viewport: { width: 1600, height: 900 },
  });
  const page = await context.newPage();
  await page.goto("http://localhost:5678/home/workflows", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  console.log("BODY", (await page.locator("body").innerText()).slice(0, 4000));
  const links = await page.locator("a").evaluateAll((els) =>
    els.map((a) => ({ text: a.textContent?.trim(), href: a.href })).filter((x) => x.text || x.href),
  );
  console.log("LINKS", JSON.stringify(links, null, 2).slice(0, 8000));
  const buttons = await page.locator("button").evaluateAll((els) =>
    els.map((b) => ({ text: b.textContent?.trim(), aria: b.getAttribute("aria-label"), title: b.getAttribute("title") })).filter((x) => x.text || x.aria || x.title),
  );
  console.log("BUTTONS", JSON.stringify(buttons, null, 2).slice(0, 8000));
  await browser.close();
})();
