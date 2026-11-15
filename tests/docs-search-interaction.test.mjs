import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// Anonymous, read-only interaction QA; never substitutes an app or search engine.
// Run from the repo: DOCS_QA_BASE=http://127.0.0.1:3102 node tests/docs-search-interaction.test.mjs
// DOCS_TEST_OUTPUT accepts an evidence directory or an explicit summary .json path.
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { expect } = require('@playwright/test');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
assert.equal(resolve(process.cwd()), root, 'Run node from the repository cwd.');
const base = new URL(process.env.DOCS_QA_BASE || 'http://127.0.0.1:3102');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'Only an explicitly local, account-free preview is permitted.');
assert(!base.username && !base.password && !base.search && !base.hash && base.pathname === '/', 'DOCS_QA_BASE must be a plain loopback origin.');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = resolve(process.env.DOCS_TEST_OUTPUT || 'D:/SoterAI-desktop-docs-evidence/qa-search');
const evidence = output.endsWith('.json') ? join(dirname(output), `${basename(output, '.json')}-artifacts-${stamp}`) : join(output, `run-${stamp}`);
const summaryPath = output.endsWith('.json') ? output : join(evidence, 'summary.json');
mkdirSync(evidence, { recursive: true });
const viewport = { width: 1440, height: 1000 };
const timeout = 90_000;
const inputSelector = 'dialog.docs-search-dialog input[role="combobox"]';
const indexURL = new URL('/docs-search-index.json', base).href;
const sha = value => createHash('sha256').update(value).digest('hex');
const writeJSON = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
async function bounded(promise, label, ms = 12_000) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label} after ${ms}ms`)), ms); })]); }
  finally { clearTimeout(timer); }
}
const sourcePaths = [
  'components/docs/DocsSearch.tsx', 'components/docs/docs-search.css', 'lib/docs/search.ts',
  'scripts/docs/build-search-index.ts', 'scripts/docs/search-source.ts', 'lib/docs/navigation.ts',
  'components/docs/ServiceDirectory.tsx', 'components/docs/DocViewTracker.tsx', 'app/docs/layout.tsx',
  'public/docs-search-index.json', 'tests/docs-search-interaction.test.mjs',
];
function sources(label) {
  const entries = sourcePaths.map(path => {
    const bytes = readFileSync(join(root, path));
    const copy = join(evidence, 'sources', label, path);
    mkdirSync(dirname(copy), { recursive: true });
    writeFileSync(copy, bytes);
    return { path, bytes: bytes.length, sha256: sha(bytes), evidence: copy };
  });
  return { entries, implementationSHA256: sha(entries.filter(x => !x.path.startsWith('tests/')).map(x => `${x.path}\0${x.sha256}\n`).join('')) };
}
function git(args) {
  try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim(); }
  catch (error) { return `unavailable: ${error.message}`; }
}
const startSources = sources('start');
const rows = [];
const cases = [];
let browser;
let realIndex;
let realIndexBytes;
let preflight;
function indexInputs(label) {
  const paths = ['lib/docs/navigation.ts', 'lib/docs/services.ts', 'lib/docs/serviceExperience.ts', 'lib/docs/scope.ts', 'lib/docs/slug.ts', 'scripts/docs/search-source.ts', 'scripts/docs/build-search-index.ts', ...realIndex.pages.filter(page => page.kind === 'guide').map(page => `app${page.href}/page.tsx`), 'app/docs/services/[id]/page.tsx'];
  const hash = createHash('sha256');
  const entries = paths.map(path => {
    const bytes = readFileSync(join(root, path));
    hash.update(path).update('\0').update(bytes.toString('utf8')).update('\0');
    const artifact = join(evidence, 'index-inputs', label, path);
    mkdirSync(dirname(artifact), { recursive: true }); writeFileSync(artifact, bytes);
    return { path, sha256: sha(bytes), evidence: artifact };
  });
  const computedSourceHash = hash.digest('hex');
  return { computedSourceHash, servedIndexSourceHash: realIndex.sourceHash, matches: computedSourceHash === realIndex.sourceHash, entries };
}
const metadata = {
  schemaVersion: 1, startedAt: new Date().toISOString(), cwd: root, base: base.href,
  environment: process.env.DOCS_QA_MODE || 'local-dev-preview (not production performance evidence)',
  viewport, headless: true, reducedMotion: 'reduce', serviceWorkers: 'block', navigationTimeoutMs: timeout,
  hydrationWait: 'document load + React trigger onClick hydration marker + two animation frames',
  networkPolicy: 'Fresh contexts; same-origin GET/HEAD/OPTIONS only; only local Next HMR websocket allowed; no account, engine or mutation requests.',
  node: process.version, playwright: require('playwright/package.json').version,
  axe: (() => { try { return require('axe-core/package.json').version; } catch { return null; } })(),
  chromiumExecutable: chromium.executablePath(),
  gitHead: git(['rev-parse', 'HEAD']),
  relevantWorkingTree: git(['status', '--short', '--', 'components/docs', 'lib/docs', 'scripts/docs', 'app/docs', 'public/docs-search-index.json', 'tests/docs-search-interaction.test.mjs']),
  startSources, limitations: ['Desktop Chromium only.', 'Interaction QA, not production performance or full WCAG certification.', 'HTTP interception is used only for explicitly named index failure/cancellation fixtures.'],
};
writeJSON(join(evidence, 'metadata.json'), metadata);
process.on('exit', code => writeJSON(join(evidence, 'native-exit.json'), { code, observedBy: 'node process exit event', at: new Date().toISOString(), argv: process.argv, summaryPath }));
console.log(`DOCS_SEARCH_EVIDENCE=${evidence}`);

before(async () => {
  assert(existsSync(chromium.executablePath()), 'Installed Chromium is required; this script never installs packages.');
  const [indexResponse, sessionResponse] = await Promise.all([
    fetch(indexURL, { redirect: 'manual', signal: AbortSignal.timeout(timeout) }),
    fetch(new URL('/api/auth/session', base), { redirect: 'manual', signal: AbortSignal.timeout(timeout) }),
  ]);
  realIndexBytes = Buffer.from(await indexResponse.arrayBuffer());
  const sessionText = await sessionResponse.text();
  assert.equal(indexResponse.status, 200, 'Real local index must be available before failure fixtures.');
  assert.equal(sessionResponse.status, 200, 'Anonymous session preflight must succeed.');
  assert.equal(JSON.parse(sessionText), null, 'Only an anonymous preview may be exercised.');
  realIndex = JSON.parse(realIndexBytes.toString('utf8'));
  assert.equal(sha(realIndexBytes), startSources.entries.find(x => x.path === 'public/docs-search-index.json').sha256, 'Served index must match the captured checkout bytes.');
  assert.equal(realIndex.pageCount, realIndex.pages.length, 'Declared index count must match its actual inventory.');
  writeFileSync(join(evidence, 'real-served-index.json'), realIndexBytes);
  preflight = {
    index: { url: indexURL, status: indexResponse.status, sha256: sha(realIndexBytes), sourceHash: realIndex.sourceHash, pages: realIndex.pages.length, guides: realIndex.pages.filter(x => x.kind === 'guide').length, services: realIndex.pages.filter(x => x.kind === 'service').length },
    anonymousSession: { url: new URL('/api/auth/session', base).href, status: sessionResponse.status, body: sessionText },
  };
  preflight.indexBuildInputs = indexInputs('start');
  writeJSON(join(evidence, 'preflight.json'), preflight);
  browser = await chromium.launch({ headless: true });
  metadata.browserVersion = browser.version();
  writeJSON(join(evidence, 'metadata.json'), metadata);
}, { timeout: 120_000 });

async function settle(page) {
  await page.locator('.docs-search-trigger').waitFor({ state: 'visible', timeout });
  await page.waitForFunction(() => {
    const element = document.querySelector('.docs-search-trigger');
    return element && Object.keys(element).some(key => key.startsWith('__reactProps$') && typeof element[key]?.onClick === 'function');
  }, null, { timeout });
  await bounded(page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))), 'settled animation frames');
}
async function snapshot(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('dialog.docs-search-dialog');
    const input = dialog?.querySelector('[role="combobox"]');
    const active = document.activeElement;
    return {
      url: location.href, open: !!dialog?.open, nativeModal: !!dialog?.matches(':modal'),
      focus: { tag: active?.tagName, id: active?.id, role: active?.getAttribute('role'), label: active?.getAttribute('aria-label'), text: active?.textContent?.trim().slice(0, 120), inside: !!dialog?.contains(active), documentHasFocus: document.hasFocus() },
      query: input?.value, selectedId: input?.getAttribute('aria-activedescendant'),
      status: dialog?.querySelector('[role="status"]')?.textContent?.trim(), footer: dialog?.querySelector('.docs-search-footer')?.textContent?.trim(),
      bodyOverflow: document.body.style.overflow,
      options: [...(dialog?.querySelectorAll('[role="option"]') || [])].map(option => ({ id: option.id, selected: option.getAttribute('aria-selected'), title: option.querySelector('.docs-search-result-title')?.textContent?.trim(), heading: option.querySelector('.docs-search-result-heading')?.textContent?.trim() || null, meta: option.querySelector('.docs-search-result-meta')?.textContent?.trim(), excerpt: option.querySelector('.docs-search-result-excerpt')?.textContent?.trim() })),
    };
  });
}
async function ready(t) {
  await expect(t.page.locator('.docs-search-footer')).toContainText(`${realIndex.pages.length} documents · local search`, { timeout: 12_000 });
  await expect(t.page.locator('.docs-search-context')).not.toContainText('Loading');
  await expect(t.page.locator('.docs-search-context')).not.toContainText('unavailable');
}
async function open(t, method = 'click') {
  if (method === 'click') await t.page.locator('.docs-search-trigger').click();
  else await t.page.keyboard.press(method);
  await expect(t.page.locator('dialog.docs-search-dialog')).toBeVisible();
  await expect(t.field).toBeFocused();
}
async function close(t) {
  await t.page.keyboard.press('Escape');
  await expect(t.page.locator('dialog.docs-search-dialog')).not.toBeVisible();
}
async function assertSelected(t, index) {
  const options = t.page.locator('dialog.docs-search-dialog [role="option"]');
  await expect(options.nth(index)).toHaveAttribute('aria-selected', 'true');
  await expect(t.field).toHaveAttribute('aria-activedescendant', await options.nth(index).getAttribute('id'));
  assert.equal(await t.page.locator('dialog.docs-search-dialog [role="option"][aria-selected="true"]').count(), 1);
  await expect(t.field).toBeFocused();
}
function indexedTarget(option) {
  const documents = realIndex.pages.filter(document => document.title === option.title);
  assert.equal(documents.length, 1, `Displayed title must identify one actual indexed document: ${option.title}`);
  const document = documents[0];
  const heading = option.heading ? document.headings.find(heading => heading.title === option.heading) : null;
  if (option.heading) assert(heading, `Displayed section must exist in the real index: ${option.heading}`);
  return { href: `${document.href}${heading ? `#${heading.id}` : ''}`, documentHref: document.href, title: document.title, kind: document.kind, heading };
}
async function enterTarget(t, option) {
  const target = indexedTarget(option);
  const routeSource = target.kind === 'service' ? 'app/docs/services/[id]/page.tsx' : `app${target.documentHref}/page.tsx`;
  if (existsSync(join(root, routeSource))) {
    const bytes = readFileSync(join(root, routeSource));
    const path = join(t.dir, 'destination-source.tsx');
    writeFileSync(path, bytes);
    t.row.targetSource = { path: routeSource, sha256: sha(bytes), evidence: path };
  }
  await t.page.keyboard.press('Enter');
  await t.page.waitForURL(new URL(target.href, base).href, { timeout, waitUntil: 'domcontentloaded' });
  await settle(t.page);
  await expect(t.page.locator('dialog.docs-search-dialog')).not.toBeVisible();
  await expect(t.page.locator('main h1')).toHaveCount(1);
  assert(!/^404\b/.test((await t.page.locator('main h1').textContent()) || ''), 'Indexed target must not render a not-found page.');
  if (target.heading) {
    const heading = t.page.locator(`[id="${target.heading.id}"]`);
    await expect(heading).toBeVisible();
    assert((await heading.textContent()).includes(target.heading.title), 'Target anchor must contain the indexed heading text.');
    t.row.targetHeadingBox = await heading.boundingBox();
  }
  t.row.target = { ...target, actualURL: t.page.url(), h1: await t.page.locator('main h1').textContent() };
  await t.observe('navigated-real-indexed-target');
}
async function fallback(t) {
  await expect(t.page.locator('.docs-search-context')).toContainText('Full-text search unavailable. Guide-only fallback.', { timeout: 12_000 });
  await expect(t.page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await expect(t.page.locator('.docs-search-footer')).toContainText('Your query stays in this browser');
  await expect(t.page.locator('.docs-search-footer')).not.toContainText('documents · local search');
  const state = await t.observe('honest-guide-only-fallback');
  const guideTitles = new Set(realIndex.pages.filter(document => document.kind === 'guide').map(document => document.title));
  assert(state.options.every(option => guideTitles.has(option.title) && option.meta.endsWith('Documentation') && !option.heading), 'Fallback must contain only declared guide summaries, never service/full-text hits.');
}
async function verifyFallbackCoverage(t) {
  await fallback(t);
  await t.field.fill('Transaction Escrow');
  await expect(t.page.locator('dialog.docs-search-dialog [role="option"]')).toHaveCount(0);
  await t.observe('service-unavailable-in-fallback');
  await t.field.fill('Quickstart');
  await expect(t.page.locator('.docs-search-result-title').filter({ hasText: /^Quickstart$/ })).toBeVisible();
  await t.observe('guide-available-in-fallback');
  await t.field.fill('Transaction Escrow');
}
async function retryRealIndex(t, keyboard = false) {
  const retry = t.page.getByRole('button', { name: 'Retry', exact: true });
  if (keyboard) {
    await t.field.focus();
    await t.page.keyboard.press('Tab');
    await expect(t.page.getByRole('button', { name: 'Close search', exact: true })).toBeFocused();
    await t.page.keyboard.press('Tab');
    await expect(retry).toBeFocused();
    await t.page.keyboard.press('Enter');
  } else await retry.click();
  await ready(t);
  await expect(t.field).toHaveValue('Transaction Escrow');
  await expect(t.page.locator('.docs-search-result-title').filter({ hasText: /^Transaction Escrow$/ })).toBeVisible();
  await expect(retry).not.toBeVisible();
  await t.observe('retry-real-index-recovered');
}
function indexFailureOnce(t, definition) {
  const body = typeof definition.body === 'function' ? definition.body(realIndex) : definition.body;
  if (body !== undefined) {
    const path = join(t.dir, 'index-error-fixture.txt');
    writeFileSync(path, body);
    t.row.fixtureBody = { path, sha256: sha(body), bytes: Buffer.byteLength(body), mutation: definition.mutation || null };
  }
  t.setFixture(async (route, attempt, entry) => {
    if (attempt !== 1) return false;
    entry.decision = `fixture-index-error:${definition.label}`;
    if (definition.abort) await route.abort(definition.abort);
    else await route.fulfill({ status: definition.status || 200, contentType: 'application/json', body, headers: { 'cache-control': 'no-store' } });
    return true;
  });
}
async function statusHistory(t) {
  await t.page.evaluate(() => {
    const dialog = document.querySelector('dialog.docs-search-dialog');
    window.__docsQaStatusHistory = [];
    const record = () => window.__docsQaStatusHistory.push({ at: performance.now(), open: dialog.open, status: dialog.querySelector('[role="status"]').textContent, footer: dialog.querySelector('.docs-search-footer').textContent, query: dialog.querySelector('input').value });
    record();
    window.__docsQaStatusObserver = new MutationObserver(record);
    window.__docsQaStatusObserver.observe(dialog, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['open'] });
  });
}
async function saveStatusHistory(t) {
  t.row.statusHistory = await t.page.evaluate(() => { window.__docsQaStatusObserver?.disconnect(); return window.__docsQaStatusHistory; });
}
async function axeDialog(t, state) {
  assert(metadata.axe, 'axe-core is not installed; no package will be installed.');
  await t.page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  const report = await t.page.evaluate(async () => window.axe.run(document.querySelector('dialog.docs-search-dialog'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }));
  const path = join(t.dir, `axe-${state}.json`);
  writeJSON(path, report);
  t.row.axe = { path, version: report.testEngine.version, url: report.url, violations: report.violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(node => node.target) })), incomplete: report.incomplete.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) })), passes: report.passes.length };
  assert.deepEqual(t.row.axe.violations, [], `Dialog axe violations in ${state}`);
}
function addCase(id, name, fn, fixture = null, path = '/docs') {
  cases.push({ id, name, fn, fixture, path });
}
async function executeCase(spec) {
  const row = { id: spec.id, name: spec.name, fixture: spec.fixture, entryURL: new URL(spec.path, base).href, startedAt: new Date().toISOString(), observations: [] };
  const dir = join(evidence, spec.id);
  mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', serviceWorkers: 'block' });
  context.setDefaultTimeout(10_000);
  context.setDefaultNavigationTimeout(timeout);
  const network = [], consoleRows = [], pageErrors = [], routeErrors = [], websocketRows = [], bodyTasks = [];
  let fixtureHandler;
  let indexAttempt = 0;
  let sequence = 0;
  const requests = new Map();
  context.on('request', request => {
    const entry = { id: ++sequence, at: new Date().toISOString(), url: request.url(), method: request.method(), type: request.resourceType(), headers: request.headers(), postData: request.postData(), decision: null };
    requests.set(request, entry); network.push(entry);
  });
  context.on('requestfailed', request => { const row = requests.get(request); if (row) row.failure = request.failure(); });
  context.on('response', response => {
    const entry = requests.get(response.request());
    if (entry) entry.status = response.status();
    const url = new URL(response.url());
    if (response.status() !== 200 || url.origin !== base.origin || !['script', 'stylesheet'].includes(response.request().resourceType())) return;
    bodyTasks.push((async () => {
      try {
        const body = await response.body();
        entry.bodySHA256 = sha(body); entry.bodyBytes = body.length;
        const text = body.toString('utf8');
        if (!text.includes('docs-search-trigger') && !text.includes('docs-search-dialog')) return;
        const artifact = join(evidence, 'served-assets', `${entry.bodySHA256}${url.pathname.endsWith('.css') ? '.css' : '.js'}`);
        mkdirSync(dirname(artifact), { recursive: true });
        if (!existsSync(artifact)) writeFileSync(artifact, body);
        entry.bodyEvidence = artifact;
        entry.sourceMappings = [];
        for (const match of text.matchAll(/sourceMappingURL=data:application\/json(?:;charset=[^;,]+)?;base64,([A-Za-z0-9+/=]+)/g)) {
          const map = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
          for (let index = 0; index < (map.sources || []).length; index++) {
            const sourcePath = map.sources[index].replaceAll('\\', '/');
            const source = startSources.entries.find(source => sourcePath.endsWith(`/${source.path}`));
            if (!source || typeof map.sourcesContent?.[index] !== 'string') continue;
            const digest = sha(map.sourcesContent[index]);
            const originalTypeScript = /\.tsx?$/.test(source.path);
            entry.sourceMappings.push({ path: source.path, sourceMapPath: sourcePath, sha256: digest, comparison: originalTypeScript ? 'original-TypeScript-bytes' : 'bundler-CSS-module-stub-not-original-stylesheet', matchesCapturedSource: originalTypeScript ? digest === source.sha256 : null });
          }
        }
      } catch (error) { entry.bodyCaptureError = String(error); }
    })());
  });
  await context.route('**/*', async route => {
    const request = route.request();
    const entry = requests.get(request);
    const url = new URL(request.url());
    try {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) || url.origin !== base.origin) {
        if (entry) entry.decision = 'blocked-by-read-only-policy';
        await route.abort('blockedbyclient'); return;
      }
      if (url.pathname === '/docs-search-index.json') {
        indexAttempt += 1;
        if (entry) entry.indexAttempt = indexAttempt;
        if (fixtureHandler && await fixtureHandler(route, indexAttempt, entry)) return;
      }
      if (entry) entry.decision = 'real-same-origin-read';
      await route.continue();
    } catch (error) { routeErrors.push({ url: request.url(), error: String(error) }); }
  });
  await context.routeWebSocket(/.*/, socket => {
    const url = new URL(socket.url());
    const allowed = url.host === base.host && url.pathname === '/_next/webpack-hmr';
    websocketRows.push({ at: new Date().toISOString(), url: socket.url(), decision: allowed ? 'real-local-next-hmr' : 'blocked-by-read-only-policy' });
    if (!allowed) { socket.close(); return; }
    const server = socket.connectToServer();
    socket.onMessage(message => { websocketRows.push({ direction: 'sent', payload: String(message) }); server.send(message); });
    server.onMessage(message => socket.send(message));
  });
  const page = await context.newPage();
  page.on('console', message => { if (['warning', 'error'].includes(message.type())) consoleRows.push({ type: message.type(), text: message.text(), location: message.location() }); });
  page.on('pageerror', error => pageErrors.push({ name: error.name, message: error.message, stack: error.stack }));
  const t = {
    page, context, field: page.locator(inputSelector), row, dir, network, websocketRows,
    setFixture: handler => { fixtureHandler = handler; }, indexAttempts: () => indexAttempt, cleanups: [],
    observe: async label => { const state = await snapshot(page); row.observations.push({ label, ...state }); return state; },
  };
  let thrown;
  try {
    const response = await page.goto(row.entryURL, { waitUntil: 'load', timeout });
    row.initialStatus = response.status();
    assert.equal(response.status(), 200, 'Docs route must return a real 200.');
    await settle(page);
    await spec.fn(t);
    await bounded(Promise.all(bodyTasks), 'served asset evidence');
    row.deliveredSourceMappings = network.flatMap(entry => entry.sourceMappings || []);
    assert(row.deliveredSourceMappings.every(mapping => mapping.matchesCapturedSource !== false), 'A served original TypeScript source map differs from the captured checkout: stale bundle or concurrent edit.');
    const unexpectedConsole = consoleRows.filter(message => {
      if (message.type !== 'error') return false;
      if (spec.fixture && message.location?.url === indexURL) return false;
      return !network.some(entry => entry.decision === 'blocked-by-read-only-policy' && entry.url === message.location?.url);
    });
    assert.deepEqual(unexpectedConsole, [], 'Unexpected first-party browser console error.');
    assert.deepEqual(pageErrors, [], 'Unexpected application pageerror.');
    row.passed = true;
  } catch (error) {
    thrown = error;
    row.passed = false; row.error = { name: error.name, message: error.message, stack: error.stack };
  } finally {
    for (const cleanup of t.cleanups) { try { await cleanup(); } catch (error) { routeErrors.push({ cleanupError: String(error) }); } }
    try { await t.observe('final'); } catch (error) { row.snapshotError = String(error); }
    try { row.screenshot = join(dir, 'final.png'); await page.screenshot({ path: row.screenshot, timeout: 8000 }); } catch (error) { row.screenshotError = String(error); }
    await bounded(Promise.all(bodyTasks), 'final served asset evidence');
    row.finishedAt = new Date().toISOString();
    row.indexAttempts = indexAttempt;
    row.networkFile = join(dir, 'network.json');
    row.console = consoleRows; row.pageErrors = pageErrors; row.routeErrors = routeErrors;
    writeJSON(row.networkFile, { requests: network, websockets: websocketRows });
    writeJSON(join(dir, 'result.json'), row);
    rows.push(row); appendFileSync(join(evidence, 'results.jsonl'), `${JSON.stringify(row)}\n`);
    await context.close();
  }
  if (thrown) throw thrown;
}

addCase('01-initial-intent', 'initial focus is untouched and the index loads only on search intent', async t => {
  const state = await t.observe('settled-initial');
  assert.equal(state.focus.tag, 'BODY');
  assert.equal(state.open, false);
  assert.equal(t.indexAttempts(), 0);
  assert.equal(await t.page.locator('dialog.docs-search-dialog').count(), 1);
  assert.equal(await t.field.count(), 1);
  await open(t, 'Control+k');
  await ready(t);
  assert.equal(t.indexAttempts(), 1);
  await t.observe('ready-after-intent');
  await close(t);
  await expect(t.page.locator('.docs-search-trigger')).toBeFocused();
});

addCase('02-native-focus', 'native modal contains forward and reverse keyboard focus and rejects background focus', async t => {
  const previousOverflow = await t.page.evaluate(() => document.body.style.overflow);
  await open(t); await ready(t);
  const initial = await t.observe('opened');
  assert.equal(initial.nativeModal, true);
  assert.equal(initial.bodyOverflow, 'hidden');
  const states = [];
  for (const key of ['Tab', 'Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
    await t.page.keyboard.press(key);
    states.push({ key, ...(await t.observe(`focus-${key}`)).focus });
  }
  // Native showModal permits browser chrome, unlike an author-scripted APG loop.
  // BODY + document.hasFocus() === false is not focus on the background page.
  // Preserve the initial stricter failed run; never accept an in-document escape.
  assert(states.every(state => state.inside || (state.tag === 'BODY' && !state.documentHasFocus)), `Keyboard reached background page content: ${JSON.stringify(states)}`);
  assert.equal(states.at(-1).role, 'combobox', 'A full reverse traversal returns to the search input.');
  t.row.nativeChromeTransitions = states.filter(state => !state.documentHasFocus);
  t.row.focusOracleReference = 'https://knowledge.evinced.com/web/web-validations/focus-kept-within-the-modal';
  await t.page.locator('.docs-workspace-label').evaluate(element => element.focus());
  assert.equal((await t.observe('background-focus-attempt')).focus.inside, true);
  await close(t);
  await expect(t.page.locator('.docs-search-trigger')).toBeFocused();
  assert.equal(await t.page.evaluate(() => document.body.style.overflow), previousOverflow);
});

addCase('03-slash-existing-input', 'slash types into the real service-directory input instead of hijacking focus', async t => {
  const existing = t.page.getByRole('searchbox', { name: 'Search security services' });
  await existing.fill('api');
  await existing.press('/');
  await expect(existing).toHaveValue('api/');
  await expect(existing).toBeFocused();
  await expect(t.page.locator('dialog.docs-search-dialog')).not.toBeVisible();
  assert.equal(t.indexAttempts(), 0);
  await t.observe('slash-preserved');
  await existing.press('Control+k');
  await expect(t.field).toBeFocused();
  await ready(t);
  await close(t);
  await expect(existing).toBeFocused();
  await expect(existing).toHaveValue('api/');
}, null, '/docs/services');

addCase('04-background-inert', 'native modal rejects focus on an existing input and sidebar link behind it', async t => {
  const existing = t.page.getByRole('searchbox', { name: 'Search security services' });
  await existing.fill('guard');
  await existing.press('Control+k'); await ready(t);
  for (const target of [existing, t.page.locator('.docs-workspace-label')]) {
    await target.evaluate(element => element.focus());
    const state = await t.observe('background-focus-rejected');
    assert.equal(state.nativeModal, true);
    assert.equal(state.focus.inside, true);
    await expect(t.field).toBeFocused();
  }
  await close(t);
  await expect(existing).toBeFocused();
  await expect(existing).toHaveValue('guard');
}, null, '/docs/services');

addCase('05-shortcuts-reset', 'slash opens search outside inputs and shortcut toggles reopen with an empty query', async t => {
  await t.page.locator('.docs-workspace-label').focus();
  await open(t, '/'); await ready(t);
  await t.field.fill('guard');
  await t.field.press('/');
  await expect(t.field).toHaveValue('guard/');
  await t.page.keyboard.press('Control+k');
  await expect(t.page.locator('dialog.docs-search-dialog')).not.toBeVisible();
  await expect(t.page.locator('.docs-workspace-label')).toBeFocused();
  await open(t, 'Meta+k');
  await expect(t.field).toHaveValue('');
  await assertSelected(t, 0);
  assert.equal(t.indexAttempts(), 1, 'A cached valid index should not refetch on reopen.');
  await t.observe('shortcut-reopened-empty');
});

addCase('06-arrow-navigation', 'arrows wrap the active option, scroll it into view, and Enter opens that indexed target', async t => {
  await open(t); await ready(t);
  await t.field.fill('guard');
  const state = await t.observe('multi-result-query');
  assert(state.options.length >= 3, 'Real index must provide enough options for a multi-result keyboard test.');
  await assertSelected(t, 0);
  await t.page.keyboard.press('ArrowUp');
  await assertSelected(t, state.options.length - 1);
  await expect.poll(() => t.page.evaluate(() => {
    const list = document.querySelector('.docs-search-results');
    const option = list.querySelector('[aria-selected="true"]');
    const outer = list.getBoundingClientRect(), inner = option.getBoundingClientRect();
    return inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
  })).toBe(true);
  await t.observe('wrapped-last-option-visible');
  await t.page.keyboard.press('ArrowDown'); await assertSelected(t, 0);
  await t.page.keyboard.press('ArrowDown'); await assertSelected(t, 1);
  await t.page.keyboard.press('ArrowUp'); await assertSelected(t, 0);
  await t.page.keyboard.press('ArrowDown'); await assertSelected(t, 1);
  await enterTarget(t, state.options[1]);
});

addCase('07-service-enter', 'a service-only full-text result navigates to its real rendered service guide', async t => {
  await open(t); await ready(t);
  await t.field.fill('Transaction Escrow');
  await expect(t.page.locator('.docs-search-result-title').filter({ hasText: /^Transaction Escrow$/ })).toBeVisible();
  const state = await t.observe('service-full-text-result');
  assert.equal(state.options[0].title, 'Transaction Escrow');
  assert(state.options[0].meta.endsWith('Service guide'));
  await t.page.keyboard.press('ArrowDown');
  await t.page.keyboard.press('ArrowUp');
  await assertSelected(t, 0);
  await enterTarget(t, state.options[0]);
});

addCase('08-body-anchor', 'a body-only Retry-After query opens an actual indexed heading on the rendered guide', async t => {
  await open(t); await ready(t);
  await t.field.fill('Retry-After');
  await expect(t.page.locator('dialog.docs-search-dialog [role="option"]').first()).toBeVisible();
  const state = await t.observe('body-only-results');
  const index = state.options.findIndex(option => option.heading && /retry.after/i.test(option.excerpt));
  assert(index >= 0, 'Real full-text results must include a Retry-After body excerpt with a heading target.');
  const target = indexedTarget(state.options[index]);
  const source = realIndex.pages.find(document => document.href === target.documentHref);
  assert(!/retry.after/i.test(`${source.title} ${source.summary} ${source.keywords.join(' ')}`), 'This case must exercise body content, not a title/keyword alias.');
  assert(/retry.after/i.test(source.body));
  for (let step = 0; step < index; step++) await t.page.keyboard.press('ArrowDown');
  await assertSelected(t, index);
  await enterTarget(t, state.options[index]);
});

addCase('09-close-reopen-reset', 'closing via the button resets the query and active selection without losing the loaded index', async t => {
  await open(t); await ready(t);
  await t.field.fill('guard');
  await t.page.keyboard.press('ArrowDown'); await t.page.keyboard.press('ArrowDown');
  await assertSelected(t, 2);
  await t.observe('query-and-selection-before-close');
  await t.page.getByRole('button', { name: 'Close search', exact: true }).click();
  await expect(t.page.locator('.docs-search-trigger')).toBeFocused();
  await expect(t.page.locator('.docs-search-trigger')).toHaveAttribute('aria-expanded', 'false');
  await open(t);
  await expect(t.field).toHaveValue('');
  await expect(t.page.locator('.docs-search-context')).toHaveText('Suggested starting points');
  await assertSelected(t, 0);
  assert.equal((await t.observe('reopened-reset')).options[0].title, 'Quickstart');
  assert.equal(t.indexAttempts(), 1);
});

addCase('10-no-results', 'no-match arrows and Enter do nothing, and Clear search restores suggestions and input focus', async t => {
  await open(t); await ready(t);
  const query = `docs_qa_no_match_${sha(stamp).slice(0, 16)}`;
  await t.field.fill(query);
  await expect(t.page.locator('dialog.docs-search-dialog [role="option"]')).toHaveCount(0);
  await expect(t.field).not.toHaveAttribute('aria-activedescendant');
  const url = t.page.url();
  for (const key of ['ArrowDown', 'ArrowUp', 'Enter']) await t.page.keyboard.press(key);
  assert.equal(t.page.url(), url);
  await expect(t.field).toBeFocused();
  await expect(t.page.locator('dialog.docs-search-dialog')).toBeVisible();
  await expect(t.page.locator('.docs-search-empty strong')).toHaveText(`No matches for “${query}”`);
  await t.observe('no-result-safe-keyboard');
  await t.page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(t.field).toHaveValue('');
  await assertSelected(t, 0);
  await expect(t.page.locator('.docs-search-context')).toHaveText('Suggested starting points');
  assert.equal(t.indexAttempts(), 1);
});

addCase('11-query-privacy', 'queries are absent from every attempted HTTP request, header, body and outbound websocket frame', async t => {
  await open(t); await ready(t);
  const marker = `docsqa_private_${sha(`${stamp}-privacy`).slice(0, 20)}`;
  const queries = [marker, `${marker} /?&= #`, `${marker} café हिन्दी`, 'Transaction Escrow'];
  const startedAt = new Date().toISOString();
  const firstSequence = t.network.length;
  for (const query of queries) { await t.field.fill(query); await t.observe('privacy-query-rendered'); }
  await t.field.fill(marker);
  await close(t);
  await t.page.waitForTimeout(1500); // Explicit bounded observation window, not a readiness sleep.
  const serialized = JSON.stringify({ requests: t.network, websockets: t.websocketRows });
  for (const value of [marker, encodeURIComponent(marker), Buffer.from(marker).toString('base64')]) assert(!serialized.includes(value), 'Query marker was attempted over HTTP/websocket (blocked attempts also fail).');
  assert.equal(t.indexAttempts(), 1);
  assert(t.network.filter(entry => entry.indexAttempt).every(entry => entry.url === indexURL && entry.postData === null));
  assert.equal(t.page.url(), new URL('/docs', base).href);
  t.row.privacy = { marker, queries, startedAt, endedAt: new Date().toISOString(), observationTailMs: 1500, newRequestsDuringQueryFlow: t.network.slice(firstSequence), queryLeakAttempts: 0, scope: 'Observed HTTP URLs/headers/bodies and outbound websocket frames for this flow, including blocked attempts; not an all-future-traffic guarantee.' };
});

