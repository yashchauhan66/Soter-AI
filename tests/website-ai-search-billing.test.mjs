import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('AI-search guidance does not turn INR denomination into an unverified payment restriction', () => {
  for (const file of ['llms.txt', 'llms-full.txt']) {
    const source = readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /International billing is not available|plans cannot be bought outside India/);
  }
});
