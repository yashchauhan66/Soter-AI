import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import {
  DIRECT_VSIX_URL,
  EDITOR_OPTIONS,
  EXTENSION_ID,
  EXTENSION_VERSION,
  OPEN_VSX_URL,
  VSCODE_MARKETPLACE_URL,
  VSIX_SHA256_URL,
} from '../app/extensions/ide/extensionData';

const manifest = JSON.parse(readFileSync('packages/vscode-extension/package.json', 'utf8')) as {
  publisher: string;
  name: string;
  version: string;
};

test('IDE extension page release identity matches the packaged extension', () => {
  assert.equal(EXTENSION_ID, `${manifest.publisher}.${manifest.name}`);
  assert.equal(EXTENSION_VERSION, manifest.version);
  assert.match(VSCODE_MARKETPLACE_URL, new RegExp(`itemName=${EXTENSION_ID}$`));
  assert.equal(
    OPEN_VSX_URL,
    `https://open-vsx.org/extension/${manifest.publisher}/${manifest.name}`,
  );
  assert.ok(
    DIRECT_VSIX_URL.includes(`/${manifest.version}/file/${EXTENSION_ID}-${manifest.version}.vsix`),
  );
  assert.ok(
    VSIX_SHA256_URL.includes(
      `/${manifest.version}/file/${EXTENSION_ID}-${manifest.version}.sha256`,
    ),
  );
});

test('every editor has an install listing and a package command', () => {
  assert.deepEqual(
    EDITOR_OPTIONS.map((editor) => editor.name),
    ['Visual Studio Code', 'Cursor', 'Windsurf', 'Kiro', 'Antigravity', 'VSCodium'],
  );

  for (const editor of EDITOR_OPTIONS) {
    const expectedProtocol = editor.name === 'Visual Studio Code' ? 'vscode' : editor.icon;
    assert.equal(editor.deepLink, `${expectedProtocol}:extension/${EXTENSION_ID}`, editor.name);
    assert.ok(editor.command.endsWith(`--install-extension ${EXTENSION_ID}`), editor.name);
    assert.ok(
      editor.listingUrl === VSCODE_MARKETPLACE_URL || editor.listingUrl === OPEN_VSX_URL,
      `${editor.name} must use an authoritative registry`,
    );
  }
});

test('runtime-verified badges are backed by current packaged-host evidence', () => {
  const verified = EDITOR_OPTIONS.filter((editor) => editor.status === 'runtime-verified');
  assert.equal(verified.length, 5);

  for (const editor of verified) {
    assert.ok(editor.evidenceFile, `${editor.name} must reference evidence`);
    const evidence = JSON.parse(readFileSync(editor.evidenceFile!, 'utf8')) as {
      extension: string;
      version: string;
      packagedExecution: boolean;
      result: string;
      checks: Array<{ passed: boolean }>;
    };
    assert.equal(evidence.extension, EXTENSION_ID, editor.name);
    assert.equal(evidence.version, EXTENSION_VERSION, editor.name);
    assert.equal(evidence.packagedExecution, true, editor.name);
    assert.equal(evidence.result, 'PASS', editor.name);
    assert.equal(evidence.checks.length, 7, editor.name);
    assert.ok(
      evidence.checks.every((check) => check.passed),
      editor.name,
    );
  }

  const vscodium = EDITOR_OPTIONS.find((editor) => editor.name === 'VSCodium');
  assert.equal(vscodium?.status, 'registry-ready');
  assert.equal(vscodium?.evidenceFile, undefined);
});

test('product screenshots used by the page are present', () => {
  for (const asset of [
    'public/marketplace/screenshots/control-panel-protection.png',
    'public/marketplace/screenshots/secret-scan-result.png',
    'public/marketplace/screenshots/scan-selection-result.png',
    'public/marketplace/screenshots/safe-mode-enabled.png',
  ]) {
    assert.equal(existsSync(asset), true, `${asset} must exist`);
  }
});

test('every page link resolves to a known internal or verified external destination', () => {
  const pageSource = readFileSync('app/extensions/ide/page.tsx', 'utf8');
  const dataSource = readFileSync('app/extensions/ide/extensionData.ts', 'utf8');
  // Literal URLs — these appear verbatim in the source.
  const externalConstants = [
    VSCODE_MARKETPLACE_URL,
    OPEN_VSX_URL,
    // The source repository went private on 2026-09-04, so no GitHub URL may be
    // declared here or linked from the page — it would 404 for every visitor.
    'mailto:support@soterai.in?subject=IDE%20Guard%20issue',
  ];
  // DIRECT_VSIX_URL and VSIX_SHA256_URL are built from a template literal, so the
  // resolved string is never present in the source text — match the fixed prefix
  // and assert the resolved value still carries the shipped version.
  const derivedConstants = [DIRECT_VSIX_URL, VSIX_SHA256_URL];
  const internalLinks = ['/', '/contact-sales', '/docs', '/support'];

  for (const url of externalConstants) {
    assert.ok(dataSource.includes(url), `${url} must stay declared in extensionData.ts`);
  }
  for (const url of derivedConstants) {
    assert.ok(
      dataSource.includes('https://open-vsx.org/api/soterai/soterai-ide-guard/'),
      'the Open VSX download base must stay declared in extensionData.ts',
    );
    assert.ok(url.includes(EXTENSION_VERSION), `${url} must resolve to the shipped version`);
  }
  assert.ok(
    !dataSource.includes('github.com') && !pageSource.includes('github.com'),
    'the private source repository must not be linked from the public IDE page',
  );
  for (const href of internalLinks) {
    assert.ok(pageSource.includes(`href="${href}"`), `${href} must stay linked from the page`);
  }
});

test('page uses direct editor protocol links with verified registry fallbacks', () => {
  const source = readFileSync('app/extensions/ide/page.tsx', 'utf8');
  assert.match(source, /href=\{editor\.deepLink\}/);
  assert.match(source, /Open in \{editor\.name\}/);
  assert.match(source, /\{editor\.listingLabel\} fallback/);
  assert.match(source, /cannot transparently intercept/);
  assert.match(source, /Download VSIX/);
});
