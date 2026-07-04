import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const destDir = path.resolve(__dirname);
const profileDir = path.join(destDir, "profile2");
const authStatePath = path.join(destDir, "auth-state.json");

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function capture() {
  // Try using persistent context with existing profile
  console.log("Launching browser with existing n8n profile...");
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
    args: ["--no-sandbox"],
  });

  const page = context.pages()[0] || (await context.newPage());

  try {
    // Navigate to n8n workflows page
    console.log("Navigating to n8n...");
    await page.goto("http://localhost:5678/home/workflows", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await delay(3000);

    // Check if we're logged in
    const currentUrl = page.url();
    console.log("Current URL:", currentUrl);

    if (currentUrl.includes("login") || currentUrl.includes("signin")) {
      console.log("n8n requires login. Checking for existing session...");
      // Try auth-state.json if it exists
      if (fs.existsSync(authStatePath)) {
        console.log("Found auth-state.json - creating isolated context...");
        await context.close();

        const context2 = await chromium.launchPersistentContext(profileDir, {
          headless: true,
          channel: "chrome",
          viewport: { width: 1440, height: 900 },
          args: ["--no-sandbox"],
        });
        const page2 = context2.pages()[0] || (await context2.newPage());

        // Try to restore cookies from auth state
        try {
          const authState = JSON.parse(
            fs.readFileSync(authStatePath, "utf8")
          );
          if (authState.cookies) {
            await context2.addCookies(authState.cookies);
            console.log("Restored cookies from auth state");
          }
          if (authState.origins) {
            await context2.addInitScript(() => {});
            console.log("authState has origins");
          }
        } catch (e) {
          console.log("Could not restore auth state:", e.message);
        }

        await page2.goto("http://localhost:5678/home/workflows", {
          waitUntil: "networkidle",
          timeout: 30000,
        });
        await delay(3000);
        console.log("After auth restore URL:", page2.url());

        // Take screenshot of whatever state we're in
        await page2.screenshot({
          path: path.join(destDir, "assets-home.png"),
          fullPage: false,
        });
        console.log("Captured: assets-home.png");

        // Try searching for node
        await page2.goto("http://localhost:5678/workflow/new", {
          waitUntil: "networkidle",
          timeout: 30000,
        });
        await delay(3000);
        await page2.screenshot({
          path: path.join(destDir, "workflow-open.png"),
          fullPage: false,
        });
        console.log("Captured: workflow-open.png");

        await context2.close();
        return;
      }

      // If we can't log in, use existing screenshots
      console.log(
        "Cannot login automatically - will use existing screenshots"
      );
      await page.screenshot({
        path: path.join(destDir, "assets-home.png"),
        fullPage: false,
      });
      await context.close();
      return;
    }

    // We're logged in - capture screenshots
    console.log("Logged in! Capturing screenshots...");

    // Assets home
    await page.screenshot({
      path: path.join(destDir, "assets-home.png"),
      fullPage: false,
    });
    console.log("Captured: assets-home.png");

    // Navigate to new workflow
    await page.goto("http://localhost:5678/workflow/new", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await delay(3000);

    // Search for SoterAI node
    // Try clicking the plus button or node search
    console.log("Looking for node search...");
    const addNodeButton = page.locator(
      'button:has-text("Add node"), [data-test-id="add-node-button"], .add-node-button'
    );
    if (await addNodeButton.isVisible().catch(() => false)) {
      await addNodeButton.click();
      await delay(1000);

      const searchInput = page.locator(
        'input[placeholder*="Search"], input[type="search"]'
      );
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill("SoterAI");
        await delay(1000);
      }
    }

    await page.screenshot({
      path: path.join(destDir, "add-search-soterai.png"),
      fullPage: false,
    });
    console.log("Captured: add-search-soterai.png");

    // Try to open credentials page
    await page.goto("http://localhost:5678/home/credentials", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await delay(3000);
    await page.screenshot({
      path: path.join(destDir, "assets-credentials.png"),
      fullPage: false,
    });
    console.log("Captured: assets-credentials.png");

    // Navigate to workflow and capture
    await page.goto("http://localhost:5678/workflow/new", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await delay(3000);
    await page.screenshot({
      path: path.join(destDir, "workflow-open.png"),
      fullPage: false,
    });
    console.log("Captured: workflow-open.png");

    await context.close();
    console.log("Screenshot capture complete!");
  } catch (error) {
    console.error("Error during screenshot capture:", error.message);
    // Screenshot current state
    try {
      await page.screenshot({
        path: path.join(destDir, "error-state.png"),
        fullPage: false,
      });
    } catch (_) {}
    await context.close();
  }
}

capture();