addCase('12-query-boundaries', 'case, spacing and full-width queries match locally and native typing enforces the 160-character limit', async t => {
  await open(t); await ready(t);
  for (const query of ['  TRANSACTION   escrow  ', 'ＴＲＡＮＳＡＣＴＩＯＮ　ＥＳＣＲＯＷ']) {
    await t.field.fill(query);
    await expect(t.page.locator('.docs-search-result-title').first()).toHaveText('Transaction Escrow');
    await t.observe('normalized-query');
  }
  await t.field.fill('');
  await t.field.pressSequentially('q'.repeat(175), { delay: 0 });
  assert.equal((await t.field.inputValue()).length, 160);
  await t.field.press('x');
  assert.equal((await t.field.inputValue()).length, 160);
  await t.observe('native-maxlength');
  await t.field.fill('<docs-qa> & "literal"');
  await expect(t.page.locator('.docs-search-empty strong')).toHaveText('No matches for “<docs-qa> & "literal"”');
  assert.equal(await t.page.locator('dialog docs-qa').count(), 0, 'Query must render as literal text, not HTML.');
});

addCase('13-backdrop-dismiss', 'inside clicks keep search open and backdrop dismissal restores the trigger and scroll lock', async t => {
  const overflow = await t.page.evaluate(() => document.body.style.overflow);
  await open(t); await ready(t);
  await t.page.locator('.docs-search-footer').click();
  await expect(t.page.locator('dialog.docs-search-dialog')).toBeVisible();
  const rect = await t.page.locator('dialog.docs-search-dialog').boundingBox();
  assert(rect.x > 12, 'Desktop viewport must have a real backdrop outside the dialog.');
  await t.page.mouse.click(rect.x - 10, rect.y + 30);
  await expect(t.page.locator('dialog.docs-search-dialog')).not.toBeVisible();
  await expect(t.page.locator('.docs-search-trigger')).toBeFocused();
  assert.equal(await t.page.evaluate(() => document.body.style.overflow), overflow);
  await t.observe('backdrop-dismissed');
});

