import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium, type Browser, type Page } from 'playwright';

// Real Next routes and shared chrome; never migrate/seed a database for UI checks.
const origin = process.env.SOTER_USABILITY_ORIGIN;
if (origin) {
  const target = new URL(origin);
  assert.equal(target.protocol, 'http:');
  assert.ok(['localhost', '127.0.0.1'].includes(target.hostname));
}
let browser: Browser | undefined;
before(async () => { if (origin) browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

async function withPage(width: number, inspect: (page: Page) => Promise<void>) {
  assert.ok(origin);
  assert.ok(browser);
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const errors: string[] = [];
  await context.route('**/*', route => {
    const request = route.request();
    return new URL(request.url()).origin === new URL(origin).origin && ['GET', 'HEAD'].includes(request.method())
      ? route.continue() : route.abort();
  });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto(origin, { waitUntil: 'networkidle', timeout: 90_000 });
    assert.equal(response?.status(), 200);
    await page.locator('header.site-header').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await inspect(page);
    assert.deepEqual(errors, [], 'No uncaught browser errors.');
  } finally {
    await context.close();
  }
}

test('mobile header primary action and menu controls have 48px touch targets without overlap', { skip: !origin, timeout: 120_000 }, async () => {
  for (const width of [320, 360, 390, 414, 767, 768, 1023]) {
    await withPage(width, async page => {
      const header = page.locator('header.site-header');
      const cta = header.locator('a.button-primary[href="/playground"]');
      const menu = header.getByRole('button', { name: 'Open navigation menu', exact: true });
      const home = header.locator('a[href="/"]');
      const ctaBox = await cta.boundingBox();
      const menuBox = await menu.boundingBox();
      const homeBox = await home.boundingBox();
      console.log('HEADER_GEOMETRY ' + JSON.stringify({ width, ctaBox, menuBox, homeBox }));
      assert.ok(ctaBox && ctaBox.height >= 48 && ctaBox.width >= 48, `${width}px: primary CTA is at least 48px high.`);
      assert.ok(menuBox && menuBox.height >= 48 && menuBox.width >= 48, `${width}px: menu target is at least 48 × 48px.`);
      assert.ok(homeBox && homeBox.height >= 44, 'The unchanged home link keeps its accessible target.');
      assert.ok(homeBox.x + homeBox.width <= ctaBox.x && ctaBox.x + ctaBox.width <= menuBox.x, `${width}px: header controls must not overlap.`);
      assert.ok(menuBox.x + menuBox.width <= width, `${width}px: menu remains inside the viewport.`);
      await menu.click();
      const dialog = page.getByRole('dialog', { name: 'Site navigation', exact: true });
      await dialog.waitFor();
      const close = dialog.getByRole('button', { name: 'Close navigation menu', exact: true });
      const closeBox = await close.boundingBox();
      assert.ok(closeBox && closeBox.height >= 48 && closeBox.width >= 48, 'The close target is also 48 × 48px.');
      assert.equal(await dialog.locator('a[href="/playground"]').last().getAttribute('href'), '/playground');
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(await menu.evaluate(element => element === document.activeElement), true, 'Closing returns focus to the trigger.');
      assert.equal(await page.evaluate(() => document.body.style.overflow), '', 'Closing releases the original scroll state.');
    });
  }
});

test('generic playground CTA buttons use the same label on every marketing surface', { skip: !origin, timeout: 240_000 }, async () => {
  const routes = ['/', '/about', '/benchmarks', '/trust', '/blog', '/limitations', '/integrations', '/comparison', '/comparison/lakera', '/llm-firewall', '/vscode-ai-security', '/ai-platform-security', '/demo', '/blog/what-is-prompt-injection-types-examples-prevention'];
  await withPage(390, async page => {
    for (const path of routes) {
      const response = await page.goto(origin + path, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      assert.equal(response?.status(), 200, path + ': real route renders.');
      await page.locator('header.site-header').waitFor();
      const ctas = await page.locator('a.sa-btn[href="/playground"], a.button-primary[href="/playground"], a.button-secondary[href="/playground"]').evaluateAll(elements => elements.map(element => {
        const label = element.cloneNode(true) as HTMLElement;
        label.querySelectorAll('[aria-hidden="true"]').forEach(icon => icon.remove());
        return label.textContent?.trim().replace(/\s+/g, ' ') ?? '';
      }));
      console.log('CTA_INVENTORY ' + JSON.stringify({ path, labels: ctas }));
      assert.ok(ctas.length >= 2, path + ': retain both the header action and the page action.');
      assert.deepEqual(ctas, ctas.map(() => 'Try it live'), path + ': the same generic /playground action uses exactly "Try it live".');
    }
  });

});

test('mobile drawer cleans up at the desktop breakpoint and can reopen after resizing back', { skip: !origin, timeout: 120_000 }, async () => {
  await withPage(390, async page => {
    const header = page.locator('header.site-header');
    const menu = header.getByRole('button', { name: 'Open navigation menu', exact: true, includeHidden: true });
    const primary = header.locator('a.button-primary[href="/playground"]');
    const dialog = page.locator('#mobile-nav-panel');
    const cdp = await page.context().newCDPSession(page);
    async function keydownListeners() {
      const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
        expression: '(getEventListeners(window).keydown ?? []).map(event => event.listener)',
        includeCommandLineAPI: true,
      });
      assert.equal(exceptionDetails, undefined);
      assert.ok(result.objectId);
      return result.objectId;
    }
    async function addedKeydownListenerCount(before: string) {
      const { result, exceptionDetails } = await cdp.send('Runtime.callFunctionOn', {
        objectId: await keydownListeners(),
        functionDeclaration: 'function(before) { return this.filter(listener => !before.includes(listener)); }',
        arguments: [{ objectId: before }],
      });
      assert.equal(exceptionDetails, undefined);
      assert.ok(result.objectId);
      const added = result.objectId;
      return async () => {
        const { result, exceptionDetails } = await cdp.send('Runtime.callFunctionOn', {
          objectId: added,
          functionDeclaration: 'function(current) { return this.filter(listener => current.includes(listener)).length; }',
          arguments: [{ objectId: await keydownListeners() }],
          returnByValue: true,
        });
        assert.equal(exceptionDetails, undefined);
        return result.value as number;
      };
    }
    // Finish header hydration before counting persistent app listeners.
    await menu.click();
    await dialog.waitFor();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    const beforeOpen = await keydownListeners();
    await page.evaluate(() => { document.body.style.overflow = 'auto'; });
    await menu.click();
    await dialog.waitFor();
    const drawerListenerCount = await addedKeydownListenerCount(beforeOpen);
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
    assert.equal(await drawerListenerCount(), 1, 'Opening installs the real drawer keyboard listener.');
    assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true);

    await page.setViewportSize({ width: 1023, height: 900 });
    assert.equal(await dialog.isVisible(), true, 'The drawer stays usable below lg.');
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    console.log('DRAWER_RESIZE ' + JSON.stringify({
      width: 1024, attached: await dialog.count(), visible: await dialog.isVisible(),
      overflow: await page.evaluate(() => document.body.style.overflow),
      drawerKeyboardListeners: await drawerListenerCount(),
      primaryFocused: await primary.evaluate(element => element === document.activeElement),
    }));
    assert.equal(await dialog.count(), 0, 'Crossing lg removes the drawer, not merely its visible pixels.');
    assert.equal(await page.evaluate(() => document.body.style.overflow), 'auto', 'Desktop cleanup restores the exact pre-open overflow.');
    assert.equal(await menu.getAttribute('aria-expanded'), 'false');
    assert.equal(await menu.isVisible(), false);
    assert.equal(await primary.isVisible(), true);
    assert.equal(await primary.evaluate(element => element === document.activeElement), true, 'Desktop focus returns to the existing visible header primary action.');
    assert.equal(await drawerListenerCount(), 0, 'Desktop cleanup removes the drawer keyboard listener and focus trap.');

    await page.setViewportSize({ width: 390, height: 900 });
    assert.equal(await menu.isVisible(), true);
    assert.equal(await menu.getAttribute('aria-expanded'), 'false');
    assert.equal(await dialog.count(), 0, 'Returning to mobile does not reopen the drawer automatically.');
    for (const action of ['Escape', 'close button']) {
      const beforeReopen = await keydownListeners();
      await menu.click();
      await dialog.waitFor();
      const reopenedListenerCount = await addedKeydownListenerCount(beforeReopen);
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
      assert.equal(await reopenedListenerCount(), 1);
      if (action === 'Escape') await page.keyboard.press('Escape');
      else await dialog.getByRole('button', { name: 'Close navigation menu', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'auto', action + ': preserve original overflow after reopening.');
      assert.equal(await menu.evaluate(element => element === document.activeElement), true, action + ': mobile closing still restores trigger focus.');
      assert.equal(await reopenedListenerCount(), 0);
    }
    await cdp.detach();
  });
});

