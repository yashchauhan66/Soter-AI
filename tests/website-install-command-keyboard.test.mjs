import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright');
const esbuild = require('esbuild');
const axePath = require.resolve('axe-core/axe.min.js');
const phase = process.env.SOTER_REPAIR_PHASE;
if (phase) assert.match(phase, /^[a-z][a-z0-9-]*$/);
const evidence = phase ? resolve(root, 'docs/redesign/evidence/repair-cycle-1', phase) : null;
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const commands = [
  'code --install-extension soterai.soterai-ide-guard',
  'cursor --install-extension soterai.soterai-ide-guard',
  'windsurf --install-extension soterai.soterai-ide-guard',
  'kiro --install-extension soterai.soterai-ide-guard',
  'antigravity --install-extension soterai.soterai-ide-guard',
  'codium --install-extension soterai.soterai-ide-guard',
];
const report = {
  method: 'Real current CopyInstallCommand and React DOM in isolated Chromium. Six documented commands are inert strings, never executed. Real retained production CSS; a labelled 200px fixture constrains component width. Axe is scoped to scrollable-region-focusable, not complete WCAG acceptance. Clipboard is a labelled local stub, never the user clipboard. External traffic is blocked.',
  viewport: { width: 390, height: 844 },
  source: { path: 'app/extensions/ide/CopyInstallCommand.tsx', sha256: sha(readFileSync(resolve(root, 'app/extensions/ide/CopyInstallCommand.tsx'))) },
  commands,
  cases: [],
  external_requests: [],
  page_errors: [],
  cleanup: { browser_closed: false, server_closed: false },
};
let browser;
let server;
let base;

async function cleanup() {
  try {
    if (browser) {
      await browser.close();
      report.cleanup.browser_closed = !browser.isConnected();
    }
  } finally {
    if (server?.listening) {
      server.closeAllConnections();
      await new Promise((done) => server.close(done));
    }
    report.cleanup.server_closed = !server?.listening;
  }
}