addCase('14-http-retry', 'HTTP index failure shows guide-only fallback and keyboard Retry recovers the real full index', async t => {
  indexFailureOnce(t, { label: 'HTTP 503 once', status: 503, body: '{"qaFixture":"index unavailable once"}' });
  await open(t);
  await verifyFallbackCoverage(t);
  await retryRealIndex(t, true);
  assert.equal(t.indexAttempts(), 2);
}, { type: 'index-error', behavior: 'Only the first GET /docs-search-index.json returns HTTP 503; Retry is an unmodified real GET.' });

addCase('15-network-retry', 'a failed index connection is recoverable without replacing the application or results', async t => {
  indexFailureOnce(t, { label: 'internetdisconnected once', abort: 'internetdisconnected' });
  await open(t);
  await verifyFallbackCoverage(t);
  await retryRealIndex(t);
  assert.equal(t.indexAttempts(), 2);
}, { type: 'index-error', behavior: 'Only the first index request is aborted with internetdisconnected; Retry reads the real index.' });

addCase('16-index-timeout', 'the real eight-second index deadline exits loading and allows a successful retry', async t => {
  const release = Promise.withResolvers();
  const handled = Promise.withResolvers();
  let requestedAt;
  t.cleanups.push(() => release.resolve());
  t.setFixture(async (route, attempt, entry) => {
    if (attempt !== 1) return false;
    requestedAt = performance.now();
    entry.decision = 'fixture-index-error:held-for-real-client-deadline';
    await release.promise;
    try { await route.abort('timedout'); } finally { handled.resolve(); }
    return true;
  });
  await open(t);
  await expect(t.page.locator('.docs-search-context')).toHaveText('Loading the local search index…');
  await fallback(t);
  t.row.deadline = { elapsedMs: performance.now() - requestedAt, sourceDeadlineMs: 8000, timerMocked: false };
  assert(t.row.deadline.elapsedMs >= 7500, 'Client deadline should not fail immediately.');
  release.resolve(); await bounded(handled.promise, 'deadline fixture cleanup');
  await t.field.fill('Transaction Escrow');
  await retryRealIndex(t);
  assert.equal(t.indexAttempts(), 2);
}, { type: 'index-error', behavior: 'First index route is held without a response until the unmodified client AbortController deadline fires; next request is real. No fake timers.' });

