import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { PLANS } from '../lib/sa/pricing';

const modulePath = new URL('../lib/sa/pricing-schema.ts', import.meta.url);

test('structured pricing lists only the four published numeric INR offers, not a ceiling on custom Enterprise', async () => {
  assert.ok(existsSync(modulePath), 'numeric plan offers must be derived from the published pricing data');
  const { pricingOffersLd } = await import('../lib/sa/pricing-schema');
  const offers = pricingOffersLd(PLANS, 'https://soterai.in');
  assert.equal(offers.length, 4);
  assert.deepEqual(offers.map((o) => o.price), ['0', '999', '2999', '9999']);
  assert.ok(offers.every((o) => o.priceCurrency === 'INR' && o['@type'] === 'Offer'));
  const page = readFileSync(new URL('../app/pricing/page.tsx', import.meta.url), 'utf8');
  assert.ok(page.includes("'@type': 'SoftwareApplication'"));
  assert.doesNotMatch(page, /highPrice:|offerCount:/);
});
