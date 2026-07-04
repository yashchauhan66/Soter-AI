const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: ".tmp/n8n-video/auth-state.json",
    viewport: { width: 1600, height: 900 },
  });
  const page = await context.newPage();
  await page.goto("http://localhost:5678/home/workflows", { waitUntil: "domcontentloaded" });
  const endpoints = [
    "/rest/workflows",
    "/rest/workflows?filter={}",
    "/rest/credentials",
    "/rest/node-types",
    "/rest/settings",
  ];
  for (const endpoint of endpoints) {
    const out = await page.evaluate(async (endpoint) => {
      const response = await fetch(endpoint, { credentials: "include" });
      const text = await response.text();
      return { endpoint, status: response.status, text: text.slice(0, 1000) };
    }, endpoint);
    console.log(JSON.stringify(out, null, 2));
  }
  await browser.close();
})();
