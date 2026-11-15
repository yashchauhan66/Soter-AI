import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('the root does not register a third self-hosted Inter family', () => {
  const layout = read('../app/layout.tsx');
  assert.doesNotMatch(layout, /from ["']@\/app\/fonts["']/);
  assert.doesNotMatch(layout, /\binter\.variable\b/);
  assert.match(layout, /saDisplay\.variable/);
  assert.match(layout, /saMono\.variable/);
});

test('the hero display font is preloaded rather than discovered late', () => {
  const fonts = read('../components/sa/fonts.ts');
  const display = fonts.split('export const saDisplay')[1]?.split('export const saMono')[0] ?? '';
  assert.ok(/\bpreload:\s*true\b/.test(display), 'Newsreader must be preloaded for the above-fold heading');
});
