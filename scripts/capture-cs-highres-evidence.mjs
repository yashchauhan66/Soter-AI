import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const ARTIFACT_DIR = 'C:/Users/USER/.gemini/antigravity-ide/brain/fab10c40-915b-4612-b944-0c5f227d9e9f';
const WORKFLOW_ID = 'NdMI4xZVNk9WmIGy';
const EXECUTION_ID = '9';

async function run() {
  console.log('Authenticating via REST API...');
  const res = await fetch('http://localhost:5678/rest/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: 'admin@soterai.local', password: 'Password1234!' })
  });

  const rawCookieHeader = res.headers.get('set-cookie');
  const tokenMatch = rawCookieHeader ? rawCookieHeader.match(/n8n-auth=([^;]+)/) : null;
  const token = tokenMatch[1];
  console.log('Obtained auth cookie token');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });

  await context.addCookies([{
    name: 'n8n-auth',
    value: token,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax'
  }]);

  const page = await context.newPage();

  // 1. Workflow Canvas (Full 5 Zones)
  console.log('Opening workflow canvas...');
  await page.goto(`http://localhost:5678/workflow/${WORKFLOW_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Zoom to fit if available
  const zoomFitBtn = await page.$('button[title*="fit" i], [data-test-id*="zoom-to-fit"], button:has-text("Fit")');
  if (zoomFitBtn) {
    await zoomFitBtn.click();
    await page.waitForTimeout(1000);
  }

  const canvasScreenshot = path.join(ARTIFACT_DIR, 'cs_v082_full_canvas.png');
  await page.screenshot({ path: canvasScreenshot, fullPage: false });
  console.log('✅ Saved Canvas Screenshot:', canvasScreenshot);

  // 2. Execution Run Overview (All 15 Nodes Succeeded)
  console.log(`Opening execution #${EXECUTION_ID}...`);
  await page.goto(`http://localhost:5678/workflow/${WORKFLOW_ID}/executions/${EXECUTION_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const execScreenshot = path.join(ARTIFACT_DIR, 'cs_v082_execution_9_all_success.png');
  await page.screenshot({ path: execScreenshot, fullPage: false });
  console.log('✅ Saved Execution #9 Overview:', execScreenshot);

  // Helper function to click node in node-list and capture NDV
  async function inspectNode(nodeSelectorText, screenshotName) {
    console.log(`Inspecting node: ${nodeSelectorText}...`);
    try {
      // Find the node item in the execution run sidebar / canvas
      const nodeEl = await page.$(`text="${nodeSelectorText}"`);
      if (nodeEl) {
        await nodeEl.dblclick();
        await page.waitForTimeout(2000);

        // Click JSON view if available
        const jsonBtn = await page.$('button:has-text("JSON"), [data-test-id*="json"]');
        if (jsonBtn) {
          await jsonBtn.click();
          await page.waitForTimeout(500);
        }

        const scPath = path.join(ARTIFACT_DIR, `${screenshotName}.png`);
        await page.screenshot({ path: scPath, fullPage: false });
        console.log(`✅ Saved ${screenshotName}:`, scPath);

        // Close NDV modal
        const closeBtn = await page.$('[class*="close"], button:has-text("Esc"), [data-test-id*="close"]');
        if (closeBtn) {
          await closeBtn.click();
          await page.waitForTimeout(1000);
        } else {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(1000);
        }
      } else {
        console.log(`Could not find element for: ${nodeSelectorText}`);
      }
    } catch (e) {
      console.log(`Error inspecting ${nodeSelectorText}:`, e.message);
    }
  }

  await inspectNode('3. Agent Output - Secret Redact-and-Continue', 'cs_v082_node3_secret_low_sensitivity');
  await inspectNode('11. Agent Passport: Validate Passport', 'cs_v082_node11_validate_passport_autofallback');
  await inspectNode('12. Agent Passport: Check Tool Call', 'cs_v082_node12_toolcall_autofallback');
  await inspectNode('14. Customer Support Security Scorecard', 'cs_v082_node14_scorecard');

  await browser.close();
  console.log('🎉 All evidence captured successfully!');
}

run().catch(err => {
  console.error('Evidence Capture Error:', err);
  process.exit(1);
});
