import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_PRESETS } from '../lib/sa/presets';

test('Aadhaar demo uses an explicitly synthetic documentation pattern', () => {
  const preset = ALL_PRESETS.find((p) => p.id === 'aadhaar-pan');
  assert.ok(preset);
  assert.ok(preset.text.includes('1234 1234 1234'), 'use the public documentation example, not the old potentially issuable pattern');
});
