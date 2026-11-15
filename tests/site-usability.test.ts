import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { after, before, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { chromium, type Browser, type Page } from 'playwright';

const root = process.env.SOTER_UI_SOURCE_ROOT ?? process.cwd();
const fixture = JSON.parse(readFileSync(path.join(process.cwd(), 'tests/fixtures/footer-link-destinations.json'), 'utf8')) as { hrefs: string[]; groups: string[] };
const consumed = new Map<string, string>();
const modules = new Map<string, Module>();

// Real source and React. The automatic JSX transform replaces Next's build step;
// no footer, navigation, Link, disclosure or authentication behavior is mocked.
function loadSource(filename: string): Record<string, unknown> {
  const cached = modules.get(filename);
  if (cached) return cached.exports;
  const bytes = readFileSync(filename);
  consumed.set(path.relative(root, filename), createHash('sha256').update(bytes).digest('hex'));
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = [path.join(process.cwd(), 'node_modules')];
  modules.set(filename, mod);
  const nativeRequire = createRequire(filename);
  mod.require = Object.assign((request: string) => {
    const stem = request.startsWith('@/') ? path.join(root, request.slice(2))
      : request.startsWith('.') ? path.resolve(path.dirname(filename), request) : undefined;
    if (stem) {
      const resolved = [stem, stem + '.ts', stem + '.tsx'].find(candidate => /\.tsx?$/.test(candidate) && existsSync(candidate));
      if (resolved) return loadSource(resolved);
    }
    return nativeRequire(request);
  }, nativeRequire);
  const compiled = ts.transpileModule(bytes.toString('utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    reportDiagnostics: true,
  });
  assert.equal((compiled.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error).length, 0);
  (mod as unknown as { _compile(code: string, filename: string): void })._compile(compiled.outputText, filename);
  return mod.exports;
}

function footerHtml() {
  const { SiteFooter } = loadSource(path.join(root, 'components/layout/SiteFooter.tsx'));
  return renderToStaticMarkup(React.createElement(SiteFooter as React.ComponentType<{ currentYear: number }>, { currentYear: new Date().getFullYear() }));
}

process.on('exit', () => console.log('FOOTER_USABILITY_CONSUMED ' + JSON.stringify(Object.fromEntries(consumed))));

test('footer retains every original link destination and safety disclosure in server HTML', () => {
  const html = footerHtml();
  const hrefs = [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map(match => match[1].replaceAll('&amp;', '&')).sort();
  assert.deepEqual(hrefs, fixture.hrefs);
  assert.match(html, /SoterAI lowers risk and misses things/);
  assert.match(html, /not independently audited/);
  assert.match(html, /aria-label="Email SoterAI support"/);
  assert.doesNotMatch(readFileSync(path.join(root, 'components/layout/SiteFooter.tsx'), 'utf8'), /^\s*["']use client["']/);
});

test('footer server HTML includes one native disclosure per group, initially usable without JavaScript', () => {
  const html = footerHtml();
  const groups = [...html.matchAll(/<details\b[^>]*data-footer-group="([^"]*)"[^>]*>/g)];
  assert.deepEqual(groups.map(match => match[1]), fixture.groups);
  for (const group of groups) assert.match(group[0], /\bopen(?:="")?(?:\s|>)/);
  assert.equal((html.match(/<summary\b/g) ?? []).length, fixture.groups.length);
});

// Integration gates are opt-in because they require the actual local Next app.
// Run with SOTER_USABILITY_ORIGIN=http://127.0.0.1:3130; no production/account IO.
const origin = process.env.SOTER_USABILITY_ORIGIN;
if (origin) {
  const target = new URL(origin);
  assert.equal(target.protocol, 'http:');
  assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname), 'Use only an explicitly supplied loopback preview.');
}
let browser: Browser | undefined;
before(async () => { if (origin) browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

async function withPage(width: number, javaScriptEnabled: boolean, inspect: (page: Page) => Promise<void>) {
  assert.ok(browser && origin);
  const context = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled });
  const errors: string[] = [];
  await context.route('**/*', route => {
    const request = route.request();
    const local = new URL(request.url()).origin === new URL(origin).origin;
    return local && ['GET', 'HEAD'].includes(request.method()) ? route.continue() : route.abort();
  });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.locator('footer').waitFor();
    await page.evaluate(() => document.fonts.ready.then(() => true));
    await inspect(page);
    assert.deepEqual(errors, [], 'No uncaught browser errors during the footer interaction.');
  } finally {
    await context.close();
  }
}

test('mobile footer collapses, opens with a keyboard, preserves links and stays compact', { skip: !origin }, async () => {
  await withPage(390, true, async page => {
    const groups = page.locator('footer details[data-footer-group]');
    assert.equal(await groups.count(), fixture.groups.length);
    await page.waitForFunction(() => [...document.querySelectorAll<HTMLDetailsElement>('footer details[data-footer-group]')].every(group => !group.open));
    const hrefs = await page.locator('footer a').evaluateAll(links => links.map(link => link.getAttribute('href')!).sort());
    assert.deepEqual(hrefs, fixture.hrefs);
    const footerHeight = await page.locator('footer').evaluate(footer => footer.getBoundingClientRect().height);
    assert.ok(footerHeight < 1_300, `Collapsed mobile footer should be shorter than the previous ~2000px: ${footerHeight}`);
    for (let index = 0; index < fixture.groups.length; index++) {
      const group = groups.nth(index);
      const summary = group.locator('summary');
      const target = await summary.boundingBox();
      assert.ok(target && target.height >= 44 && target.width >= 44);
      assert.equal(await group.locator('a').first().isVisible(), false);
      await summary.focus();
      await page.keyboard.press('Enter');
      assert.equal(await group.evaluate(element => (element as HTMLDetailsElement).open), true);
      for (const link of await group.locator('a').all()) assert.equal(await link.isVisible(), true);
      await page.keyboard.press('Space');
      assert.equal(await group.evaluate(element => (element as HTMLDetailsElement).open), false);
    }
    assert.equal(await page.getByRole('link', { name: 'Terms', exact: true }).isVisible(), true);
    assert.equal(await page.getByRole('link', { name: 'Privacy', exact: true }).isVisible(), true);
    assert.equal(await page.getByText(/SoterAI lowers risk and misses things/).isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
  });
});

test('desktop footer remains expanded and correctly adapts when crossing the mobile breakpoint', { skip: !origin }, async () => {
  await withPage(1440, true, async page => {
    const groups = page.locator('footer details[data-footer-group]');
    assert.equal(await groups.count(), fixture.groups.length);
    for (const group of await groups.all()) {
      assert.equal(await group.evaluate(element => (element as HTMLDetailsElement).open), true);
      assert.equal(await group.locator('summary').isVisible(), false);
      for (const link of await group.locator('a').all()) assert.equal(await link.isVisible(), true);
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForFunction(() => [...document.querySelectorAll<HTMLDetailsElement>('footer details[data-footer-group]')].every(group => !group.open));
    await groups.first().locator('summary').click();
    await groups.first().locator('a').first().focus();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForFunction(() => [...document.querySelectorAll<HTMLDetailsElement>('footer details[data-footer-group]')].every(group => group.open));
    await page.setViewportSize({ width: 390, height: 900 });
    await page.waitForFunction(() => [...document.querySelectorAll<HTMLDetailsElement>('footer details[data-footer-group]')].every(group => !group.open));
    assert.equal(await groups.first().locator('summary').evaluate(element => element === document.activeElement), true);
  });
});

test('without JavaScript all footer links remain usable and native mobile toggling still works', { skip: !origin }, async () => {
  await withPage(390, false, async page => {
    const groups = page.locator('footer details[data-footer-group]');
    assert.equal(await groups.count(), fixture.groups.length);
    for (const link of await page.locator('footer a').all()) assert.equal(await link.isVisible(), true);
    await groups.first().locator('summary').click();
    assert.equal(await groups.first().evaluate(element => (element as HTMLDetailsElement).open), false);
    await groups.first().locator('summary').click();
    assert.equal(await groups.first().locator('a').first().isVisible(), true);
  });
});
