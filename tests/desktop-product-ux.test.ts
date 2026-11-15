import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import { dirname, relative, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { Browser, BrowserContext, Page } from 'playwright';

// Source-bound component browser tests, not a substitute for the Next production build.
// Real React, Next Link, Next search-params context, components, CSS and transport run.
// Only next/font/local's compile-time macro is adapted; the real local font bytes load.
// All analysis traffic is blocked unless a test installs an explicitly synthetic fixture.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const { build } = require('esbuild') as typeof import('esbuild');
const { chromium } = require('playwright') as typeof import('playwright');
const evidence = process.env.SOTER_PRODUCT_EVIDENCE;
const sourceOverlay = process.env.SOTER_PRODUCT_SOURCE;
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const consumed = new Map<string, { path: string; consumed_from: string; sha256: string }>();
const report = {
  environment: 'ephemeral loopback, real TSX components; no shared site chrome, backend, account or billing activity',
  source_overlay: sourceOverlay ?? null,
  test_sha256: sha(readFileSync(fileURLToPath(import.meta.url))),
  runtime: process.version,
  browser_version: '',
  bundle_sha256: '',
  cases: [] as Array<{ name: string; passed: boolean; observations: unknown[]; error?: string }>,
  cleanup: { browser_closed: false, server_closed: false },
};
let browser: Browser;
let server: http.Server;
let origin: string;

function source(path: string): Buffer {
  const overlay = sourceOverlay ? resolve(sourceOverlay, path) : '';
  return readFileSync(overlay && existsSync(overlay) ? overlay : resolve(root, path));
}

async function cleanup() {
  if (browser) {
    await browser.close();
    report.cleanup.browser_closed = !browser.isConnected();
  }
  if (server?.listening) {
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
  }
  report.cleanup.server_closed = !server?.listening;
}

before(async () => {
  try {
    const built = await build({
      stdin: {
        contents: `import React from 'react';
import {createRoot} from 'react-dom/client';
import {SearchParamsContext} from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import Home from './app/page';
import PlaygroundPage from './app/playground/page';
import PricingPage from './app/pricing/page';
import * as Pricing from './components/sa/PricingPlans';
import {SaRoot} from './components/sa/SaRoot';
import {PLANS} from './lib/sa/pricing';
import {ALL_PRESETS, LANGUAGE_PRESETS, LANGUAGE_LIMIT} from './lib/sa/presets';
import {NUMBERS_WITH_LIMITS, GENERAL_LIMIT, PRIVACY_NOTE} from './lib/sa/claims';
import {RECORDED_RESULT, RECORDED_AT, RECORDED_TEXT} from './lib/sa/recorded';
window.__productFixtures = {PLANS, ALL_PRESETS, LANGUAGE_PRESETS, LANGUAGE_LIMIT, NUMBERS_WITH_LIMITS, GENERAL_LIMIT, PRIVACY_NOTE, RECORDED_RESULT, RECORDED_AT, RECORDED_TEXT};
const Comparison = Reflect.get(Pricing, 'PricingComparison');
const route = location.pathname;
const app = route === '/playground' ? <PlaygroundPage /> : route === '/pricing' ? <PricingPage /> : route === '/comparison' ? <SaRoot><main className="sa-page">{Comparison ? <Comparison plans={PLANS} /> : <p>Comparison component is not implemented.</p>}</main></SaRoot> : <Home />;
const mounted = createRoot(document.getElementById('root'));
window.__unmountProduct = () => mounted.unmount();
mounted.render(<SearchParamsContext.Provider value={new URLSearchParams(location.search)}>{app}</SearchParamsContext.Provider>);`,
        loader: 'tsx', resolveDir: root,
      },
      bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
      outdir: resolve(root, 'unused-product-test-output'), metafile: true,
      tsconfig: resolve(root, 'tsconfig.json'),
      define: { 'process.env': '{}', 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_APP_URL': '"https://soterai.in"' },
      plugins: [{
        name: 'source-pins-and-next-font-macro',
        setup(builder) {
          builder.onResolve({ filter: /^next\/font\/local$/ }, () => ({ path: 'next/font/local', namespace: 'font-macro' }));
          builder.onLoad({ filter: /.*/, namespace: 'font-macro' }, () => ({ contents: 'export default function localFont() { return {variable:"ux-local-fonts"}; }', loader: 'js' }));
          builder.onLoad({ filter: /\.(tsx?|css)$/ }, (args) => {
            if (args.path.includes('node_modules')) return;
            const path = relative(root, args.path).replaceAll('\\', '/');
            const overlay = sourceOverlay ? resolve(sourceOverlay, path) : '';
            const consumedFrom = overlay && existsSync(overlay) ? overlay : args.path;
            const bytes = readFileSync(consumedFrom);
            consumed.set(path, { path, consumed_from: consumedFrom, sha256: sha(bytes) });
            return { contents: bytes.toString(), resolveDir: dirname(args.path), loader: path.endsWith('.css') ? 'css' : path.endsWith('.tsx') ? 'tsx' : 'ts' };
          });
        },
      }],
    });
    const js = built.outputFiles!.find((file) => file.path.endsWith('.js'))!.contents;
    const css = built.outputFiles!.find((file) => file.path.endsWith('.css'))!.contents;
    report.bundle_sha256 = sha(Buffer.from(js));
    for (const path of ['components/sa/Playground.tsx', 'components/sa/HeroDemo.tsx', 'components/sa/PricingPlans.tsx', 'lib/sa/client.ts', 'lib/sa/review.ts']) {
      assert.ok(consumed.has(path), `real production source was consumed: ${path}`);
    }
    const fontCss = `@font-face{font-family:Newsreader;src:url('/fonts/Newsreader-latin.woff2') format('woff2');font-weight:400 600;font-display:swap}@font-face{font-family:'IBM Plex Mono';src:url('/fonts/IBMPlexMono-400-latin.woff2') format('woff2');font-weight:400;font-display:swap}@font-face{font-family:'IBM Plex Mono';src:url('/fonts/IBMPlexMono-600-latin.woff2') format('woff2');font-weight:600;font-display:swap}body{margin:0}.sa{--font-sa-display:Newsreader;--font-sa-mono:'IBM Plex Mono'}button,textarea,select{font:inherit}`;
    server = http.createServer((request, response) => {
      if (request.url === '/bundle.js' || request.url === '/bundle.css') {
        response.writeHead(200, { 'Content-Type': request.url.endsWith('.js') ? 'application/javascript' : 'text/css' });
        response.end(request.url.endsWith('.js') ? js : css);
      } else if (['/fonts/Newsreader-latin.woff2', '/fonts/IBMPlexMono-400-latin.woff2', '/fonts/IBMPlexMono-600-latin.woff2'].includes(request.url ?? '')) {
        response.writeHead(200, { 'Content-Type': 'font/woff2' });
        response.end(source(`components/sa${request.url}`));
      } else if (request.url?.startsWith('/api/')) {
        response.writeHead(503, { 'Content-Type': 'application/json' });
        response.end('{"error":"Local UX harness: analysis is not connected."}');
      } else {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Source-bound product UX test</title><style>${fontCss}</style><link rel="stylesheet" href="/bundle.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`);
      }
    });
    await new Promise<void>((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
    origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    browser = await chromium.launch({ headless: true });
    report.browser_version = browser.version();
  } catch (error) {
    await cleanup();
    throw error;
  }
}, { timeout: 45000 });

after(async () => {
  try { await cleanup(); } finally {
    if (evidence) {
      mkdirSync(evidence, { recursive: true });
      writeFileSync(resolve(evidence, 'browser-observed.json'), JSON.stringify({ ...report, sources: [...consumed.values()] }, null, 2) + '\n');
    }
  }
}, { timeout: 20000 });

type Entry = typeof report.cases[number];
async function withPage(entry: Entry, path: string, callback: (page: Page, context: BrowserContext) => Promise<void>, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport });
  const errors: string[] = [];
  try {
    await context.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(4000);
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(origin + path);
    entry.observations.push({ path, pageErrorsOnLoad: [...errors], bodyOnLoad: (await page.locator('body').textContent())?.slice(0, 1000) });
    assert.deepEqual(errors, [], 'component harness must load before checking behavior');
    await page.locator('.sa').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await callback(page, context);
    assert.deepEqual(errors, [], 'the production component must not throw');
  } finally { await context.close(); }
}

function browserCase(name: string, callback: (entry: Entry) => Promise<void>) {
  test(name, { timeout: 60000 }, async () => {
    const entry: Entry = { name, passed: false, observations: [] };
    report.cases.push(entry);
    try { await callback(entry); entry.passed = true; } catch (error) {
      entry.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  });
}

browserCase('playground action follows input and status before the optional preset catalogue', async (entry) => {
  await withPage(entry, '/playground', async (page) => {
    const result = await page.evaluate(() => {
      const input = document.querySelector('textarea')!;
      const action = [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Check this text')!;
      const between = [...document.querySelectorAll('button, select, summary')].filter((element) => (input.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) && (element.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING));
      const disclosure = [...document.querySelectorAll('details')].find((element) => /More examples/i.test(element.querySelector('summary')?.textContent ?? ''));
      const visiblePresets = [...document.querySelectorAll('.sa-chip')].filter((element) => (element as HTMLElement).offsetParent !== null && !element.closest('details:not([open])'));
      return {
        interveningControls: between.map((element) => element.textContent?.trim()),
        optionalCatalogue: Boolean(disclosure),
        catalogueClosed: disclosure?.open === false,
        visiblePresetCount: visiblePresets.length,
        inputBottom: input.getBoundingClientRect().bottom,
        actionTop: action.getBoundingClientRect().top,
      };
    });
    entry.observations.push(result);
    assert.deepEqual(result.interveningControls, [], 'no examples may separate text from the primary action');
    assert.equal(result.optionalCatalogue, true, 'the full catalogue needs a native More examples disclosure');
    assert.equal(result.catalogueClosed, true, 'examples are progressively disclosed by default');
    assert.ok(result.visiblePresetCount >= 3 && result.visiblePresetCount <= 4, 'show a representative few, not the complete catalogue');
    assert.ok(result.actionTop - result.inputBottom <= 128, 'privacy and status must not bury the action');
  });
});

browserCase('a pending playground check can be cancelled without showing a late verdict', async (entry) => {
  await withPage(entry, '/playground?preset=safe', async (page) => {
    let release!: () => void;
    const gate = new Promise<void>((done) => { release = done; });
    await page.route('**/api/guard/analyze', async (route) => {
      await gate;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ allowed: true, action: 'ALLOW', riskScore: 0, findings: [], reason: 'SYNTHETIC UX FIXTURE, not an engine measurement.' }) });
    });
    try {
      const sent = page.waitForRequest('**/api/guard/analyze');
      await page.getByRole('button', { name: 'Check this text', exact: true }).click();
      await sent;
      assert.equal(await page.getByRole('button', { name: 'Cancel check', exact: true }).count(), 1, 'a pending check needs an explicit cancellation control');
      await page.getByRole('button', { name: 'Cancel check', exact: true }).click();
      assert.match(await page.locator('.sa-play').innerText(), /Check cancelled\. No verdict is shown\./);
      assert.equal(await page.getByRole('button', { name: 'Check this text', exact: true }).isEnabled(), true);
      assert.equal(await page.getByLabel('Text to check', { exact: true }).evaluate((element) => element === document.activeElement), true, 'cancellation returns focus to the editable text');
      release();
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      assert.equal(await page.locator('.sa-play .sa-stamp').count(), 0, 'late success cannot overwrite cancellation');
      entry.observations.push({ cancelled: true, lateVerdictCount: await page.locator('.sa-play .sa-stamp').count() });
    } finally { release(); }
  });
});

