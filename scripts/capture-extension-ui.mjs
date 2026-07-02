import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

(async () => {
  const pathToExtension = path.join(process.cwd(), 'apps', 'extension', 'dist', 'extension');
  const userDataDir = path.join(process.cwd(), '.test-profile');
  
  const screenshotsDir = path.join(process.cwd(), 'docs', 'extension-store', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('Launching browser with extension...');
  const browserContext = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
    ],
  });

  let backgroundWorker = browserContext.serviceWorkers()[0];
  if (!backgroundWorker) {
    backgroundWorker = await browserContext.waitForEvent('serviceworker');
  }

  const extensionId = backgroundWorker.url().split('/')[2];
  console.log(`Extension ID: ${extensionId}`);

  // Test popup
  const popupPage = await browserContext.newPage();
  await popupPage.goto(`chrome-extension://${extensionId}/popup/index.html`);
  
  // Try popup.html if index.html fails
  if ((await popupPage.title()) === 'Error' || (await popupPage.content()).includes('ERR_FILE_NOT_FOUND')) {
      await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
  }

  await popupPage.waitForLoadState('networkidle');
  await popupPage.waitForTimeout(2000);
  
  await popupPage.screenshot({ path: path.join(screenshotsDir, '01-popup-onboarding.png') });
  console.log('Captured 01-popup-onboarding.png');

  // Next steps: enrollment, etc.
  
  await browserContext.close();
})();
