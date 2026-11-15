import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the rendered document declares the brief’s en-IN English locale', () => {
  const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
  assert.ok(/<html\b[^>]*\blang="en-IN"/.test(layout), 'root document must declare en-IN without adding nonexistent translated URLs');
});