browserCase('all existing presets and language selections survive keyboard disclosure without submitting', async (entry) => {
  await withPage(entry, '/playground', async (page) => {
    const requests: string[] = [];
    page.on('request', (request) => { if (request.url().endsWith('/api/guard/analyze')) requests.push(request.url()); });
    const fixtures = await page.evaluate(() => Reflect.get(window, '__productFixtures'));
    const disclosure = page.locator('details').filter({ has: page.locator('summary', { hasText: 'More examples' }) });
    const summary = disclosure.locator('summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    assert.equal(await disclosure.getAttribute('open'), '', 'Enter opens the native disclosure');
    const visited: string[] = [];
    for (const preset of fixtures.ALL_PRESETS) {
      const control = page.getByRole('button', { name: preset.label, exact: true });
      assert.equal(await control.count(), 1, `one reachable control for ${preset.id}`);
      await control.click();
      assert.equal(await page.getByLabel('Text to check', { exact: true }).inputValue(), preset.text, preset.id);
      assert.equal(await page.getByRole('button', { name: preset.direction === 'INPUT' ? 'A prompt' : 'A model reply', exact: true }).getAttribute('aria-pressed'), 'true', preset.id);
      assert.equal(await control.getAttribute('aria-pressed'), 'true', preset.id);
      visited.push(preset.id);
    }
    const languages: string[] = [];
    for (const language of fixtures.LANGUAGE_PRESETS) {
      await page.getByLabel('Same instruction override in another language', { exact: true }).selectOption(language.code);
      assert.equal(await page.getByLabel('Text to check', { exact: true }).inputValue(), language.text, language.code);
      assert.equal(await page.getByRole('button', { name: 'A prompt', exact: true }).getAttribute('aria-pressed'), 'true');
      languages.push(language.code);
    }
    const retained = await page.getByLabel('Text to check', { exact: true }).inputValue();
    await summary.focus();
    await page.keyboard.press('Space');
    assert.equal(await disclosure.getAttribute('open'), null);
    assert.equal(await page.getByLabel('Text to check', { exact: true }).inputValue(), retained);
    await page.keyboard.press('Space');
    assert.equal(await page.getByLabel('Same instruction override in another language', { exact: true }).inputValue(), fixtures.LANGUAGE_PRESETS.at(-1).code);
    assert.deepEqual(requests, [], 'selection is local only, never an automatic engine call');
    assert.equal(new Set(visited).size, fixtures.ALL_PRESETS.length);
    assert.equal(new Set(languages).size, fixtures.LANGUAGE_PRESETS.length);
    entry.observations.push({ presetIds: visited, languageCodes: languages, analysisRequests: requests, disclosureRetainsSelection: true });
  });
});

browserCase('playground validates trimmed empty and over-limit text while retaining the privacy notice', async (entry) => {
  await withPage(entry, '/playground', async (page) => {
    const field = page.getByLabel('Text to check', { exact: true });
    const action = page.getByRole('button', { name: 'Check this text', exact: true });
    assert.equal(await action.isDisabled(), true);
    await field.fill('   \n  ');
    assert.equal(await action.isDisabled(), true);
    await field.fill('x'.repeat(8001));
    assert.equal(await field.getAttribute('aria-invalid'), 'true');
    assert.equal(await action.isDisabled(), true);
    assert.match(await page.locator('.sa-field__meta').textContent() ?? '', /8,001 \/ 8,000 \(too long\)/);
    await field.fill('  ' + 'x'.repeat(8000) + '  ');
    assert.equal(await action.isEnabled(), true, 'the unchanged contract counts trimmed text');
    assert.equal(await field.getAttribute('aria-invalid'), null);
    const privacy = await page.evaluate(() => Reflect.get(window, '__productFixtures').PRIVACY_NOTE);
    assert.ok((await page.locator('.sa-field__meta').textContent())?.includes(privacy));
    entry.observations.push({ emptyDisabled: true, whitespaceDisabled: true, over8000Disabled: true, trimmed8000Enabled: true, privacyRetained: true });
  });
});

browserCase('editing text or direction invalidates a previous playground result instead of mislabelling the new input', async (entry) => {
  await withPage(entry, '/playground?preset=personal-data', async (page) => {
    const recorded = await page.evaluate(() => Reflect.get(window, '__productFixtures').RECORDED_RESULT);
    const requests: unknown[] = [];
    await page.route('**/api/guard/analyze', (route) => {
      requests.push(route.request().postDataJSON());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(recorded) });
    });
    for (const change of ['text', 'direction', 'preset', 'language']) {
      await page.getByRole('button', { name: 'Check this text', exact: true }).click();
      await page.locator('.sa-play .sa-stamp').waitFor();
      if (change === 'text') await page.getByLabel('Text to check', { exact: true }).fill('  Only synthetic sample text.  ');
      if (change === 'direction') await page.getByRole('button', { name: 'A model reply', exact: true }).click();
      if (change === 'preset') await page.getByRole('button', { name: 'Personal data', exact: true }).click();
      if (change === 'language') {
        await page.locator('summary', { hasText: 'More examples' }).click();
        await page.getByLabel('Same instruction override in another language', { exact: true }).selectOption('hi');
      }
      assert.equal(await page.locator('.sa-play .sa-stamp').count(), 0, `${change} must clear a verdict for different input`);
      assert.match(await page.locator('.sa-play').innerText(), /The result appears here/);
    }
    assert.equal(requests.length, 4, 'editing must never submit implicitly');
    entry.observations.push({ clearedOn: ['text', 'direction', 'preset', 'language'], requests, fixture: 'recorded response supplied as an isolated synthetic HTTP fixture; not a live engine test' });
  });
});

