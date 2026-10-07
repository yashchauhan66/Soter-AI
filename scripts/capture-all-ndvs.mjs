import { chromium } from 'playwright';
import path from 'path';

const BASE = 'http://localhost:5678';
const WORKFLOW_ID = 'RNVcKCvhW1g6wofP';
const ARTIFACT_DIR = 'C:/Users/USER/.gemini/antigravity-ide/brain/b467584f-b39c-411f-b105-0c61d0fee30c';

async function main() {
  const res = await fetch(`${BASE}/rest/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: 'admin@example.com', password: 'Password1234!' })
  });
  const rawCookie = res.headers.get('set-cookie');
  const token = rawCookie.match(/n8n-auth=([^;]+)/)[1];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await context.addCookies([{ name: 'n8n-auth', value: token, domain: 'localhost', path: '/' }]);
  const page = await context.newPage();

  console.log('Loading workflow canvas...');
  await page.goto(`${BASE}/workflow/${WORKFLOW_ID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Zoom to fit
  const zoomFitBtn = await page.$('button[title*="fit" i], [data-test-id*="zoom-to-fit"], button:has-text("Fit")');
  if (zoomFitBtn) {
    await zoomFitBtn.click();
    await page.waitForTimeout(1000);
  }

  async function openAndCaptureNode(searchText, filename) {
    console.log(`Searching for node: "${searchText}"...`);
    const el = await page.$(`text=${searchText}`);
    if (el) {
      console.log(`Found node! Double clicking...`);
      await el.dblclick({ force: true });
      await page.waitForTimeout(2000);
      const outPath = path.join(ARTIFACT_DIR, filename);
      await page.screenshot({ path: outPath });
      console.log(`✅ Saved screenshot: ${filename}`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    } else {
      console.log(`⚠️ Could not find node with text: "${searchText}"`);
    }
  }

  // 1. Node 1: Benign Query & Ignored Brand
  await openAndCaptureNode('1. InputGuard — Benign', 'cs_v082_ndv_node1_benign_ignored_brand.png');

  // 2. Node 2: Prompt Injection Attack Block
  await openAndCaptureNode('2. InputGuard — Prompt Injection', 'cs_v082_ndv_node2_prompt_injection.png');

  // 3. Node 3: Off-Topic Restriction
  await openAndCaptureNode('3. InputGuard — Off-Topic', 'cs_v082_ndv_node3_offtopic.png');

  // 4. Node 5: Sensitive Data Hard Block (enforceOnSensitiveData)
  await openAndCaptureNode('5. InputGuard — Sensitive Data', 'cs_v082_ndv_node5_sensitive_data.png');

  // 5. Node 6: PII Redactor Ignored Words & Credential Refusal
  await openAndCaptureNode('6. PIIRedactor — Ignored Words', 'cs_v082_ndv_node6_pii_ignored_words.png');

  // 6. Node 7: PII Redactor Ignored Entities
  await openAndCaptureNode('7. PIIRedactor — Ignored Entities', 'cs_v082_ndv_node7_pii_entities.png');

  // 7. Node 9: Universal Firewall
  await openAndCaptureNode('9. UniversalFirewall — Prompt', 'cs_v082_ndv_node9_universal_firewall.png');

  // 8. Node 11: OutputGuard Secret Leak Blocked
  await openAndCaptureNode('11. OutputGuard — Outbound', 'cs_v082_ndv_node11_output_secret_leak.png');

  // 9. Node 13: RAG Scanner Poisoned Document
  await openAndCaptureNode('13. RAGScanner — Poisoned', 'cs_v082_ndv_node13_rag_poisoned.png');

  // 10. Node 15: Tool Call Blocked Action
  await openAndCaptureNode('15. ToolCall — Blocked', 'cs_v082_ndv_node15_tool_blocked.png');

  // 11. Now go to execution view and capture execution details log items
  console.log('\nLoading execution view for run logs...');
  await page.goto(`${BASE}/workflow/${WORKFLOW_ID}/executions/72`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  async function clickLogAndCapture(searchText, filename) {
    const el = await page.$(`text=${searchText}`);
    if (el) {
      await el.click();
      await page.waitForTimeout(1000);
      const outPath = path.join(ARTIFACT_DIR, filename);
      await page.screenshot({ path: outPath });
      console.log(`✅ Saved execution panel: ${filename}`);
    } else {
      console.log(`⚠️ Log item not found: "${searchText}"`);
    }
  }

  await clickLogAndCapture('2. InputGuard', 'cs_v082_exec_log_node2_injection.png');
  await clickLogAndCapture('6. PIIRedactor', 'cs_v082_exec_log_node6_pii.png');
  await clickLogAndCapture('11. OutputGuard', 'cs_v082_exec_log_node11_output.png');
  await clickLogAndCapture('15. ToolCall', 'cs_v082_exec_log_node15_tool.png');

  await browser.close();
  console.log('\n🎉 All NDV and execution screenshots captured successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
