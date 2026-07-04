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
  const candidates = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("*"))
      .map((el, i) => {
        const r = el.getBoundingClientRect();
        return {
          i,
          tag: el.tagName,
          cls: String(el.className || "").slice(0, 120),
          text: (el.textContent || "").trim().slice(0, 80),
          title: el.getAttribute("title"),
          aria: el.getAttribute("aria-label"),
          test: el.getAttribute("data-test-id"),
          role: el.getAttribute("role"),
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        };
      })
      .filter((e) => e.rect.x >= 850 && e.rect.x <= 930 && e.rect.y >= 120 && e.rect.y <= 180 && e.rect.w > 0 && e.rect.h > 0);
  });
  console.log(JSON.stringify(candidates, null, 2));
  const clicked = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll("*")).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.x >= 880 && r.x <= 920 && r.y >= 135 && r.y <= 165 && r.width > 0 && r.height > 0;
    });
    const target = elements.find((el) => /svg|button|span|div/i.test(el.tagName) && !/input/i.test(el.tagName));
    if (!target) return null;
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    return {
      tag: target.tagName,
      cls: String(target.className || ""),
      text: (target.textContent || "").trim(),
    };
  });
  console.log("CLICKED", JSON.stringify(clicked));
  await page.waitForTimeout(5000);
  console.log((await page.locator("body").innerText()).slice(0, 8000));
  await page.screenshot({ path: ".tmp/n8n-video/dom-credential-click.png", fullPage: true });
  await browser.close();
})();