browserCase('hero first paint tells the recorded input finding and action before offering another run', async (entry) => {
  for (const width of [1366, 1440, 1920]) {
    await withPage(entry, '/', async (page) => {
      const demo = page.locator('.sa-hero-demo');
      const fixtures = await page.evaluate(() => Reflect.get(window, '__productFixtures'));
      const view = await demo.evaluate((element) => {
        const firstInput = element.querySelector('.sa-review');
        const firstRun = element.querySelector('button');
        const box = element.getBoundingClientRect();
        const details = [...element.querySelectorAll('details')];
        return {
          height: box.height,
          provenance: element.querySelector('.sa-hero-demo__bar')?.textContent,
          inputBeforeRun: Boolean(firstInput && firstRun && (firstInput.compareDocumentPosition(firstRun) & Node.DOCUMENT_POSITION_FOLLOWING)),
          closedDetailLabels: details.filter((detail) => !detail.open).map((detail) => detail.querySelector('summary')?.textContent),
          visibleText: (element as HTMLElement).innerText,
        };
      });
      entry.observations.push({ width, ...view });
      assert.ok(view.inputBeforeRun, 'show the actual example before the live-run catalogue');
      assert.ok(view.height <= 640, `desktop hero demo must be a compact story, not the inherited 874px panel (${width}: ${view.height})`);
      assert.ok(view.provenance?.includes(`Recorded ${fixtures.RECORDED_AT}`), 'the visible badge names the real recording date');
      assert.ok(view.visibleText.includes('Email address') && view.visibleText.includes('Phone number'), 'the finding is readable without opening implementation details');
      assert.ok(view.visibleText.includes('[REDACTED_EMAIL]') && view.visibleText.includes('[REDACTED_PHONE]'), 'show the real resulting text on first paint');
      assert.ok(view.visibleText.includes(fixtures.GENERAL_LIMIT), 'the security limit remains with the example');
      assert.ok(view.closedDetailLabels.some((label) => /scores.*timings/i.test(label ?? '')), 'raw figures are available through a labelled disclosure');
      assert.equal(await demo.getByRole('link', { name: 'Paste your own text in the playground.' }).getAttribute('href'), '/playground');
    }, { width, height: 1000 });
  }
});

