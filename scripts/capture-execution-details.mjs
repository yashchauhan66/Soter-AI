import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const ARTIFACT_DIR = 'C:/Users/USER/.gemini/antigravity-ide/brain/be9f88fb-240a-4d77-8cbf-792e74763310';

async function run() {
  console.log('Logging in via REST...');
  const res = await fetch('http://localhost:5678/rest/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: 'admin@soterai.local', password: 'Password1234!' })
  });

  const rawCookieHeader = res.headers.get('set-cookie');
  const token = rawCookieHeader.match(/n8n-auth=([^;]+)/)[1];

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

  console.log('Navigating to execution 3...');
  await page.goto('http://localhost:5678/workflow/nCREVqQDnCyAfbqD/executions/3', { waitUntil: 'domcontentloaded' });

  // Wait for loading spinner to disappear and canvas nodes to appear
  console.log('Waiting for execution canvas to render completely...');
  await page.waitForSelector('.vue-flow__node', { timeout: 20000 });
  await page.waitForTimeout(4000);

  // Click Zoom to Fit so everything is visible
  try {
    const fitBtn = await page.locator('button[title*="fit" i], button[aria-label*="fit" i], [class*="zoom-to-fit"], button:has-text("Fit")').first();
    if (await fitBtn.isVisible()) {
      await fitBtn.click();
      await page.waitForTimeout(1500);
    }
  } catch (e) {}

  // 1. Capture clean execution canvas with green ticks on all nodes
  const execRunPath = path.join(ARTIFACT_DIR, 'n8n_v080_execution_run_overview.png');
  await page.screenshot({ path: execRunPath, fullPage: false });
  console.log('Captured full execution run overview:', execRunPath);

  // 2. Inspect nodes
  const nodeLocators = await page.locator('.vue-flow__node').all();
  console.log(`Found ${nodeLocators.length} nodes on execution canvas`);

  const nodesToCapture = [
    { pattern: 'Threat Block', file: 'n8n_v080_node1_threat_block.png' },
    { pattern: 'PII Redact & Ignored', file: 'n8n_v080_node2_pii_ignored.png' },
    { pattern: 'Credential Leak', file: 'n8n_v080_node3_credential_leak.png' },
    { pattern: 'Universal AI Firewall', file: 'n8n_v080_node4_universal_firewall.png' },
    { pattern: 'Risk Scoring', file: 'n8n_v080_node5_risk_scoring.png' },
    { pattern: 'Redact PII & Secrets', file: 'n8n_v080_node6_pii_redactor.png' },
    { pattern: 'Poisoning Defense', file: 'n8n_v080_node7_rag_scan.png' },
    { pattern: 'Security Auditor', file: 'n8n_v080_node8_workflow_audit.png' },
    { pattern: 'Enroll Identity', file: 'n8n_v080_node9_enroll_identity.png' },
    { pattern: 'Check Tool Call', file: 'n8n_v080_node12_tool_call.png' },
    { pattern: 'Ultra Test Audit Scorecard', file: 'n8n_v080_node_scorecard.png' }
  ];

  for (const item of nodesToCapture) {
    try {
      console.log(`Looking for node matching "${item.pattern}"...`);
      const targetNode = page.locator('.vue-flow__node', { hasText: item.pattern }).first();
      if (await targetNode.isVisible()) {
        console.log(`Clicking node: ${item.pattern}`);
        await targetNode.dblclick();
        await page.waitForTimeout(2500);

        const outPath = path.join(ARTIFACT_DIR, item.file);
        await page.screenshot({ path: outPath, fullPage: false });
        console.log(`Saved screenshot: ${outPath}`);

        // Press Escape to close modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
      } else {
        console.log(`Node not visible for: ${item.pattern}`);
      }
    } catch (err) {
      console.warn(`Could not capture for ${item.pattern}:`, err.message);
    }
  }

  await browser.close();
  console.log('Done capturing all execution details!');
}

run().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