const malformed = [
  { id: '17-invalid-json', label: 'malformed JSON', body: '{"version":1,"pages":[', mutation: 'Truncated JSON body only.' },
  { id: '18-invalid-version', label: 'unsupported schema version', body: index => JSON.stringify({ ...index, version: 999 }), mutation: 'Real index clone with version=999; other data unchanged.' },
  { id: '19-unsafe-target', label: 'external navigation target', body: index => { const copy = structuredClone(index); copy.pages[0].href = 'https://docs-qa.invalid/unsafe-target'; return JSON.stringify(copy); }, mutation: 'Only pages[0].href changes to an external .invalid URL; no external request is allowed.' },
  { id: '20-duplicate-target', label: 'duplicate document target', body: index => { const copy = structuredClone(index); copy.pages[1].href = copy.pages[0].href; return JSON.stringify(copy); }, mutation: 'Only pages[1].href becomes a duplicate of pages[0].href.' },
  { id: '21-invalid-heading', label: 'unsafe heading anchor', body: index => { const copy = structuredClone(index); const page = copy.pages.find(page => page.headings.length); page.headings[0].id = 'not a valid anchor'; return JSON.stringify(copy); }, mutation: 'Only the first existing heading id changes to a space-containing invalid anchor.' },
  { id: '22-oversize-index', label: 'over-limit response body', body: index => JSON.stringify(index) + ' '.repeat(2_000_001), mutation: 'Real valid JSON with trailing whitespace increases the response beyond 2,000,000 characters.' },
];
for (const definition of malformed) {
  addCase(definition.id, `${definition.label} is refused and Retry loads only the real index`, async t => {
    indexFailureOnce(t, definition);
    await open(t);
    await verifyFallbackCoverage(t);
    await retryRealIndex(t);
    assert.equal(t.indexAttempts(), 2);
    assert(!t.network.some(request => request.url.includes('docs-qa.invalid')), 'Malformed target must never be requested, even by a blocked navigation.');
  }, { type: 'index-error', behavior: `First index response is a labelled 200 ${definition.label} fixture. Retry performs a real, unmodified GET.`, mutation: definition.mutation });
}

