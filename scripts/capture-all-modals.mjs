import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const ARTIFACT_DIR = 'C:/Users/USER/.gemini/antigravity-ide/brain/be9f88fb-240a-4d77-8cbf-792e74763310';

async function run() {
  const loginRes = await fetch('http://localhost:5678/rest/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: 'admin@soterai.local', password: 'Password1234!' })
  });
  const cookie = loginRes.headers.get('set-cookie').split(';')[0].replace('n8n-auth=', '');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await context.addCookies([{ name: 'n8n-auth', value: cookie, domain: 'localhost', path: '/' }]);
  const page = await context.newPage();

  console.log('Navigating to execution 3...');
  await page.goto('http://localhost:5678/workflow/nCREVqQDnCyAfbqD/executions/3', { waitUntil: 'load' });
  await page.waitForTimeout(6000);

  const targets = [
    { name: '1. Guard Input - Threat Block', file: 'n8n_v080_node1_threat_block.png' },
    { name: '2. Guard Input - PII Redact & Ignored', file: 'n8n_v080_node2_pii_ignored.png' },
    { name: '3. Guard Output - Credential Leak', file: 'n8n_v080_node3_credential_leak.png' },
    { name: '6. Redact PII & Secrets', file: 'n8n_v080_node6_pii_redactor.png' },
    { name: '7. Scan Document - Poisoning Defense', file: 'n8n_v080_node7_rag_scan.png' },
    { name: '8. Audit Workflow - Security Auditor', file: 'n8n_v080_node8_workflow_audit.png' },
    { name: '12. Agent Passport: Check Tool Call', file: 'n8n_v080_node12_tool_call.png' },
    { name: 'Ultra Test Audit Scorecard', file: 'n8n_v080_node_scorecard.png' }
  ];

  for (const t of targets) {
    try {
      console.log(`Locating node: "${t.name}"`);
      const loc = page.locator(`text=${t.name}`).first();
      if (await loc.count() > 0) {
        console.log(`Double-clicking node: "${t.name}"`);
        await loc.dblclick({ force: true });
        await page.waitForTimeout(2500);

        const outPath = path.join(ARTIFACT_DIR, t.file);
        await page.screenshot({ path: outPath, fullPage: false });
        console.log(`Saved screenshot: ${outPath}`);

        // Try to close modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
      } else {
        console.log(`Node not found: ${t.name}`);
      }
    } catch (e) {
      console.warn(`Error on ${t.name}:`, e.message);
    }
  }

  await browser.close();
  console.log('Capture script finished successfully!');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
