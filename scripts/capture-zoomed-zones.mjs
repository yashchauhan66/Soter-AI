import { chromium } from 'playwright';
import path from 'path';

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
  // Wait 9 seconds for canvas nodes to be fully rendered
  await page.waitForTimeout(9000);

  // 1. Zoomed in clip of Zone 1 & Zone 2 (Guardrails + Universal Firewall)
  const zone12Path = path.join(ARTIFACT_DIR, 'n8n_v080_zone1_zone2_detail.png');
  await page.screenshot({
    path: zone12Path,
    clip: { x: 260, y: 310, width: 1100, height: 260 }
  });
  console.log('Saved:', zone12Path);

  // 2. Zoomed in clip of Zone 3 (RAG Scanner & Workflow Auditor)
  const zone3Path = path.join(ARTIFACT_DIR, 'n8n_v080_zone3_detail.png');
  await page.screenshot({
    path: zone3Path,
    clip: { x: 1300, y: 310, width: 500, height: 260 }
  });
  console.log('Saved:', zone3Path);

  // 3. Zoomed in clip of Zone 4 (Agent Passport Full 5-Step Lifecycle + Scorecard)
  const zone4Path = path.join(ARTIFACT_DIR, 'n8n_v080_zone4_detail.png');
  await page.screenshot({
    path: zone4Path,
    clip: { x: 260, y: 520, width: 1540, height: 260 }
  });
  console.log('Saved:', zone4Path);

  await browser.close();
  console.log('High-res zone captures complete!');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
