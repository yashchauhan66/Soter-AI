import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';

// Source/SSR contracts only: class tokens do not prove rendered pixel geometry.
// Real React, Next Link and SessionProvider run without mounting effects or accounts.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceOverlay = process.env.SOTER_HEADER_CTA_SOURCE;
const consumed = new Map<string, { consumed_from: string; sha256: string }>();
const loaded = new Map<string, Module>();

function readSource(filename: string): string {
  const relative = path.relative(root, filename).replaceAll('\\', '/');
  const overlay = sourceOverlay ? path.resolve(sourceOverlay, relative) : '';
  // Optional immutable source snapshots may retain their original extension plus .txt.
  const from = overlay && existsSync(overlay) ? overlay : overlay && existsSync(overlay + '.txt') ? overlay + '.txt' : filename;
  const bytes = readFileSync(from);
  consumed.set(relative, { consumed_from: from, sha256: createHash('sha256').update(bytes).digest('hex') });
  return bytes.toString('utf8');
}

function loadSource(filename: string): Record<string, unknown> {
  const cached = loaded.get(filename);
  if (cached) return cached.exports;
  const source = readSource(filename);
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = [path.join(root, 'node_modules')];
  loaded.set(filename, mod);
  const nativeRequire = createRequire(filename);
  mod.require = Object.assign((request: string) => {
    // Adapt only compile-time presentation boundaries, not component behavior.
    if (request.endsWith('.css')) return {};
    if (request === 'next/font/local') return (options: { variable: string }) => ({ variable: options.variable });
    if (request.startsWith('.') || request.startsWith('@/')) {
      const stem = request.startsWith('@/') ? path.resolve(root, request.slice(2)) : path.resolve(path.dirname(filename), request);
      const resolved = [stem, stem + '.ts', stem + '.tsx', path.join(stem, 'index.ts'), path.join(stem, 'index.tsx')]
        .find(candidate => /\.tsx?$/.test(candidate) && existsSync(candidate));
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

process.on('exit', () => console.log('HEADER_CTA_SOURCE_CONSUMED ' + JSON.stringify(Object.fromEntries(consumed))));

const attribute = (attributes: string, name: string) => attributes.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1];
const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
function links(html: string) {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attributes, body]) => ({
    href: attribute(attributes, 'href'),
    className: attribute(attributes, 'class') ?? '',
    // These links contain text and aria-hidden span/SVG decorations only.
    name: attribute(attributes, 'aria-label') ?? text(body.replace(/<(span|svg)\b[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/\1>/g, '')),
    body,
  }));
}

type FixtureSession = Session & { user: NonNullable<Session['user']> & { isAdmin: boolean } };
const syntheticSession = (isAdmin: boolean): FixtureSession => ({
  user: { name: 'Synthetic UI fixture', email: 'header-fixture@example.invalid', isAdmin },
  expires: '2099-01-01T00:00:00.000Z',
});
function headerHtml(session: Session | null) {
  const { HeaderNav } = loadSource(path.join(root, 'components/auth/HeaderNav.tsx'));
  return renderToStaticMarkup(React.createElement(SessionProvider, {
    session, refetchInterval: 0, refetchOnWindowFocus: false,
  }, React.createElement(PathnameContext.Provider, { value: '/' },
    React.createElement(HeaderNav as React.ComponentType),
  )));
}

for (const fixture of [
  { state: 'public', session: null, href: '/playground', name: 'Try it live' },
  { state: 'member', session: syntheticSession(false), href: '/dashboard', name: 'Dashboard' },
  { state: 'admin', session: syntheticSession(true), href: '/admin', name: 'Admin' },
]) {
  test(`header primary link declares minimum height for ${fixture.state} without changing its auth destination`, () => {
    const html = headerHtml(fixture.session);
    const primary = links(html).filter(link => link.className.split(/\s+/).includes('button-primary'));
    assert.equal(primary.length, 1);
    assert.equal(primary[0].href, fixture.href);
    assert.equal(primary[0].name, fixture.name);
    assert.equal(primary[0].className, 'button-primary button-sm min-h-12');
    if (fixture.session) assert.match(text(html), /Sign out/);
    else assert.ok(links(html).some(link => link.href === '/signin' && link.name === 'Sign in'));
  });
}

test('mobile opener SSR declares both minimum dimensions without losing its control semantics', () => {
  const buttons = [...headerHtml(null).matchAll(/<button\b([^>]*)>/g)];
  const opener = buttons.filter(([, attributes]) => attribute(attributes, 'aria-label') === 'Open navigation menu');
  assert.equal(opener.length, 1);
  const attributes = opener[0][1];
  assert.equal(attribute(attributes, 'type'), 'button');
  assert.equal(attribute(attributes, 'aria-expanded'), 'false');
  assert.equal(attribute(attributes, 'aria-controls'), 'mobile-nav-panel');
  assert.equal(attribute(attributes, 'class'), 'button-icon lg:hidden min-h-12 min-w-12');
});

test('mobile close control source declares both minimum dimensions', () => {
  // The closed SSR drawer has no portal. Its open-state geometry/interaction is a browser gate.
  const source = readSource(path.join(root, 'components/layout/MobileNav.tsx'));
  const controls = [...source.matchAll(/aria-label="Close navigation menu"\s+className="([^"]+)"/g)];
  assert.equal(controls.length, 1);
  assert.equal(controls[0][1], 'button-icon min-h-12 min-w-12');
});

function homeSection(id: string) {
  const { default: Home } = loadSource(path.join(root, 'app/page.tsx'));
  const html = renderToStaticMarkup(React.createElement(Home as React.ComponentType));
  const section = html.match(new RegExp(`<section\\b[^>]*aria-labelledby="${id}"[^>]*>([\\s\\S]*?)<\\/section>`))?.[1];
  assert.ok(section, `Missing homepage section: ${id}`);
  return section;
}

test('homepage hero primary CTA renders Try it live while keeping its hidden arrow and signup', () => {
  const actions = links(homeSection('hero-title'));
  const primary = actions.filter(link => link.href === '/playground' && link.className.split(/\s+/).includes('sa-btn'));
  assert.equal(primary.length, 1);
  assert.equal(primary[0].name, 'Try it live');
  assert.match(primary[0].body, /<span aria-hidden="true">↗<\/span>/);
  assert.ok(actions.some(link => link.href === '/signup' && link.name === 'Create a free account'));
  assert.ok(actions.some(link => link.href === '/playground' && link.name === 'Paste your own text in the playground.'));
});

test('homepage closing primary CTA renders Try it live without relabelling secondary actions', () => {
  const actions = links(homeSection('closing'));
  const primary = actions.filter(link => link.href === '/playground');
  assert.equal(primary.length, 1);
  assert.equal(primary[0].name, 'Try it live');
  assert.deepEqual(actions.map(({ href, name }) => ({ href, name })), [
    { href: '/playground', name: 'Try it live' },
    { href: '/signup', name: 'Create a free account' },
    { href: '/contact-sales', name: 'Book a security review' },
  ]);
});
