import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the visible hero preset list includes all five requested risks', () => {
  const text = readFileSync(new URL('../components/sa/HeroDemo.tsx', import.meta.url), 'utf8');
  const quick = text.match(/const QUICK = (\[[^;]+\])/)?.[1] ?? '';
  for (const id of ['injection', 'aadhaar-pan', 'api-key', 'hinglish', 'tool-call']) {
    assert.ok(quick.includes(`'${id}'`), `missing visible preset: ${id}`);
  }
});