addCase('23-late-error', 'a cancelled old error cannot replace the reopened loading state or its fresh query', async t => {
  const firstRelease = Promise.withResolvers(), firstHandled = Promise.withResolvers();
  const secondRelease = Promise.withResolvers();
  t.cleanups.push(() => { firstRelease.resolve(); secondRelease.resolve(); });
  t.row.fixtureEvents = [];
  t.setFixture(async (route, attempt, entry) => {
    if (attempt === 1) {
      entry.decision = 'fixture-index-error:delayed-old-503';
      await firstRelease.promise;
      try { await route.fulfill({ status: 503, body: '{"qaFixture":"late old index error"}', contentType: 'application/json' }); t.row.fixtureEvents.push('old 503 fulfillment attempted after close/reopen'); }
      catch (error) { t.row.fixtureEvents.push(`old route already cancelled: ${error.message}`); }
      finally { firstHandled.resolve(); }
      return true;
    }
    if (attempt === 2) {
      entry.decision = 'fixture-index-error:second-real-GET-delayed-until-old-error-released';
      await secondRelease.promise;
      entry.decision = 'real-same-origin-read-after-cancellation-gate';
      await route.continue(); return true;
    }
    return false;
  });
  await statusHistory(t);
  await open(t);
  await t.field.fill('old pending query');
  await expect(t.page.locator('.docs-search-context')).toHaveText('Loading the local search index…');
  await close(t);
  await open(t);
  await expect(t.field).toHaveValue('');
  await expect.poll(t.indexAttempts).toBe(2);
  await t.field.fill('Transaction Escrow');
  firstRelease.resolve(); await bounded(firstHandled.promise, 'old error release');
  await t.page.waitForTimeout(150);
  await expect(t.page.locator('.docs-search-context')).toHaveText('Loading the local search index…');
  await expect(t.field).toHaveValue('Transaction Escrow');
  await t.observe('old-error-ignored-during-new-load');
  secondRelease.resolve(); await ready(t);
  await expect(t.page.locator('.docs-search-result-title').first()).toHaveText('Transaction Escrow');
  await saveStatusHistory(t);
  assert(t.row.statusHistory.every(state => !state.status.includes('unavailable')), 'Old error must not flash into the reopened dialog.');
  assert.equal(t.indexAttempts(), 2);
}, { type: 'index-error-and-cancellation', behavior: 'First index GET is held, closed/cancelled, then released as 503 after reopen. Second GET is gated until the old error is released, then goes to the real server. No fetch/AbortController replacement.' });

