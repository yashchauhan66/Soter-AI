import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BILLING_NOTE } from '../lib/sa/pricing';

test('INR billing does not assert unverified international payment eligibility', () => {
  assert.doesNotMatch(BILLING_NOTE, /international billing is not available|cannot pay/i);
  const page = readFileSync(new URL('../app/pricing/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /Not yet\. Paid plans|a buyer outside India cannot pay/);
});
