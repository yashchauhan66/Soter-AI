import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('assistant code is activated by its own control, not idle or unrelated page interactions', () => {
  const source = readFileSync(new URL('../components/dashboard/AiAssistantLoader.tsx', import.meta.url), 'utf8');
  assert.ok(!/\brequestIdleCallback\s*\(/.test(source), 'idle preload causes nonessential JS and CPU work before the visitor requests help');
  assert.ok(!/window\.addEventListener\(/.test(source), 'scrolling or using the playground must not activate the assistant bundle');
});
