import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const BASE = 'http://localhost:5678';
const WORKFLOW_ID = 'RNVcKCvhW1g6wofP';
const EXECUTION_ID = '72';
const ARTIFACT_DIR = 'C:/Users/USER/.gemini/antigravity-ide/brain/b467584f-b39c-411f-b105-0c61d0fee30c';

async function run() {
  console.log('Logging in...');
  const res = await fetch(`${BASE}/rest/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: 'admin@example.com', password: 'Password1234!' })
  });
  const rawCookie = res.headers.get('set-cookie');
  const token = rawCookie.match(/n8n-auth=([^;]+)/)[1];

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await context.addCookies([{ name: 'n8n-auth', value: token, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);

  const page = await context.newPage();

  // 1. Workflow Canvas Overview
  console.log('1. Loading Workflow Canvas...');
  await page.goto(`${BASE}/workflow/${WORKFLOW_ID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Zoom to fit
  const zoomFitBtn = await page.$('button[title*="fit" i], [data-test-id*="zoom-to-fit"], button:has-text("Fit")');
  if (zoomFitBtn) {
    await zoomFitBtn.click();
    await page.waitForTimeout(1200);
  }

  const canvasPath = path.join(ARTIFACT_DIR, 'cs_v082_full_workflow_canvas.png');
  await page.screenshot({ path: canvasPath, fullPage: false });
  console.log('✅ Canvas screenshot saved:', canvasPath);

  // 2. Execution Run Overview
  console.log('2. Loading Execution Overview...');
  await page.goto(`${BASE}/workflow/${WORKFLOW_ID}/executions/${EXECUTION_ID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const zoomFitBtnExec = await page.$('button[title*="fit" i], [data-test-id*="zoom-to-fit"], button:has-text("Fit")');
  if (zoomFitBtnExec) {
    await zoomFitBtnExec.click();
    await page.waitForTimeout(1200);
  }

  const execPath = path.join(ARTIFACT_DIR, 'cs_v082_execution_72_overview.png');
  await page.screenshot({ path: execPath, fullPage: false });
  console.log('✅ Execution screenshot saved:', execPath);

  // 3. Capture Detailed NDVs
  const nodes = await page.$$('.vue-flow__node');
  console.log(`Found ${nodes.length} canvas nodes in execution view.`);

  for (const node of nodes) {
    const text = await node.innerText();
    
    if (text.includes('1. InputGuard') && text.includes('Benign')) {
      console.log('Capturing Node 1 NDV...');
      await node.dblclick({ force: true });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'cs_v082_ndv_benign_ignored_brand.png') });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    } else if (text.includes('2. InputGuard') && text.includes('Prompt Injection')) {
      console.log('Capturing Node 2 NDV...');
      await node.dblclick({ force: true });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'cs_v082_ndv_prompt_injection.png') });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    } else if (text.includes('5. InputGuard') && text.includes('Sensitive Data')) {
      console.log('Capturing Node 5 NDV...');
      await node.dblclick({ force: true });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'cs_v082_ndv_sensitive_data_enforced.png') });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    } else if (text.includes('6. PIIRedactor') && text.includes('Ignored Words')) {
      console.log('Capturing Node 6 NDV...');
      await node.dblclick({ force: true });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'cs_v082_ndv_pii_redactor_ignoredwords.png') });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    } else if (text.includes('9. UniversalFirewall') && text.includes('Leak Block')) {
      console.log('Capturing Node 9 NDV...');
      await node.dblclick({ force: true });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'cs_v082_ndv_universal_firewall.png') });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    } else if (text.includes('11. OutputGuard') && text.includes('Secret Leak')) {
      console.log('Capturing Node 11 NDV...');
      await node.dblclick({ force: true });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'cs_v082_ndv_output_secret_leak.png') });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    } else if (text.includes('13. RAGScanner') && text.includes('Poisoned')) {
      console.log('Capturing Node 13 NDV...');
      await node.dblclick({ force: true });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'cs_v082_ndv_rag_scanner_poisoned.png') });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    } else if (text.includes('15. ToolCall') && text.includes('Destructive')) {
      console.log('Capturing Node 15 NDV...');
      await node.dblclick({ force: true });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'cs_v082_ndv_tool_call_blocked.png') });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }
  }

  await browser.close();
  console.log('✅ All UI evidence captured successfully!');
}

run().catch(err => {
  console.error('Evidence capture failed:', err);
  process.exit(1);
});