browserCase('hero live results retain the selected example qualification with its displayed numbers', async (entry) => {
  await withPage(entry, '/', async (page) => {
    const demo = page.locator('.sa-hero-demo');
    const fixtures = await page.evaluate(() => Reflect.get(window, '__productFixtures'));
    const preset = fixtures.ALL_PRESETS.find((item: { id: string }) => item.id === 'aadhaar-pan');
    await page.route('**/api/guard/analyze', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtures.RECORDED_RESULT) }));
    await demo.locator('summary', { hasText: 'Run a live example' }).click();
    const labels = await demo.locator('button').allTextContents();
    assert.equal(labels.length, 5, 'retain all five inherited hero examples');
    await demo.getByRole('button', { name: preset.label, exact: true }).click();
    await demo.locator('.sa-hero-demo__bar .sa-badge--stable').waitFor();
    assert.equal((await demo.locator('.sa-hero-demo__bar .sa-badge').textContent())?.trim(), 'Live engine');
    assert.ok((await demo.innerText()).includes(preset.limit), 'a language or identifier qualification cannot disappear when its live example is shown');
    const details = demo.locator('details').filter({ has: page.locator('summary', { hasText: 'Findings, scores & timings' }) });
    await details.locator('summary').click();
    assert.ok((await details.innerText()).includes(preset.limit), 'keep the example-specific qualification next to raw scores too');
    assert.ok((await details.innerText()).includes(fixtures.GENERAL_LIMIT));
    assert.match(await details.innerText(), /One request, not a performance benchmark/);
    entry.observations.push({ retainedQuickLabels: labels, qualification: preset.limit, fixture: 'recorded response reused solely as synthetic UI transport fixture' });
  });
});

