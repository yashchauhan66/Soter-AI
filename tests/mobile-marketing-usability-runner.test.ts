import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';

const command = [
  path.resolve('node_modules/tsx/dist/cli.mjs'),
  '--test', '--test-reporter=tap',
  path.resolve('tests/mobile-marketing-usability.test.ts'),
];

function runMarketingModule(origin?: string) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (['SOTER_USABILITY_ORIGIN', 'NODE_TEST_CONTEXT'].includes(key.toUpperCase())) delete env[key];
  }
  if (origin !== undefined) env.SOTER_USABILITY_ORIGIN = origin;
  const result = spawnSync(process.execPath, command, { env, encoding: 'utf8', timeout: 20_000 });
  console.log('MARKETING_RUNNER ' + JSON.stringify({ command: [process.execPath, ...command], origin: origin ?? null, exit: result.status, signal: result.signal }));
  console.log(result.stdout + result.stderr);
  assert.equal(result.error, undefined, 'The actual integration module starts and completes natively.');
  assert.equal(result.signal, null);
  return result;
}

test('marketing integration module explicitly skips without a preview origin', { timeout: 30_000 }, () => {
  const result = runMarketingModule();
  assert.equal(result.status, 0, 'The default runner must succeed with SOTER_USABILITY_ORIGIN removed.');
  const skipped = [...result.stdout.matchAll(/^ok \d+ - (.+) # SKIP$/gm)].map(match => match[1]);
  assert.ok(skipped.includes('mobile header primary action and menu controls have 48px touch targets without overlap'));
  assert.ok(skipped.includes('generic playground CTA buttons use the same label on every marketing surface'));
  const count = Number(result.stdout.match(/^# tests (\d+)$/m)?.[1]);
  assert.ok(count >= 2, 'The module registers its real integration tests, not an empty suite.');
  assert.equal(skipped.length, count, 'Every preview-dependent case is an explicit skip, not a fake pass.');
  assert.match(result.stdout, /^# pass 0$/m);
  assert.match(result.stdout, /^# fail 0$/m);
  assert.match(result.stdout, new RegExp(`^# skipped ${count}$`, 'm'));
});

test('configured non-loopback, non-http and malformed preview targets still fail validation', { timeout: 70_000 }, () => {
  for (const origin of ['http://example.com', 'https://127.0.0.1:3130', 'not a URL']) {
    const result = runMarketingModule(origin);
    assert.notEqual(result.status, 0, origin + ': invalid configuration must fail before browser navigation.');
    assert.match(result.stdout + result.stderr, /ERR_ASSERTION|ERR_INVALID_URL/);
  }
});
