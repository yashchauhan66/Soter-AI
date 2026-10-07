import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const ARTIFACT_DIR = 'C:/Users/USER/.gemini/antigravity-ide/brain/be9f88fb-240a-4d77-8cbf-792e74763310';

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
  console.log('Obtained token');

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

  console.log('Opening workflow canvas...');
  await page.goto('http://localhost:5678/workflow/nCREVqQDnCyAfbqD', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // 1. Click Executions tab at the top
  console.log('Clicking Executions tab...');
  const execTab = await page.$('button:has-text("Executions"), [class*="nav"]:has-text("Executions"), div:has-text("Executions")');
  if (execTab) {
    await execTab.click();
  } else {
    await page.goto('http://localhost:5678/workflow/nCREVqQDnCyAfbqD/executions', { waitUntil: 'domcontentloaded' });
  }
  await page.waitForTimeout(3000);

  // Screenshot of executions list
  const executionsListPath = path.join(ARTIFACT_DIR, 'n8n_v080_executions_list.png');
  await page.screenshot({ path: executionsListPath, fullPage: false });
  console.log('Saved executions list screenshot:', executionsListPath);

  // 2. Click the top execution row (Execution #3)
  console.log('Opening top execution...');
  // Look for execution row or link
  const execLink = await page.$('a[href*="/executions/"], tr.el-table__row, [data-test-id*="execution-list-item"]');
  if (execLink) {
    await execLink.click();
    await page.waitForTimeout(4000);
  } else {
    console.log('Directly opening execution 3...');
    await page.goto('http://localhost:5678/workflow/nCREVqQDnCyAfbqD/executions/3', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
  }

  // Screenshot of execution 3 run overview (green checkmarks)
  const execRunPath = path.join(ARTIFACT_DIR, 'n8n_v080_execution_run_overview.png');
  await page.screenshot({ path: execRunPath, fullPage: false });
  console.log('Saved execution run overview screenshot:', execRunPath);

  // 3. Let's inspect individual nodes by clicking on them on the execution canvas
  // First zoom to fit so nodes are clickable
  try {
    const fitBtn = await page.$('button[title*="fit" i], [class*="zoom-to-fit"], button[aria-label*="fit" i]');
    if (fitBtn) await fitBtn.click();
    await page.waitForTimeout(1000);
  } catch (e) {}

  const nodesToInspect = [
    { label: '1. Guard Input - Threat Block', filename: 'n8n_v080_node1_threat_block.png' },
    { label: '2. Guard Input - PII Redact & Ignored', filename: 'n8n_v080_node2_pii_ignored.png' },
    { label: '6. Redact PII & Secrets', filename: 'n8n_v080_node6_pii_redactor.png' },
    { label: '7. Scan Document - Poisoning Defense', filename: 'n8n_v080_node7_rag_scan.png' },
    { label: '12. Agent Passport: Check Tool Call', filename: 'n8n_v080_node12_tool_call.png' },
    { label: 'Ultra Test Audit Scorecard', filename: 'n8n_v080_node_scorecard.png' }
  ];

  for (const nodeInfo of nodesToInspect) {
    try {
      console.log(`Looking for node element: ${nodeInfo.label}`);
      // Find element containing this exact label
      const el = await page.$(`text="${nodeInfo.label}"`);
      if (el) {
        console.log(`Found node! Double-clicking to open node execution details...`);
        await el.click({ clickCount: 2, delay: 100 });
        await page.waitForTimeout(2000);

        const nodeScreenshot = path.join(ARTIFACT_DIR, nodeInfo.filename);
        await page.screenshot({ path: nodeScreenshot, fullPage: false });
        console.log(`Saved screenshot: ${nodeScreenshot}`);

        // Press Escape to close modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
      } else {
        console.log(`Element not found for label: ${nodeInfo.label}`);
      }
    } catch (nodeErr) {
      console.warn(`Error on node ${nodeInfo.label}:`, nodeErr.message);
    }
  }

  await browser.close();
  console.log('Execution inspection complete!');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