browserCase('homepage leads from product example to audience paths qualified evidence and documentation', async (entry) => {
  await withPage(entry, '/', async (page) => {
    const sections = await page.locator('main section[aria-labelledby]').evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-labelledby')));
    entry.observations.push({ sectionOrder: sections });
    assert.deepEqual(sections.slice(0, 4), ['hero-title', 'paths', 'numbers', 'pricing'], 'decision sequence comes before the complete product catalogue');
    assert.equal(await page.getByRole('heading', { level: 1 }).textContent(), 'Detect prompt injection. Redact sensitive data.');
    const primary = page.locator('.sa-hero__actions').first();
    assert.equal(await primary.getByRole('link', { name: 'Try it live', exact: true }).getAttribute('href'), '/playground');
    assert.equal(await primary.getByRole('link', { name: 'Create a free account', exact: true }).getAttribute('href'), '/signup');
    const paths = page.locator('section[aria-labelledby="paths"]');
    for (const href of ['/docs/quickstart', '/ai-user-security', '/integrations']) {
      assert.equal(await paths.locator(`a[href="${href}"]`).count(), 1, `an explicit entry path for ${href}`);
    }
    const next = page.locator('section[aria-labelledby="pricing"]');
    assert.equal(await next.locator('a.sa-btn[href="/docs/quickstart"]').count(), 1, 'documentation is a prominent next action, not a footer-only link');
    assert.equal(await next.getByRole('link', { name: 'See plans', exact: true }).getAttribute('href'), '/pricing');
    const fixtures = await page.evaluate(() => Reflect.get(window, '__productFixtures'));
    const allResults = page.locator('section[aria-labelledby="numbers"] details');
    assert.equal(await allResults.count(), 1, 'full evidence is retained in a labelled native disclosure');
    assert.equal(await allResults.evaluate((element) => (element as HTMLDetailsElement).open), false, 'full results stay collapsed on first paint');
    assert.doesNotMatch(await page.locator('section[aria-labelledby="numbers"]').innerText(), /61\.54%\s*recall/, 'blind recall remains in full results, not the direct homepage highlight');
    await allResults.locator('summary').click();
    const rows = await allResults.locator('tbody tr').allTextContents();
    const published = fixtures.NUMBERS_WITH_LIMITS.filter((item: { blocked?: string }) => !item.blocked);
    assert.equal(rows.length, published.length);
    for (const number of published) {
      assert.ok(rows.some((row) => row.includes(number.number) && row.includes(number.test) && row.includes(number.limit)), `keep number, conditions and qualification together: ${number.number}`);
    }
    const summaries = await page.locator('.sa-evidence-summary > div').allTextContents();
    assert.equal(summaries.length, 1);
    for (const summary of summaries) {
      assert.ok(published.some((number: { number: string; test: string; limit: string }) => summary.includes(number.number) && summary.includes(number.test) && summary.includes(number.limit)), 'summary figures keep the complete qualification in the same row');
    }
    assert.doesNotMatch(summaries.join('\n'), /blind held-out|61\.54%/, 'blind recall is retained in the full disclosure, not promoted in the homepage summary');
    for (const id of ['decides', 'where', 'finds', 'faq', 'closing']) assert.equal(await page.locator(`#${id}`).count(), 1, `inherited anchor ${id} stays reachable`);
    entry.observations.push({ comparisonRows: rows.length, qualifiedSummaryRows: summaries, ctasPreserved: true });
  });
});

