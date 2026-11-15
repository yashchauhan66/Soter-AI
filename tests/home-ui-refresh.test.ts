import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import Module, { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root = process.env.SOTER_UI_SOURCE_ROOT ?? process.cwd();
const introPath = path.join(root, 'components/sa/HomeIntro.tsx');
const pagePath = path.join(root, 'app/page.tsx');
// Preserved from the pre-refresh homepage, SHA256
// 2bf92185782559ca3c7e66bc9836d0c495c19cd039f186132718359f631f45ee.
// Keep the regression portable; it must not depend on a local evidence folder.
const originalDestinations = [
  '/ai-agent-security', '/ai-security-india', '/ai-user-security', '/benchmarks',
  '/contact-sales', '/docs', '/docs/quickstart', '/integrations', '/playground',
  '/pricing', '/pricing#status', '/signup',
];

const consumed = new Map<string, string>();
const loaded = new Map<string, Module>();
function loadSource(filename: string): Record<string, unknown> {
  const cached = loaded.get(filename);
  if (cached) return cached.exports;
  const source = readFileSync(filename, 'utf8');
  consumed.set(filename, createHash('sha256').update(source).digest('hex'));
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = [path.join(process.cwd(), 'node_modules')];
  loaded.set(filename, mod);
  const nativeRequire = createRequire(filename);
  mod.require = Object.assign((request: string) => {
    // Build-time presentation adapters only; all React and component logic is real.
    if (request.endsWith('.css')) return {};
    if (request === 'next/font/local') return (options: { variable: string }) => ({ variable: options.variable });
    if (request.startsWith('.')) {
      const stem = path.resolve(path.dirname(filename), request);
      const resolved = [stem, stem + '.ts', stem + '.tsx'].find(candidate => /\.tsx?$/.test(candidate) && existsSync(candidate));
      if (resolved) return loadSource(resolved);
    }
    return nativeRequire(request);
  }, nativeRequire);
  const compiled = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    reportDiagnostics: true,
  });
  assert.equal((compiled.diagnostics ?? []).filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error).length, 0);
  (mod as unknown as { _compile(code: string, filename: string): void })._compile(compiled.outputText, filename);
  return mod.exports;
}
async function introHtml() {
  assert.ok(existsSync(introPath), 'Homepage needs a concise, audience-aware introduction, not the old repeated paragraphs.');
  const { HomeIntro } = loadSource(introPath);
  return renderToStaticMarkup(React.createElement(HomeIntro as React.ComponentType));
}
process.on('exit', () => console.log('HOME_UI_SOURCE_CONSUMED ' + JSON.stringify(Object.fromEntries(consumed))));

const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

test('hero names the security benefit and gives it one supporting summary', async () => {
  const html = await introHtml();
  const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '';
  assert.equal(text(heading), 'Detect prompt injection. Redact sensitive data.');
  assert.equal((html.match(/data-home-summary=/g) ?? []).length, 1);
  assert.doesNotMatch(html, /sa-hero__context/);
  assert.ok(readFileSync(pagePath, 'utf8').includes('<HomeIntro />'));
});

test('developer and security-team paths are available inside the hero without losing signup or the demo', async () => {
  const html = await introHtml();
  assert.match(html, /<nav[^>]+aria-label="Choose your starting point"/);
  for (const href of ['/playground', '/signup', '/docs/quickstart', '/ai-user-security']) {
    assert.ok(html.includes(`href="${href}"`), `Missing existing destination: ${href}`);
  }
  assert.match(text(html), /For developers/);
  assert.match(text(html), /For security teams/);
  assert.match(text(html), /runs on our server and is rate limited/);
  assert.match(text(html), /Use sample data, not real secrets/);
});

test('homepage redesign preserves inherited routes, real demo and qualified evidence', async () => {
  await introHtml();
  const current = readFileSync(pagePath, 'utf8') + readFileSync(introPath, 'utf8');
  for (const href of originalDestinations) assert.ok(current.includes(`href="${href}"`), `Removed conversion or evidence route: ${href}`);
  for (const token of ['<HeroDemo />', 'NUMBERS_WITH_LIMITS', 'BLIND_RECALL', 'LATENCY_SENTENCE', 'SURFACES.map', 'faqJsonLd(FAQ)', '<Faq items={FAQ} />']) {
    assert.ok(current.includes(token), `Preserve existing source-backed behavior: ${token}`);
  }
  assert.match(current, /Higher plans raise limits and add team controls\. They do not unlock stronger detection\./);
});
