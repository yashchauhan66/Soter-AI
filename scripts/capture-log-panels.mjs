import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/USER/.gemini/antigravity-ide/brain/fab10c40-915b-4612-b944-0c5f227d9e9f';

async function run() {
  const res = await fetch('http://localhost:5678/rest/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: 'admin@soterai.local', password: 'Password1234!' })
  });
  const token = res.headers.get('set-cookie').match(/n8n-auth=([^;]+)/)[1];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await context.addCookies([{ name: 'n8n-auth', value: token, domain: 'localhost', path: '/' }]);
  const page = await context.newPage();

  await page.goto('http://localhost:5678/workflow/2q3MdsNYgxPcL60h/executions/8', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Take screenshot of Node 14 (Scorecard) which is already loaded on open
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'cs_v082_scorecard_details.png') });
  console.log('Saved scorecard details screenshot');

  // Helper to click logs panel item
  async function clickLogItem(partialText, outName) {
    const el = await page.$(`text=${partialText}`);
    if (el) {
      await el.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, `${outName}.png`) });
      console.log(`Saved ${outName}`);
    } else {
      console.log(`Could not find ${partialText}`);
    }
  }

  await clickLogItem('6. Support Ticket PII', 'cs_v082_node6_pii_details');
  await clickLogItem('8. Workflow Audit', 'cs_v082_node8_ast_details');
  await clickLogItem('3. Agent Output', 'cs_v082_node3_output_details');
  await clickLogItem('4. Universal AI', 'cs_v082_node4_universal_details');

  await browser.close();
  console.log('Completed panel captures!');
}

run().catch(e => console.error(e));
