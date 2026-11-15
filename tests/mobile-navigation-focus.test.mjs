import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from '@playwright/test';

const baseURL = process.env.SOTER_UI_URL ?? 'http://localhost:3130';

test('mobile navigation preserves initial focus and restores it only after closing', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await Promise.all([
      page.waitForResponse(response => response.url() === `${baseURL}/api/auth/session` && response.status() === 200),
      page.goto(baseURL, { waitUntil: 'networkidle', timeout: 45000 }),
    ]);
    const trigger = page.getByRole('button', { name: 'Open navigation menu', exact: true });
    await trigger.waitFor({ state: 'visible' });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const initialFocus = await page.evaluate(() => ({ tag: document.activeElement.tagName, label: document.activeElement.getAttribute('aria-label') }));
    console.log(JSON.stringify({ baseURL, mode: process.env.SOTER_UI_MODE ?? 'unspecified', browser: browser.version(), initialFocus }));
    assert.equal(initialFocus.tag, 'BODY', 'The closed mobile menu must not steal focus on initial page load.');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Skip to main content');
    const priorOverflow = await page.evaluate(() => document.body.style.overflow);
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Site navigation', exact: true });
    await dialog.waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Close navigation menu');
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.closest('[role="dialog"]')?.getAttribute('aria-label')), 'Site navigation');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Close navigation menu');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Open navigation menu');
    assert.equal(await page.evaluate(() => document.body.style.overflow), priorOverflow);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
    await browser.close();
  }
});
