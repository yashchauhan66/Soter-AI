import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'package.json'));
const esbuild = require('esbuild');
const { chromium } = require('playwright');
const key = 'soterai:optional-analytics:v1';
const beacon = 'https://static.cloudflareinsights.com/beacon.min.js';
const status = {
  off: 'Optional analytics is off.',
  on: 'Optional analytics is on.',
  pending: 'Reload required to finish turning off already-loaded trackers.',
};
const phase = process.env.SOTER_REPAIR_PHASE;
if (phase) assert.match(phase, /^[a-z][a-z0-9-]*$/);
const evidence = phase ? resolve(root, 'docs/redesign/evidence/repair-cycle-1', phase) : null;
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

// Explicitly SYNTHETIC beacon: a local execution counter/timer, not telemetry.
// The real external URL is intercepted. It sends no network data at all.
const syntheticBeacon = `/* SYNTHETIC TRACKER STUB: NO TELEMETRY */
window.__syntheticBeaconExecutions = (window.__syntheticBeaconExecutions || 0) + 1;
window.__syntheticBeaconTicks = 0;
setInterval(() => { window.__syntheticBeaconTicks += 1; }, 25);`;
const report = {
  method: 'Current OptionalAnalytics TSX with real React DOM and installed Next Script. Only Link/dynamic build adapters; gaId is empty. Fresh Chromium contexts and ephemeral loopback server. All external traffic blocked or fulfilled by the labelled synthetic beacon.',
  synthetic_tracker_body: syntheticBeacon,
  sources: ['components/privacy/OptionalAnalytics.tsx', 'lib/privacy/analytics-consent.ts', 'node_modules/next/dist/client/script.js']
    .map((path) => ({ path, sha256: sha(readFileSync(resolve(root, path))) })),
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
    const built = await esbuild.build({
      stdin: {
        contents: `import React from 'react';
import {createRoot} from 'react-dom/client';
import {OptionalAnalytics} from './components/privacy/OptionalAnalytics';
let mounted;
function mount() {
  mounted = createRoot(document.getElementById('root'));
  mounted.render(<OptionalAnalytics gaId="" cloudflareToken={location.pathname === '/unconfigured' ? '' : 'SYNTHETIC-NO-TELEMETRY'}/>);
}
window.__repairRemountOptionalAnalytics = () => { mounted.unmount(); mount(); };
mount();`,
        loader: 'tsx', resolveDir: root,
      },
      bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
      metafile: true,
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{
        name: 'build-only-next-link-dynamic-adapters',
        setup(build) {
          build.onResolve({ filter: /^next\/(link|dynamic)$/ }, (args) => ({ path: args.path, namespace: 'adapter' }));
          build.onLoad({ filter: /.*/, namespace: 'adapter' }, (args) => ({
            contents: args.path === 'next/link'
              ? `import React from 'react'; export default function Link({children, ...props}) { return React.createElement('a', props, children); }`
              : `export default function dynamic() { return function UnconfiguredGoogleBuildAdapter() { return null; }; }`,
            loader: 'js', resolveDir: root,
          }));
        },
      }],
    });
    assert.ok(Object.keys(built.metafile.inputs).some((path) => path.replaceAll('\\', '/').endsWith('next/dist/client/script.js')), 'never replace the real installed Next Script implementation');
    const bundle = built.outputFiles[0].text;
    report.bundle_sha256 = sha(bundle);
    report.bundle_inputs = Object.keys(built.metafile.inputs);
    if (evidence) {
      mkdirSync(evidence, { recursive: true });
      writeFileSync(resolve(evidence, 'analytics.bundle.js'), bundle);
    }
    server = http.createServer((request, response) => {
      if (request.url === '/bundle.js') {
        response.writeHead(200, { 'Content-Type': 'application/javascript' });
        response.end(bundle);
        return;
      }
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end(request.url === '/secondary'
        ? '<!doctype html><html lang="en"><head><title>Local storage event fixture</title></head><body>Local secondary tab. No product actions.</body></html>'
        : '<!doctype html><html lang="en"><head><title>Optional analytics source regression</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
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
  try {
    await cleanup();
  } finally {
    if (evidence) writeFileSync(resolve(evidence, 'analytics-browser-observed.json'), JSON.stringify(report, null, 2) + '\n');
  }
}, { timeout: 20000 });

async function settle(page) {
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
}

async function snapshot(page, entry, name) {
  await settle(page);
  const value = await page.evaluate((consentKey) => {
    let preference;
    let storageReadBlocked = false;
    try { preference = localStorage.getItem(consentKey); } catch { preference = null; storageReadBlocked = true; }
    return {
      status: document.querySelector('[role="status"]')?.textContent,
      reload_control_present: [...document.querySelectorAll('button')].some((button) => button.textContent === 'Reload to apply'),
      beacon_script_present: !!document.querySelector('script[src="https://static.cloudflareinsights.com/beacon.min.js"]'),
      script_executions: window.__syntheticBeaconExecutions ?? 0,
      synthetic_timer_ticks: window.__syntheticBeaconTicks ?? 0,
      saved_preference: preference,
      storage_read_blocked: storageReadBlocked,
      allow_pressed: document.querySelector('button[aria-pressed] + button')?.getAttribute('aria-pressed'),
      visible_text: document.body.innerText,
    };
  }, key);
  entry.transitions.push({ name, ...value });
  return value;
}

async function pending(page, entry, name) {
  const value = await snapshot(page, entry, name);
  assert.equal(value.status, status.pending, `${name}: an executed tracker is not unloaded by withdrawing consent`);
  assert.equal(value.reload_control_present, true, `${name}: keep a usable reload control`);
  assert.equal(value.beacon_script_present, true, 'real Next Script remains in the current document');
  assert.equal(value.script_executions, 1, 'the labelled synthetic tracker has actually executed');
  assert.equal(value.allow_pressed, 'false', 'withdrawal must stop granting permission');
  assert.match(value.visible_text, /Already-loaded trackers may continue until then/);
  await page.waitForFunction((ticks) => window.__syntheticBeaconTicks > ticks, value.synthetic_timer_ticks);
  return value;
}

async function on(page, entry, name = 'granted') {
  await page.waitForFunction(() => window.__syntheticBeaconExecutions === 1);
  const value = await snapshot(page, entry, name);
  assert.equal(value.status, status.on);
  assert.equal(value.reload_control_present, false, 'a re-grant must not misleadingly ask to turn trackers off');
  assert.equal(value.allow_pressed, 'true');
  return value;
}

async function grant(page, entry) {
  await page.getByRole('button', { name: 'Allow analytics', exact: true }).click();
  await on(page, entry);
}

async function deny(page) {
  await page.getByRole('button', { name: 'Keep analytics off', exact: true }).click();
  await settle(page);
}

async function withContext(entry, callback, { storedValue = null, blockedGet = false, blockedSet = false, pathname = '/' } = {}) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState: { cookies: [], origins: [{ origin: base, localStorage: storedValue === null ? [] : [{ name: key, value: storedValue }] }] },
  });
  try {
    await context.route('**/*', async (route) => {
      const url = route.request().url();
      if (new URL(url).origin === base) return route.continue();
      report.external_requests.push({ case: entry.name, url, disposition: url === beacon ? 'SYNTHETIC-STUB-NO-TELEMETRY' : 'blocked' });
      if (url === beacon) return route.fulfill({ status: 200, contentType: 'application/javascript', body: syntheticBeacon });
      return route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(4000);
    page.setDefaultNavigationTimeout(5000);
    page.on('pageerror', (error) => report.page_errors.push({ case: entry.name, message: error.message }));
    if (blockedGet || blockedSet) {
      await page.addInitScript(({ blockedGet, blockedSet }) => {
        if (blockedGet) Storage.prototype.getItem = function () { throw new DOMException('Synthetic blocked-storage read', 'SecurityError'); };
        if (blockedSet) Storage.prototype.setItem = function () { throw new DOMException('Synthetic blocked-storage write', 'SecurityError'); };
      }, { blockedGet, blockedSet });
    }
    await page.goto(base + pathname);
    await page.getByRole('button', { name: 'Allow analytics', exact: true }).waitFor();
    await callback(page, context);
    assert.equal(report.page_errors.filter((error) => error.case === entry.name).length, 0, 'the real React component must not crash');
  } finally {
    await context.close();
    entry.context_closed = true;
  }
}

function browserCase(name, callback) {
  test(name, { timeout: 20000 }, async () => {
    const entry = { name, transitions: [], passed: false, context_closed: false };
    report.cases.push(entry);
    try {
      await callback(entry);
      entry.passed = true;
    } catch (error) {
      entry.error = error.message;
      throw error;
    }
  });
}

browserCase('fresh documents never enable analytics from absent or non-exact storage permission', async (entry) => {
  for (const storedValue of [null, '', 'denied', 'yes', 'true', 'Granted', 'granted ', '1', 'ALLOW']) {
    await withContext(entry, async (page) => {
      const value = await snapshot(page, entry, `stored-${JSON.stringify(storedValue)}`);
      assert.equal(value.status, status.off);
      assert.equal(value.reload_control_present, false);
      assert.equal(value.beacon_script_present, false);
      assert.equal(value.script_executions, 0);
    }, { storedValue });
  }
});

browserCase('an exact saved grant restores on status after a real document reload', async (entry) => {
  await withContext(entry, async (page) => {
    await on(page, entry, 'saved-grant');
    await page.reload();
    await on(page, entry, 'saved-grant-after-reload');
  }, { storedValue: 'granted' });
});

browserCase('repeated local denial retains pending-reload guidance while the tracker still executes', async (entry) => {
  await withContext(entry, async (page) => {
    await grant(page, entry);
    await deny(page);
    await pending(page, entry, 'first-denial');
    await deny(page);
    await pending(page, entry, 'second-denial');
    await deny(page);
    await pending(page, entry, 'third-denial');
  });
});

for (const mode of ['denied', 'remove', 'clear', 'invalid']) {
  browserCase(`another-tab ${mode} revokes permission and keeps pending-reload guidance`, async (entry) => {
    await withContext(entry, async (page, context) => {
      await grant(page, entry);
      const other = await context.newPage();
      await other.goto(base + '/secondary');
      await other.evaluate(({ key, mode }) => {
        if (mode === 'remove') localStorage.removeItem(key);
        else if (mode === 'clear') localStorage.clear();
        else localStorage.setItem(key, mode === 'invalid' ? 'yes' : 'denied');
      }, { key, mode });
      await settle(page);
      await pending(page, entry, 'secondary-tab-' + mode);
      await deny(page);
      await pending(page, entry, 'local-denial-after-' + mode);
    });
  });
}

browserCase('blocked saving cannot erase pending reload or falsely preserve an off status after re-grant', async (entry) => {
  await withContext(entry, async (page) => {
    await grant(page, entry);
    await page.evaluate(() => {
      Storage.prototype.setItem = function () { throw new DOMException('Synthetic blocked-storage write', 'SecurityError'); };
    });
    await deny(page);
    await pending(page, entry, 'blocked-write-denial');
    await deny(page);
    await pending(page, entry, 'blocked-write-repeated-denial');
    assert.match((await snapshot(page, entry, 'blocked-write-disclosure')).visible_text, /browser blocked saving this choice/i);
    await grant(page, entry);
    await on(page, entry, 'page-only-re-grant');
    await page.reload();
    await on(page, entry, 'saved-grant-returns-on-next-document');
  });
});

browserCase('inaccessible storage after a previous grant is not permission and needs reload', async (entry) => {
  await withContext(entry, async (page, context) => {
    await grant(page, entry);
    await page.evaluate(() => {
      Storage.prototype.getItem = function () { throw new DOMException('Synthetic blocked-storage read', 'SecurityError'); };
    });
    const other = await context.newPage();
    await other.goto(base + '/secondary');
    await other.evaluate((key) => localStorage.setItem(key, 'denied'), key);
    await settle(page);
    await pending(page, entry, 'read-blocked-after-real-storage-event');
    assert.match((await snapshot(page, entry, 'blocked-read-disclosure')).visible_text, /browser blocked saving this choice/i);
    await deny(page);
    await pending(page, entry, 'read-blocked-local-denial');
  });
});

for (const mode of ['denied', 'remove', 'clear']) {
  browserCase(`a page-only grant with blocked storage still obeys another-tab ${mode}`, async (entry) => {
    await withContext(entry, async (page, context) => {
      const initial = await snapshot(page, entry, 'blocked-storage-default');
      assert.equal(initial.status, status.off);
      assert.equal(initial.script_executions, 0);
      await grant(page, entry);
      const other = await context.newPage();
      await other.goto(base + '/secondary');
      await other.evaluate(({ key, mode }) => {
        if (mode === 'remove') localStorage.removeItem(key);
        else if (mode === 'clear') localStorage.clear();
        else localStorage.setItem(key, 'denied');
      }, { key, mode });
      await settle(page);
      await pending(page, entry, 'blocked-page-only-grant-revoked-' + mode);
      await deny(page);
      await pending(page, entry, 'blocked-page-repeated-denial');
    }, { storedValue: 'granted', blockedGet: true, blockedSet: true });
  });
}

browserCase('re-grant is on, subsequent denial is pending, and the reload button really restores off', async (entry) => {
  await withContext(entry, async (page) => {
    await grant(page, entry);
    await deny(page);
    await pending(page, entry, 'denied-before-re-grant');
    await grant(page, entry);
    await on(page, entry, 're-granted-in-the-same-document');
    await deny(page);
    await pending(page, entry, 'denied-again');
    await Promise.all([
      page.waitForEvent('load'),
      page.getByRole('button', { name: 'Reload to apply', exact: true }).click(),
    ]);
    await page.getByRole('button', { name: 'Allow analytics', exact: true }).waitFor();
    const value = await snapshot(page, entry, 'fresh-document-after-reload-control');
    assert.equal(value.status, status.off);
    assert.equal(value.reload_control_present, false);
    assert.equal(value.beacon_script_present, false);
    assert.equal(value.script_executions, 0);
    assert.equal(value.saved_preference, 'denied');
  });
});

browserCase('document tracker history survives remounting the preference UI', async (entry) => {
  await withContext(entry, async (page) => {
    await grant(page, entry);
    await deny(page);
    await pending(page, entry, 'denied-before-remount');
    await page.evaluate(() => window.__repairRemountOptionalAnalytics());
    await page.getByRole('button', { name: 'Allow analytics', exact: true }).waitFor();
    await pending(page, entry, 'same-document-after-remount');
  });
});

browserCase('denying when no tracker is configured does not invent an already-loaded tracker', async (entry) => {
  await withContext(entry, async (page) => {
    await page.getByRole('button', { name: 'Allow analytics', exact: true }).click();
    await settle(page);
    await deny(page);
    const value = await snapshot(page, entry, 'unconfigured-denial');
    assert.equal(value.status, status.off);
    assert.equal(value.reload_control_present, false);
    assert.equal(value.beacon_script_present, false);
    assert.equal(value.script_executions, 0);
  }, { pathname: '/unconfigured' });
});