browserCase('pricing comparison represents every plan with its exact published price audience and benefits', async (entry) => {
  await withPage(entry, '/comparison', async (page) => {
    const plans = await page.evaluate(() => Reflect.get(window, '__productFixtures').PLANS);
    assert.equal(await page.getByRole('table').count(), 1, 'all offered plans need a complete comparison');
    const headers = await page.getByRole('columnheader').allTextContents();
    assert.deepEqual(headers.slice(1), plans.map((plan: { name: string }) => plan.name));
    const rows = await page.locator('tbody tr').evaluateAll((elements) => elements.map((row) => [...row.children].map((cell) => cell.textContent ?? '')));
    for (const [index, plan] of plans.entries()) {
      assert.ok(rows.some((row) => row[index + 1].includes(plan.price) && row[index + 1].includes(plan.period ?? '')), plan.name + ' price and period');
      assert.ok(rows.some((row) => row[index + 1] === plan.audience), plan.name + ' audience');
      for (const feature of plan.features) assert.ok(rows.some((row) => row[index + 1].includes(feature)), plan.name + ': ' + feature);
    }
    assert.doesNotMatch(await page.locator('main').innerText(), /most popular|stronger detection on/i);
    assert.match(await page.locator('main').innerText(), /same detection engine/);
    entry.observations.push({ headers, rows, allPlansRepresented: plans.length });
  });
});

