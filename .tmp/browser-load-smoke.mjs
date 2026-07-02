import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const extensionPath = join(root, "apps", "extension", "dist", "extension");
const screenshotsDir = join(root, "docs", "extension-store", "screenshots");
const [browserName, executablePath] = process.argv.slice(2);

if (!browserName || !executablePath) {
  console.error("Usage: node .tmp/browser-load-smoke.mjs <name> <executablePath>");
  process.exit(2);
}

await mkdir(screenshotsDir, { recursive: true });
const profileDir = join(root, ".tmp", `${browserName.toLowerCase()}-load-profile`);
await rm(profileDir, { recursive: true, force: true });

let context;
const result = {
  browserName,
  executablePath,
  extensionPath,
  checks: [],
};

function check(name, passed, details = undefined) {
  result.checks.push({ name, status: passed ? "PASS" : "FAIL", details });
}

try {
  context = await chromium.launchPersistentContext(profileDir, {
    executablePath,
    headless: false,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-component-update",
      "--disable-background-networking",
    ],
    viewport: { width: 1365, height: 900 },
  });

  const extensionsPage = await context.newPage();
  await extensionsPage.goto(browserName.toLowerCase().includes("edge") ? "edge://extensions/" : "chrome://extensions/");
  await extensionsPage.waitForTimeout(1500);
  const extensionItems = await extensionsPage.evaluate(() => {
    const manager = document.querySelector("extensions-manager");
    const list = manager?.shadowRoot?.querySelector("extensions-item-list");
    const items = list?.shadowRoot?.querySelectorAll("extensions-item") ?? [];
    return Array.from(items).map((item) => ({
      id: item.getAttribute("id") ?? item.id ?? "",
      name: item.shadowRoot?.querySelector("#name")?.textContent?.trim() ?? "",
    }));
  });
  const extensionNames = extensionItems.map((item) => item.name);
  const extensionId = extensionItems.find((item) => item.name.includes("Soter Enterprise AI Control Plane"))?.id
    || new URL(context.serviceWorkers()[0]?.url() ?? "chrome-extension://unknown/").host;
  result.extensionId = extensionId;
  check("extension listed in management UI", extensionNames.some((name) => name.includes("Soter Enterprise AI Control Plane")), { extensionNames });
  await extensionsPage.screenshot({ path: join(screenshotsDir, `${browserName.toLowerCase()}-extensions-loaded.png`), fullPage: true });

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);
  await popup.waitForSelector("body", { timeout: 10000 });
  const popupText = await popup.locator("body").innerText();
  check("popup opens", popupText.includes("Soter Enterprise") || popupText.includes("Soter"));
  await popup.screenshot({ path: join(screenshotsDir, `${browserName.toLowerCase()}-popup.png`), fullPage: true });

  const sidePanel = await context.newPage();
  await sidePanel.goto(`chrome-extension://${extensionId}/sidepanel/index.html`);
  await sidePanel.waitForSelector("body", { timeout: 10000 });
  const sidePanelText = await sidePanel.locator("body").innerText();
  check("side panel document opens", sidePanelText.includes("Soter Control Plane") || sidePanelText.includes("Soter"));
  await sidePanel.screenshot({ path: join(screenshotsDir, `${browserName.toLowerCase()}-sidepanel.png`), fullPage: true });

  const worker = context.serviceWorkers().find((item) => item.url().includes(extensionId))
    ?? await context.waitForEvent("serviceworker", { timeout: 5000 }).catch(() => undefined);
  check("service worker loaded", Boolean(worker?.url().includes("/background/service-worker.js")), { workerUrl: worker?.url() });
} catch (error) {
  check("runner completed", false, { error: error instanceof Error ? error.message : String(error) });
} finally {
  await context?.close().catch(() => undefined);
}

console.log(JSON.stringify(result, null, 2));
const failed = result.checks.some((item) => item.status !== "PASS");
process.exit(failed ? 1 : 0);
