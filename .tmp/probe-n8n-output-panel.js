const { chromium } = require("@playwright/test");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto("http://localhost:5678/signin", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill("demo@soterai.local");
  await page.getByLabel("Password").fill("SoterAI-Demo-2026");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForTimeout(3000);
  await page.goto("http://localhost:5678/workflow/soteraiRealDemo01?executionId=21", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);

  const tries = [
    ["click", 636, 503],
    ["dblclick", 636, 503],
    ["click", 641, 552],
    ["dblclick", 641, 552],
    ["click", 1267, 503],
    ["dblclick", 1267, 503],
  ];

  let index = 0;
  for (const [kind, x, y] of tries) {
    if (kind === "click") await page.mouse.click(x, y);
    else await page.mouse.dblclick(x, y);
    await page.waitForTimeout(4000);
    console.log("TRY", kind, x, y);
    console.log((await page.locator("body").innerText()).slice(0, 4000));
    await page.screenshot({ path: `.tmp/node-open-${index++}-${kind}-${x}-${y}.png`, fullPage: true });
  }

  await page.mouse.click(1530, 587);
  await page.waitForTimeout(10000);
  console.log("AFTER EXECUTE STEP");
  console.log((await page.locator("body").innerText()).slice(0, 6000));
  await page.screenshot({ path: ".tmp/node-open-after-execute-step.png", fullPage: true });

  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