addCase('24-late-success', 'a cancelled old real response cannot mask a newer failure, and Retry still recovers', async t => {
  const release = Promise.withResolvers(), upstreamRead = Promise.withResolvers(), handled = Promise.withResolvers();
  t.cleanups.push(() => release.resolve());
  t.row.fixtureEvents = [];
  t.setFixture(async (route, attempt, entry) => {
    if (attempt === 1) {
      entry.decision = 'fixture-index-error:hold-real-upstream-response-for-cancellation';
      try {
        const response = await route.fetch({ maxRedirects: 0, timeout: 12_000 });
        const bytes = await response.body();
        t.row.heldRealResponse = { url: response.url(), status: response.status(), sha256: sha(bytes), matchesPreflight: sha(bytes) === sha(realIndexBytes) };
        upstreamRead.resolve();
        await release.promise;
        try { await route.fulfill({ response }); t.row.fixtureEvents.push('old real response fulfillment attempted after newer 503'); }
        catch (error) { t.row.fixtureEvents.push(`old route already cancelled: ${error.message}`); }
      } finally { upstreamRead.resolve(); handled.resolve(); }
      return true;
    }
    if (attempt === 2) {
      entry.decision = 'fixture-index-error:newer-503';
      await route.fulfill({ status: 503, body: '{"qaFixture":"newer index failure"}', contentType: 'application/json' });
      return true;
    }
    return false;
  });
  await open(t);
  await bounded(upstreamRead.promise, 'real upstream index capture');
  assert.equal(t.row.heldRealResponse?.status, 200);
  assert.equal(t.row.heldRealResponse?.matchesPreflight, true);
  await t.field.fill('old query');
  await close(t); await open(t);
  await expect(t.field).toHaveValue('');
  await fallback(t);
  await t.field.fill('Transaction Escrow');
  await statusHistory(t);
  release.resolve(); await bounded(handled.promise, 'old real response release');
  await t.page.waitForTimeout(150);
  await fallback(t);
  await expect(t.page.locator('dialog.docs-search-dialog [role="option"]')).toHaveCount(0);
  await saveStatusHistory(t);
  assert(t.row.statusHistory.every(state => !state.footer.includes('documents · local search')), 'An old cancelled success must not mark the newer failure ready.');
  await retryRealIndex(t);
  assert.equal(t.indexAttempts(), 3);
}, { type: 'index-error-and-cancellation', behavior: 'First request fetches and holds the real index bytes. Closing aborts it. Reopen receives a labelled newer 503, then old real response is released. Third request (Retry) is an unmodified real GET.' });