browserCase('pricing explains signup-first next to unchanged self-serve actions without implying a purchase', async (entry) => {
  await withPage(entry, '/pricing', async (page) => {
    const plans = await page.evaluate(() => Reflect.get(window, '__productFixtures').PLANS);
    for (const plan of plans) {
      const card = page.locator(`section[aria-labelledby="plan-${plan.id}"]`);
      assert.equal(await card.getByRole('link').getAttribute('href'), plan.cta.href);
      assert.ok((await card.getByRole('link').textContent())?.startsWith(plan.cta.label));
      assert.ok((await card.locator('.sa-plan__price').textContent())?.includes(plan.price));
      assert.deepEqual(await card.locator('.sa-plan__list li').allTextContents(), plan.features);
      if (plan.cta.href === '/signup') {
        assert.match(await card.locator('.sa-plan__cta').innerText(), /Account first, not checkout\./, 'every self-serve CTA explains its actual destination');
      }
    }
    assert.match(await page.locator('.sa-plans-intro').innerText(), /does not preselect a paid plan/);
    assert.match(await page.locator('.sa-plans-intro').innerText(), /Billing after signing in/);
    entry.observations.push({ planIds: plans.map((plan: { id: string }) => plan.id), preservedDestinations: plans.map((plan: { cta: unknown }) => plan.cta), signupExplanationVisible: true });
  });
});

browserCase('playground connects an explicitly live result to a prominent real quickstart', async (entry) => {
  await withPage(entry, '/playground?preset=personal-data', async (page) => {
    assert.equal(await page.locator('main > header a.sa-btn[href="/docs/quickstart"]').count(), 1, 'keep the integration next step beside the inspection workspace');
    assert.doesNotMatch(await page.locator('main').innerText(), /in about five minutes/);
    assert.equal(await page.getByText('Live engine result', { exact: true }).count(), 0, 'an idle panel has no result provenance');
    const fixtures = await page.evaluate(() => Reflect.get(window, '__productFixtures'));
    await page.route('**/api/guard/analyze', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtures.RECORDED_RESULT) }));
    await page.getByRole('button', { name: 'Check this text', exact: true }).click();
    await page.getByText('Live engine result', { exact: true }).waitFor();
    const result = page.getByRole('region', { name: 'Inspection result', exact: true });
    assert.equal(await result.count(), 1, 'the returned result is an independently labelled region');
    assert.ok((await result.innerText()).includes(fixtures.GENERAL_LIMIT));
    await page.getByRole('tab', { name: 'Raw JSON', exact: true }).click();
    assert.deepEqual(JSON.parse((await result.getByRole('tabpanel', { name: 'Raw JSON', exact: true }).locator('pre').textContent()) ?? '{}'), fixtures.RECORDED_RESULT);
    await page.getByRole('tab', { name: 'Code', exact: true }).click();
    assert.match(await result.getByRole('tabpanel', { name: 'Code', exact: true }).locator('pre').textContent() ?? '', /https:\/\/soterai\.in\/api\/guard\/analyze/);
    entry.observations.push({ provenanceAfterValidatedFixture: 'Live engine result', rawResponsePreserved: true, quickstartHref: '/docs/quickstart' });
  });
});

