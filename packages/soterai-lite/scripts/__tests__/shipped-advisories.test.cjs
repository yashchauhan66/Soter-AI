'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseOsvBatch } = require('../../../../scripts/soterai-shipped-advisories.cjs');

test('OSV empty objects and validated advisories preserve component order', () => {
  assert.deepEqual(parseOsvBatch({ results: [{}, { vulns: [{ id: 'GHSA-abcd-1234-efgh' }] }, { vulns: [] }] }, 3),
    [[], ['GHSA-abcd-1234-efgh'], []]);
});

test('malformed OSV component results cannot become zero known matches', () => {
  for (const result of [false, 0, 'unexpected', [], null, { vulns: null }, { next_page_token: 0 }]) {
    assert.throws(() => parseOsvBatch({ results: [result] }, 1), `Accepted malformed result: ${JSON.stringify(result)}`);
  }
});

test('OSV incomplete pagination, malformed findings and mismatched batches refuse', () => {
  for (const payload of [null, {}, { results: [] }, { results: [{ next_page_token: 'next' }] },
    { results: [{ vulns: [{}] }] }, { results: [{ vulns: [false] }] }, { results: [{ vulns: [{ id: 'private\ntext' }] }] },
    { results: [{ vulns: 'invalid' }] }]) {
    assert.throws(() => parseOsvBatch(payload, 1));
  }
});
