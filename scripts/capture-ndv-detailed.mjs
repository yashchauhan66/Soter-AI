import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/USER/.gemini/antigravity-ide/brain/fab10c40-915b-4612-b944-0c5f227d9e9f';
const WORKFLOW_ID = 'NdMI4xZVNk9WmIGy';
const EXECUTION_ID = '9';

async function run() {
  const res = await fetch('http://localhost:5678/rest/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: 'admin@soterai.local', password: 'Password1234!' })
  });
  const token = res.headers.get('set-cookie').match(/n8n-auth=([^;]+)/)[1];

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  await context.addCookies([{ name: 'n8n-auth', value: token, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);

  const page = await context.newPage();
  await page.goto(`http://localhost:5678/workflow/${WORKFLOW_ID}/executions/${EXECUTION_ID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Take screenshot of execution
  console.log('Finding nodes on canvas...');
  const nodes = await page.$$('.vue-flow__node');
  console.log(`Found ${nodes.length} canvas nodes.`);

  for (const node of nodes) {
    const text = await node.innerText();
    if (text.includes('Secret Redact-and-Continue')) {
      console.log('Clicking Node 3...');
      await node.dblclick({ force: true });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'cs_v082_node3_low_sens_ndv.png') });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    } else if (text.includes('Validate Passport')) {
      console.log('Clicking Node 11...');
      await node.dblclick({ force: true });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'cs_v082_node11_validate_passport_ndv.png') });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    } else if (text.includes('Scorecard')) {
      console.log('Clicking Node 14 Scorecard...');
      await node.dblclick({ force: true });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'cs_v082_node14_scorecard_ndv.png') });
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }
  }

  await browser.close();
  console.log('NDV capture complete!');
}

run().catch(console.error);
