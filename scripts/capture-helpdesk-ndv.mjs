import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT_DIR = path.resolve('.tmp/ui-evidence');
const WORKFLOW_ID = 'ra1LSDqUJn1M4a5s';

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log('Authenticating via REST API...');
  const res = await fetch('http://localhost:5678/rest/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: 'admin@example.com', password: 'Password123!' })
  });

  const rawCookieHeader = res.headers.get('set-cookie');
  const tokenMatch = rawCookieHeader ? rawCookieHeader.match(/n8n-auth=([^;]+)/) : null;
  const token = tokenMatch ? tokenMatch[1] : '';
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

  console.log('Opening workflow canvas...');
  await page.goto(`http://localhost:5678/workflow/${WORKFLOW_ID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);

  // Zoom to fit
  await page.keyboard.press('Shift+1');
  await page.waitForTimeout(1000);

  // Helper function to inspect node and capture NDV panel
  async function captureNdv(nodeName, filename) {
    console.log(`Opening NDV for: ${nodeName}...`);
    try {
      const loc = page.getByText(nodeName, { exact: true }).first();
      if (await loc.count() > 0) {
        await loc.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await loc.dblclick({ force: true });
        await page.waitForTimeout(2500);

        const outPath = path.join(OUT_DIR, filename);
        await page.screenshot({ path: outPath, fullPage: false });
        console.log(`✅ Saved NDV screenshot: ${outPath}`);

        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
      } else {
        console.log(`Node not found: ${nodeName}`);
      }
    } catch (e) {
      console.log(`Error inspecting ${nodeName}:`, e.message);
    }
  }

  await captureNdv('Guard Input for Threats', '02_guard_input_ndv_panel.png');
  await captureNdv('Verify Output for Safety', '03_verify_output_ndv_panel.png');

  await browser.close();
  console.log('Capture script finished!');
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
