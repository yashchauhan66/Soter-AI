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
  const buttons = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button, [role=button], input, textarea")).map((el, i) => ({
      i,
      tag: el.tagName,
      text: (el.innerText || el.value || "").trim().slice(0, 80),
      title: el.getAttribute("title"),
      aria: el.getAttribute("aria-label"),
      test: el.getAttribute("data-test-id"),
      cls: el.className,
      rect: (() => {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      })(),
    })),
  );
  console.log(JSON.stringify(buttons, null, 2));
  await browser.close();
})();
