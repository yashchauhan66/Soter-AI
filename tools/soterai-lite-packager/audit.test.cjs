'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { inRange, affected } = require('./audit.cjs');
test('OSV fixed/limit endpoints are exclusive and last_affected inclusive', () => {
  for (const ending of ['fixed', 'limit', 'last_affected']) {
    const range = { type: 'SEMVER', events: [{ introduced: '1.0.0' }, { [ending]: '2.0.0' }] };
    assert.equal(inRange('0.9.9', range), false);
    assert.equal(inRange('1.0.0', range), true);
    assert.equal(inRange('1.9.9', range), true);
    assert.equal(inRange('2.0.0', range), ending === 'last_affected');
    assert.equal(inRange('2.0.1', range), false);
  }
});
test('OSV reopened ranges, zero sentinel, prereleases and explicit versions', () => {
  const range = { type: 'SEMVER', events: [{ introduced: '0' }, { fixed: '1.0.0' }, { introduced: '2.0.0-beta.1' }] };
  for (const [v, expected] of [['0.0.1', true], ['1.0.0', false], ['2.0.0-alpha.1', false], ['2.0.0-beta.1', true], ['4.0.0', true]]) assert.equal(inRange(v, range), expected);
  assert.equal(affected('1.0.0', { versions: ['1.0.0'], ranges: [range] }), true);
});
test('unsupported or malformed advisory boundaries cannot pass silently', () => {
  for (const range of [{ type: 'GIT', events: [] }, { type: 'SEMVER', events: [{ fixed: '1.0.0' }] },
    { type: 'SEMVER', events: [{ introduced: '2.0.0' }, { fixed: '1.0.0' }] },
    { type: 'SEMVER', events: [{ introduced: '1.x' }] },
    { type: 'SEMVER', events: [{ introduced: '1.0.0', fixed: '2.0.0' }] }]) assert.throws(() => inRange('1.1.0', range));
});
