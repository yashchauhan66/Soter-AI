const { chromium } = require("playwright");

(async () => {
  const context = await chromium.launchPersistentContext(".tmp/n8n-video/profile2", {
    headless: true,
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
  });
  const page = context.pages()[0] || (await context.newPage());
  await page.goto("http://localhost:5678/home/workflows", { waitUntil: "networkidle" });

  const info = await page.evaluate(async () => {
    const get = async (url, options = {}) => {
      try {
        const response = await fetch(url, {
          credentials: "include",
          headers: { "content-type": "application/json" },
          ...options,
        });
        const text = await response.text();
        let body;
        try {
          body = JSON.parse(text);
        } catch {
          body = text.slice(0, 500);
        }
        return { url, status: response.status, body };
      } catch (error) {
        return { url, error: String(error) };
      }
    };

    const endpoints = [
      "/rest/settings",
      "/rest/node-types",
      "/rest/credentials",
      "/rest/workflows",
      "/rest/workflows?take=10",
      "/api/v1/workflows",
    ];
    const results = [];
    for (const endpoint of endpoints) results.push(await get(endpoint));
    return {
      title: document.title,
      url: location.href,
      localStorageKeys: Object.keys(localStorage),
      results,
    };
  });

  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: ".tmp/n8n-video/home-after-login.png", fullPage: true });
  await context.close();
})();
