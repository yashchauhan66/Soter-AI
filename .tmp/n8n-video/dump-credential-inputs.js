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
  await page.mouse.click(906, 150);
  await page.waitForTimeout(1000);
  await page.mouse.click(906, 150);
  await page.waitForTimeout(4000);
  const inputs = await page.evaluate(() =>
    Array.from(document.querySelectorAll("input, textarea, button")).map((el, i) => {
      const r = el.getBoundingClientRect();
      return {
        i,
        tag: el.tagName,
        type: el.getAttribute("type"),
        text: (el.innerText || "").trim(),
        value: el.getAttribute("type") === "password" ? "[MASKED]" : el.value || "",
        title: el.getAttribute("title"),
        aria: el.getAttribute("aria-label"),
        placeholder: el.getAttribute("placeholder"),
        test: el.getAttribute("data-test-id"),
        visible: r.width > 0 && r.height > 0,
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      };
    }),
  );
  console.log(JSON.stringify(inputs, null, 2));
  await page.screenshot({ path: ".tmp/n8n-video/credential-inputs.png", fullPage: true });
  await browser.close();
})();
