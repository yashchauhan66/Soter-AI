import test from 'node:test';
import assert from 'node:assert/strict';
import { clampDescription } from '../lib/seo/metadata';

test('description clamping includes its suffix inside the 155-character limit', () => {
  assert.ok(clampDescription('x'.repeat(170)).length <= 155);
});