addCase('25-axe-ready', 'the open ready dialog passes scoped axe WCAG A/AA rules', async t => {
  await open(t); await ready(t);
  await axeDialog(t, 'ready');
  await t.observe('ready-axe-audited');
});
addCase('26-axe-empty', 'the no-results dialog passes scoped axe WCAG A/AA rules', async t => {
  await open(t); await ready(t);
  await t.field.fill(`docs_qa_no_match_${sha(stamp).slice(0, 16)}`);
  await expect(t.page.locator('.docs-search-empty')).toBeVisible();
  await axeDialog(t, 'no-results');
});
addCase('27-axe-fallback', 'the guide-only error dialog and Retry control pass scoped axe WCAG A/AA rules', async t => {
  indexFailureOnce(t, { label: 'HTTP 503 for fallback accessibility', status: 503, body: '{"qaFixture":"index unavailable for accessibility state"}' });
  await open(t); await fallback(t);
  await axeDialog(t, 'guide-only-fallback');
}, { type: 'index-error', behavior: 'One labelled index HTTP 503 makes the actual error/fallback UI available for a scoped axe scan.' });

const selectedCases = process.env.DOCS_QA_CASE ? cases.filter(spec => new RegExp(process.env.DOCS_QA_CASE).test(spec.id)) : cases;
assert(selectedCases.length > 0, 'No selected test cases.');
for (const spec of selectedCases) test(spec.name, { timeout: 150_000, concurrency: false }, () => executeCase(spec));
after(async () => {
  if (browser) await browser.close();
  const endSources = sources('end');
  const changedSources = startSources.entries.filter(entry => endSources.entries.find(other => other.path === entry.path)?.sha256 !== entry.sha256).map(entry => entry.path);
  const endIndexInputs = realIndex ? indexInputs('end') : null;
  const changedIndexInputs = preflight?.indexBuildInputs.entries.filter(entry => endIndexInputs.entries.find(other => other.path === entry.path)?.sha256 !== entry.sha256).map(entry => entry.path) || [];
  const summary = { ...metadata, preflight, finishedAt: new Date().toISOString(), endSources, changedSources, endIndexInputs, changedIndexInputs, expected: selectedCases.length, completed: rows.length, passed: rows.filter(row => row.passed).length, failed: rows.filter(row => !row.passed).length, sourceStable: changedSources.length === 0, indexMatchesCurrentContent: endIndexInputs?.matches ?? false, cases: rows, evidence, summaryPath };
  writeJSON(summaryPath, summary);
  console.log(JSON.stringify({ summaryPath, expected: summary.expected, completed: summary.completed, passed: summary.passed, failed: summary.failed, sourceStable: summary.sourceStable }));
  assert.equal(rows.length, selectedCases.length, 'Every selected case must produce a result row.');
  assert.deepEqual(changedSources, [], 'Relevant source changed during this run; rerun before acceptance.');
});