browserCase('desktop product layouts use a compact control scale and deliberate reading lanes', async (entry) => {
  for (const width of [1366, 1440, 1920]) {
    for (const path of ['/', '/playground', '/pricing', '/comparison']) {
      await withPage(entry, path, async (page) => {
        const geometry = await page.evaluate(() => {
          const main = document.querySelector('main')!;
          const heading = main.querySelector('h1');
          const paths = main.querySelector('.sa-home__paths');
          const pathsHead = paths?.querySelector('.sa-section__head')?.getBoundingClientRect();
          const pathsList = paths?.querySelector('.sa-pathlist')?.getBoundingClientRect();
          const next = main.querySelector('.sa-home__next');
          const nextChildren = next ? [...next.children].map((element) => element.getBoundingClientRect()) : [];
          const action = [...main.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Check this text');
          const controls = [...main.querySelectorAll('.sa-btn, .sa-chip, .sa-select, .sa-segmented button, .sa-tab, .sa-code__copy')]
            .filter((element) => !element.closest('details:not([open])') && (element as HTMLElement).offsetParent !== null)
            .map((element) => ({ text: element.textContent?.trim(), height: element.getBoundingClientRect().height, font: getComputedStyle(element).fontFamily, size: getComputedStyle(element).fontSize }));
          return {
            overflow: document.documentElement.scrollWidth > innerWidth,
            headingSize: heading ? parseFloat(getComputedStyle(heading).fontSize) : null,
            pathsBesideIntro: Boolean(pathsHead && pathsList && pathsList.x >= pathsHead.right && Math.abs(pathsList.y - pathsHead.y) < 32),
            nextStepBesidePricing: nextChildren.length === 2 && nextChildren[1].x >= nextChildren[0].right && Math.abs(nextChildren[1].y - nextChildren[0].y) < 4,
            sectionTopPadding: paths ? parseFloat(getComputedStyle(paths).paddingTop) : null,
            actionBottom: action?.getBoundingClientRect().bottom,
            controls,
          };
        });
        entry.observations.push({ width, path, ...geometry });
        if (evidence) await page.screenshot({ path: resolve(evidence, `desktop-${width}-${path === '/' ? 'home' : path.slice(1)}.png`), fullPage: false });
        assert.equal(geometry.overflow, false, `${width} ${path}: no document overflow`);
        if (path === '/') {
          assert.equal(geometry.pathsBesideIntro, true, 'use a ruled workflow lane beside the editorial introduction');
          assert.equal(geometry.nextStepBesidePricing, true, 'pricing and implementation are peer desktop next steps');
          assert.ok((geometry.sectionTopPadding ?? Infinity) <= 48, 'avoid the inherited blanket 72px section padding');
        }
        if (path === '/playground') {
          assert.ok((geometry.headingSize ?? Infinity) <= 44, 'the workspace heading is not a marketing billboard');
          assert.ok((geometry.actionBottom ?? Infinity) <= 680, 'the action fits a common desktop height with room for site chrome');
        }
        for (const control of geometry.controls) {
          assert.ok(control.height >= 44, `${control.text}: minimum 44px control`);
          assert.ok(control.font.includes('Segoe UI'), `${control.text}: common UI type, not disparate display/mono controls`);
          assert.equal(control.size, '14px', `${control.text}: shared control text scale`);
        }
      }, { width, height: 1000 });
    }
  }
});