before(async () => {
  try {
    const cssDir = resolve(root, '.next/static/css');
    const files = readdirSync(cssDir).filter((name) => name.endsWith('.css')).sort();
    assert.ok(files.length, 'a real prior production stylesheet is required');
    report.css_sources = files.map((name) => ({ path: '.next/static/css/' + name, sha256: sha(readFileSync(resolve(cssDir, name))) }));
    const css = files.map((name) => readFileSync(resolve(cssDir, name), 'utf8')).join('\n');
    const built = await esbuild.build({
      stdin: {
        contents: `import React from 'react';
import {createRoot} from 'react-dom/client';
import {CopyInstallCommand} from './app/extensions/ide/CopyInstallCommand';
const commands = ${JSON.stringify(commands)};
createRoot(document.getElementById('root')).render(
  <main data-sa-theme="light" className="sa-page">
    <h1>Isolated install-command keyboard regression</h1>
    <p>This is a component test, not the production IDE page.</p>
    {commands.map(command => <div key={command} style={{width:'200px',marginBottom:'16px'}}>
      <CopyInstallCommand command={command}/>
    </div>)}
  </main>
);`,
        loader: 'tsx', resolveDir: root,
      },
      bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
      metafile: true, define: { 'process.env.NODE_ENV': '"production"' },
    });
    report.bundle_inputs = Object.keys(built.metafile.inputs);
    const bundle = built.outputFiles[0].text;
    report.bundle_sha256 = sha(bundle);
    if (evidence) {
      mkdirSync(evidence, { recursive: true });
      writeFileSync(resolve(evidence, 'keyboard.bundle.js'), bundle);
    }
    server = http.createServer((request, response) => {
      if (request.url === '/bundle.js') {
        response.writeHead(200, { 'Content-Type': 'application/javascript' });
        response.end(bundle);
      } else if (request.url === '/style.css') {
        response.writeHead(200, { 'Content-Type': 'text/css' });
        response.end(css);
      } else {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end('<!doctype html><html lang="en"><head><title>Keyboard component regression</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
      }
    });
    server.requestTimeout = 5000;
    await new Promise((done, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', done);
    });
    base = `http://127.0.0.1:${server.address().port}`;
    report.origin = base;
    browser = await chromium.launch({ headless: true, timeout: 15000 });
  } catch (error) {
    await cleanup();
    throw error;
  }
}, { timeout: 30000 });

after(async () => {
  try { await cleanup(); }
  finally {
    if (evidence) writeFileSync(resolve(evidence, 'keyboard-observed.json'), JSON.stringify(report, null, 2) + '\n');
  }
}, { timeout: 20000 });

async function withPage(name, callback) {
  const entry = { name, passed: false, context_closed: false };
  report.cases.push(entry);
  const context = await browser.newContext({ viewport: report.viewport, reducedMotion: 'reduce' });
  try {
    await context.route('**/*', async (route) => {
      if (new URL(route.request().url()).origin === base) return route.continue();
      report.external_requests.push(route.request().url());
      return route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    await page.addInitScript(() => {
      window.__syntheticClipboardCalls = [];
      window.__syntheticClipboardFailure = false;
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { async writeText(text) {
          window.__syntheticClipboardCalls.push(text);
          if (window.__syntheticClipboardFailure) throw new DOMException('Synthetic clipboard rejection', 'NotAllowedError');
        } },
      });
    });
    page.on('pageerror', (error) => report.page_errors.push({ case: name, message: error.message }));
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.locator('code').nth(5).waitFor();
    await callback(page, entry);
    assert.equal(report.page_errors.filter((error) => error.case === name).length, 0);
    entry.passed = true;
  } catch (error) {
    entry.error = error.message;
    throw error;
  } finally {
    await context.close();
    entry.context_closed = true;
  }
}

test('all six real install-command code regions are keyboard reachable, scrollable and axe-clean', { timeout: 30000 }, async () => {
  await withPage('keyboard-six-commands', async (page, entry) => {
    entry.commands = await page.locator('code').allTextContents();
    assert.deepEqual(entry.commands, commands);
    await page.addScriptTag({ path: axePath });
    entry.axe = await page.evaluate(async () => {
      const result = await window.axe.run(document, { runOnly: { type: 'rule', values: ['scrollable-region-focusable'] }, resultTypes: ['violations'] });
      return result.violations.map((violation) => ({ id: violation.id, impact: violation.impact, targets: violation.nodes.map((node) => node.target) }));
    });
    entry.geometry = await page.locator('code').evaluateAll((elements) => elements.map((element) => ({ text: element.textContent, tabIndex: element.tabIndex, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth })));
    assert.equal(entry.geometry.filter((row) => row.scrollWidth > row.clientWidth).length, 6, 'all six actual code regions must overflow in the phone fixture');
    assert.deepEqual(entry.axe, [], 'the six actual scrollable code regions need keyboard entry');
    entry.keyboard = [];
    for (let index = 0; index < commands.length; index++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent, tabIndex: document.activeElement?.tabIndex, outlineWidth: getComputedStyle(document.activeElement).outlineWidth, outlineStyle: getComputedStyle(document.activeElement).outlineStyle }));
      assert.equal(focused.tag, 'CODE');
      assert.equal(focused.text, commands[index]);
      assert.equal(focused.tabIndex, 0);
      assert.notEqual(focused.outlineStyle, 'none', 'use the real existing visible-focus stylesheet');
      assert.ok(parseFloat(focused.outlineWidth) > 0);
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction((index) => document.querySelectorAll('code')[index].scrollLeft > 0, index);
      const scrollLeft = await page.locator('code').nth(index).evaluate((element) => element.scrollLeft);
      entry.keyboard.push({ ...focused, scrollLeft });
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'BUTTON', 'copy stays next in keyboard order');
    }
  });
});

test('the unchanged copy controls send all six exact inert commands and show success', { timeout: 30000 }, async () => {
  await withPage('clipboard-success-six-commands', async (page, entry) => {
    for (let index = 0; index < commands.length; index++) {
      const button = page.locator('button').nth(index);
      await button.click();
      await assert.doesNotReject(() => button.getAttribute('aria-label').then((label) => assert.equal(label, 'Copied install command')));
    }
    entry.clipboard_calls = await page.evaluate(() => window.__syntheticClipboardCalls);
    assert.deepEqual(entry.clipboard_calls, commands);
  });
});

test('clipboard failure remains disclosed and the existing reset restores the copy control', { timeout: 30000 }, async () => {
  await withPage('clipboard-failure-reset', async (page, entry) => {
    await page.evaluate(() => { window.__syntheticClipboardFailure = true; });
    await page.locator('button').first().click();
    await page.getByRole('button', { name: 'Copy failed install command', exact: true }).waitFor();
    entry.failure_text = await page.locator('[aria-live="polite"]').first().textContent();
    assert.match(entry.failure_text, /Could not copy the install command. Select the command manually/);
    await page.waitForFunction(() => document.querySelector('button')?.getAttribute('aria-label') === 'Copy install command');
    entry.reset_observed = true;
  });
});
