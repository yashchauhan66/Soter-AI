#!/usr/bin/env node
/**
 * Browser QA for public pages: accessibility (axe-core, WCAG 2.0/2.1/2.2 A and AA),
 * horizontal overflow, console errors, failed requests, and optional screenshots.
 *
 * It drives a real Chromium through Playwright, so it sees what a visitor sees after
 * hydration. Run it against a running site (dev or production build).
 *
 * Usage:
 *   node scripts/seo/qa-pages.mjs --base http://localhost:3100 --paths /,/pricing,/playground
 *   node scripts/seo/qa-pages.mjs --paths /,/pricing --shots .tmp-shots   # also save screenshots
 *   node scripts/seo/qa-pages.mjs --json qa-report.json                    # machine-readable output
 *
 * Viewports: 390x844 (phone) and 1280x800 (desktop). Exit code 1 if any check fails.
 * Reduced motion is requested so animation cannot change what axe measures.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
};
const BASE = String(opt('base', 'http://localhost:3100')).replace(/\/$/, '');
const PATHS = String(opt('paths', '/')).split(',').map((p) => p.trim()).filter(Boolean);
const SHOTS = opt('shots', null);
const JSON_OUT = opt('json', null);
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
];
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// Third-party failures we cannot fix from this repo and that say nothing about the page.
const IGNORED_REQUEST = [/googletagmanager/, /google-analytics/, /cloudflareinsights/, /checkout\.razorpay/];

if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const results = [];
let failed = 0;

for (const path of PATHS) {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      reducedMotion: 'reduce',
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const consoleErrors = [];
    const failedRequests = [];
    page.on('console', (m) => {
      // The Cloudflare beacon refuses any origin except the production one, so on a
      // local run it always logs a CORS error that says nothing about the page.
      if (m.type() === 'error' && !/cloudflareinsights|net::ERR_FAILED/.test(m.text())) consoleErrors.push(m.text().slice(0, 200));
    });
    page.on('requestfailed', (r) => {
      if (!IGNORED_REQUEST.some((re) => re.test(r.url()))) failedRequests.push(`${r.url()} ${r.failure()?.errorText ?? ''}`.slice(0, 200));
    });
    page.on('response', (r) => {
      if (r.status() >= 400 && !IGNORED_REQUEST.some((re) => re.test(r.url())) && !/\/api\/auth\/session/.test(r.url())) {
        failedRequests.push(`${r.status()} ${r.url()}`.slice(0, 200));
      }
    });

    const row = { path, viewport: vp.name, problems: [] };
    try {
      const res = await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 120000 });
      row.status = res?.status();
      if (res?.status() !== 200) row.problems.push(`HTTP ${res?.status()}`);

      // "networkidle" can fire before React has hydrated, especially on a dev server, and
      // some fixes (keyboard-focusable code blocks) are applied after hydration. Give it a
      // moment so axe sees the page a visitor sees.
      await page.waitForTimeout(Number(opt('settle', 1500)));
      await page.addScriptTag({ path: axePath });
      const axe = await page.evaluate(
        async (tags) =>
          // eslint-disable-next-line no-undef
          await axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] }),
        AXE_TAGS,
      );
      row.axe = axe.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.length,
        sample: v.nodes.slice(0, 2).map((n) => n.target.join(' ')),
      }));
      for (const v of row.axe) row.problems.push(`axe ${v.impact} ${v.id} x${v.nodes}: ${v.help} [${v.sample.join(' | ')}]`);

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
      });
      row.overflow = overflow;
      if (overflow.scrollWidth > overflow.clientWidth + 1) {
        row.problems.push(`horizontal overflow: scrollWidth ${overflow.scrollWidth} > ${overflow.clientWidth}`);
      }

      const h1 = await page.locator('h1').count();
      if (h1 !== 1) row.problems.push(`${h1} h1 elements (expected 1)`);

      if (consoleErrors.length) row.problems.push(`console errors: ${consoleErrors.slice(0, 3).join(' || ')}`);
      if (failedRequests.length) row.problems.push(`failed requests: ${[...new Set(failedRequests)].slice(0, 3).join(' || ')}`);

      if (SHOTS) {
        const file = join(SHOTS, `${path === '/' ? 'home' : path.replace(/^\//, '').replace(/\//g, '_')}-${vp.name}.png`);
        await page.screenshot({ path: file, fullPage: true });
        row.screenshot = file;
      }
    } catch (e) {
      row.problems.push(`error: ${String(e).slice(0, 200)}`);
    }
    await context.close();
    results.push(row);
    if (row.problems.length) failed++;
    console.log(`${row.problems.length ? 'FAIL' : 'ok  '} ${path} [${vp.name}]${row.problems.length ? '' : ''}`);
    for (const p of row.problems) console.log(`   - ${p}`);
  }
}

await browser.close();
if (JSON_OUT) writeFileSync(String(JSON_OUT), JSON.stringify({ base: BASE, ranAt: new Date().toISOString(), results }, null, 2));
console.log(`\n${results.length - failed}/${results.length} page and viewport runs clean`);
process.exit(failed ? 1 : 0);
