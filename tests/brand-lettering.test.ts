import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (name: string) => readFileSync(path.join(root, name));
// Legacy exports remain available; the selected production asset has its own address.
const retained = {
  'public/brand/soterai-symbol.svg': '6bf900b7c47b928fb49ebd3895a3db7a10133e1bee51b321328b355bd234a648',
  'public/brand/soterai-symbol-mono.svg': '4ec231c7790af7164abce3bf6d087008a2ac4dccd3f5c9f5c967801aed06145f',
  'public/logo-mark.png': '2b629c3dfdcbb153b7a48494cff530f73674dcc349d2e0777061b9f92e662b37',
  'public/logo-mark@2x.png': 'd4589499a8825b1e0d926a0ea4dc50b5488917154cc9905adfb71aa80fc55a0e',
  'public/icon.png': '506fe00e01ee186567803e6395cf2364e86eccef6d3ac5f44ab2adb4dd04e8d3',
  'public/icon-192.png': '0aa18f688e4c83fb9da4a5b4c8f933667d68bce734c86668790572a589653d91',
  'public/icon-512.png': 'd48bdb547fca82a07e3ceb6f36e38527e479ba7f51e9b3bfe884ac785dc46f54',
  'public/apple-icon.png': 'aced96ceb3abb22205e63f5e211b1b3ce4f48f7806e0ba5290011c592c4e9b8e',
};

test('the previous cube icon and its complete raster set stay byte-for-byte unchanged', () => {
  for (const [name, hash] of Object.entries(retained)) {
    assert.equal(createHash('sha256').update(read(name)).digest('hex'), hash, `Do not redesign the retained icon: ${name}`);
  }
});

test('SoterAI has its own locally served lettering, not another generic font selection', () => {
  const fontPath = path.join(root, 'public/brand/soterai-signature.woff');
  assert.ok(existsSync(fontPath), 'Missing the custom seven-letter display font');
  const font = readFileSync(fontPath);
  assert.equal(font.toString('ascii', 0, 4), 'wOFF');
  assert.equal(font.readUInt32BE(8), font.length);
  assert.ok(font.length < 30000);
  const css = read('components/layout/brand-lettering.css').toString();
  assert.match(css, /font-family:\s*['"]SoterAI Signature['"]/);
  assert.match(css, /font-display:\s*swap/);
  assert.doesNotMatch(css, /var\(--font-body\)/, 'An undefined CSS variable invalidates the entire custom font stack');
  assert.doesNotMatch(css, /https?:\/\//);
  const svg = read('public/brand/soterai-wordmark.svg').toString();
  assert.match(svg, /data-lettering="soterai-signature"/);
  assert.deepEqual([...svg.matchAll(/data-letter="([^"]+)"/g)].map(match => match[1]), [...'SoterAI']);
  assert.doesNotMatch(svg, /<(text|image|script|foreignObject)\b/);
});

test('the refined lettering keeps one live accessible name and the existing home target', () => {
  const logo = read('components/layout/Logo.tsx').toString();
  const chrome = read('components/layout/SiteChrome.tsx').toString();
  assert.match(logo, /data-brand-geometry="selected-hexagon"/);
  assert.match(logo, /soter-wordmark/);
  assert.match(logo, /id=\{wordmarkId\}/);
  assert.doesNotMatch(logo, /data-brand-geometry="gated-s"|>AI<\/span>/);
  assert.match(chrome, /aria-labelledby="site-header-wordmark site-header-home"/);
  assert.match(chrome, /min-h-11/);
});
