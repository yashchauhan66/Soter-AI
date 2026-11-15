import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);

test('Lighthouse CI enforces the brief instead of uploading externally or weakening failing budgets', () => {
  const path = resolve('lighthouserc.cjs');
  assert.ok(existsSync(path), 'A runnable Lighthouse CI configuration is missing');
  const config = require(path).ci;
  assert.equal(config.collect.numberOfRuns, 3);
  assert.deepEqual(config.collect.url, ['http://127.0.0.1:3101']);
  assert.equal(config.collect.settings.throttlingMethod, 'simulate');
  assert.equal(config.assert.assertions['categories:performance'][1].minScore, 0.95);
  for (const category of ['accessibility', 'best-practices', 'seo']) {
    assert.equal(config.assert.assertions[`categories:${category}`][1].minScore, 1);
  }
  assert.equal(config.assert.assertions['largest-contentful-paint'][1].maxNumericValue, 2000);
  assert.equal(config.assert.assertions['cumulative-layout-shift'][1].maxNumericValue, 0.05);
  assert.equal(config.upload.target, 'filesystem');
  assert.ok(config.upload.outputDir.startsWith('docs/redesign/evidence/qa-final/lighthouse-ci-'));
});
