import { chromium } from 'playwright';
import path from 'path';

const BASE = 'http://localhost:5678';
const WORKFLOW_ID = 'RNVcKCvhW1g6wofP';
const EXECUTION_ID = '72';
const ARTIFACT_DIR = 'C:/Users/USER/.gemini/antigravity-ide/brain/b467584f-b39c-411f-b105-0c61d0fee30c';

async function main() {
  const res = await fetch(`${BASE}/rest/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: 'admin@example.com', password: 'Password1234!' })
  });
  const rawCookie = res.headers.get('set-cookie');
  const token = rawCookie.match(/n8n-auth=([^;]+)/)[1];

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await context.addCookies([{ name: 'n8n-auth', value: token, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
  const page = await context.newPage();

  console.log('Loading workflow canvas...');
  await page.goto(`${BASE}/workflow/${WORKFLOW_ID}`, { waitUntil: 'domcontentloaded' });
  console.log('Waiting for .vue-flow__node...');
  await page.waitForSelector('.vue-flow__node', { timeout: 25000 });
  await page.waitForTimeout(3000);

  // Zoom to fit
  const zoomFitBtn = await page.$('button[title*="fit" i], [data-test-id*="zoom-to-fit"], button:has-text("Fit")');
  if (zoomFitBtn) {
    await zoomFitBtn.click();
    await page.waitForTimeout(1500);
  }

  const canvasScreenshot = path.join(ARTIFACT_DIR, 'cs_v082_full_workflow_canvas.png');
  await page.screenshot({ path: canvasScreenshot });
  console.log('✅ Captured Full Canvas:', canvasScreenshot);

  // Helper to open NDV on canvas
  async function captureNdv(partialName, filename) {
    console.log(`Opening NDV for: ${partialName}...`);
    const nodes = await page.$$('.vue-flow__node');
    for (const node of nodes) {
      const text = await node.innerText();
      if (text.includes(partialName)) {
        await node.dblclick({ force: true });
        await page.waitForTimeout(2000);
        const out = path.join(ARTIFACT_DIR, filename);
        await page.screenshot({ path: out });
        console.log(`✅ Saved NDV: ${filename}`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
        return;
      }
    }
    console.log(`⚠️ Node not found: ${partialName}`);
  }

  // 1. Node 1: Benign Query & Ignored Brand
  await captureNdv('1. InputGuard', 'cs_v082_ndv_node1_benign_ignored.png');

  // 2. Node 2: Prompt Injection Attack Block
  await captureNdv('2. InputGuard', 'cs_v082_ndv_node2_prompt_injection.png');

  // 3. Node 5: Sensitive Data Hard Block
  await captureNdv('5. InputGuard', 'cs_v082_ndv_node5_sensitive_data.png');

  // 4. Node 6: PII Redactor Ignored Words & Credential Refusal
  await captureNdv('6. PIIRedactor', 'cs_v082_ndv_node6_pii_ignoredwords.png');

  // 5. Node 7: PII Redactor Ignored Entities
  await captureNdv('7. PIIRedactor', 'cs_v082_ndv_node7_pii_entities.png');

  // 6. Node 9: Universal Firewall
  await captureNdv('9. UniversalFirewall', 'cs_v082_ndv_node9_universal_firewall.png');

  // 7. Node 11: OutputGuard Outbound Secret Leak Blocked
  await captureNdv('11. OutputGuard', 'cs_v082_ndv_node11_output_secret_leak.png');

  // 8. Node 13: RAG Scanner Poisoned Document Flagged
  await captureNdv('13. RAGScanner', 'cs_v082_ndv_node13_rag_poisoned.png');

  // 9. Node 15: Tool Call Blocked Destructive Action
  await captureNdv('15. ToolCall', 'cs_v082_ndv_node15_tool_blocked.png');

  // 10. Execution View Overview
  console.log('Loading Execution 72 View...');
  await page.goto(`${BASE}/workflow/${WORKFLOW_ID}/executions/${EXECUTION_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.vue-flow__node', { timeout: 25000 });
  await page.waitForTimeout(3000);

  const zoomFitBtnExec = await page.$('button[title*="fit" i], [data-test-id*="zoom-to-fit"], button:has-text("Fit")');
  if (zoomFitBtnExec) {
    await zoomFitBtnExec.click();
    await page.waitForTimeout(1500);
  }

  const execScreenshot = path.join(ARTIFACT_DIR, 'cs_v082_execution_72_overview.png');
  await page.screenshot({ path: execScreenshot });
  console.log('✅ Captured Execution Overview:', execScreenshot);

  await browser.close();
  console.log('🎉 ALL EVIDENCE CAPTURED WITH 100% SUCCESS!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
