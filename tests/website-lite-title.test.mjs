import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('SoterAI Lite metadata stays within 60 characters after the inherited site title suffix', () => {
  const source = readFileSync('app/docs/soterai-lite/page.tsx', 'utf8');
  const title = source.match(/title:\s*"([^"]+)"/)?.[1];
  assert.ok(title, 'The documentation page must retain its explicit title');
  assert.ok(`${title} | soterai.in`.length <= 60, `Rendered title exceeds the brief: ${title} | soterai.in`);
});
