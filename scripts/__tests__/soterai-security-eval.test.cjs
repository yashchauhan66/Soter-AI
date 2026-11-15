'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { materialize, payloadContainsFixture, metrics, summarize, runEvaluation, markdown } = require('../soterai-security-eval.cjs');
const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/soterai-security-eval.json'), 'utf8'));

test('fixed fixtures have stable materialization and explicitly label scope limits', () => {
  const fixtures = materialize(corpus);
  assert.deepEqual(fixtures, materialize(corpus));
  assert.equal(new Set(fixtures.map(row => row.id)).size, fixtures.length);
  assert.ok(fixtures.some(row => row.scope === 'outside-contract' && row.layout === 'separate-requests'));
  assert.ok(fixtures.some(row => row.scope === 'unsupported-input' && row.layout === 'image'));
  assert.ok(fixtures.some(row => row.mutation === 'content'));
  assert.ok(fixtures.some(row => row.mutation === 'expiry'));
  assert.throws(() => materialize({ ...corpus, cases: [corpus.cases[0], corpus.cases[0]] }), /CORPUS_INVALID/);
});

test('confusion matrices never credit withheld or unsupported cases as detected', () => {
  const rows = [
    { label: 'sensitive', outcome: 'detected' }, { label: 'sensitive', outcome: 'clean' },
    { label: 'sensitive', outcome: 'withheld' }, { label: 'sensitive', outcome: 'unsupported' },
    { label: 'benign', outcome: 'detected' }, { label: 'benign', outcome: 'clean' }, { label: 'benign', outcome: 'error' },
  ];
  assert.deepEqual(metrics(rows), { cases: 7, conclusive: 4, truePositives: 1, falseNegatives: 1, falsePositives: 1, trueNegatives: 1,
    unsupported: 1, withheld: 1, errors: 1, falseNegativeRate: 0.5, falsePositiveRate: 0.5, conclusiveCoverage: 4 / 7 });
  assert.equal(metrics([]).falseNegativeRate, null);
  const summary = summarize(rows.map((row, index) => ({ ...row, surface: 'gateway', class: 'test',
    scope: index === 1 ? 'outside-contract' : 'supported', utility: row.label === 'benign', publicPreserved: row.outcome === 'clean' })));
  assert.equal(summary.supported.falseNegatives, 0);
  assert.equal(summary.outsideContract.falseNegatives, 1);
  assert.equal(summary.publicWorkflowUtility.completed, 1);
  assert.equal(summary.publicWorkflowUtility.cases, 3);
});

test('fixture oracle catches survivors after unrelated rewriting and in nested arguments', () => {
  const value = corpus.registeredValue;
  assert.equal(payloadContainsFixture([{ messages: [{ content: '[REDACTED_EMAIL] ' + value }] }], [value]), true);
  assert.equal(payloadContainsFixture([{ arguments: JSON.stringify({ private: value }) }], [value]), true);
  assert.equal(payloadContainsFixture([{ messages: [{ content: '[REDACTED_SECRET]' }] }], [value]), false);
});

test('current source pipeline produces bounded secret-free evidence and useful controls', async () => {
  const report = await runEvaluation({ iterations: 1 });
  const find = id => report.outcomes.find(row => row.id === id);
  assert.equal(report.corpus.cases, corpus.cases.length);
  assert.equal(report.outcomes.filter(row => row.outcome === 'error').length, 0);
  assert.equal(find('gateway-registered-raw').outcome, 'detected');
  assert.equal(find('gateway-registered-raw').providerCalls, 0);
  assert.equal(find('gateway-registered-public').providerCalls, 1);
  assert.equal(find('gateway-registered-public').publicPreserved, true);
  assert.equal(find('gateway-gzip-public').publicPreserved, true);
  assert.equal(find('gateway-same-request-fragments').providerCalls, 0);
  assert.equal(find('gateway-image').outcome, 'unsupported');
  assert.equal(find('reader-content-race').code, 'CHANGED');
  assert.equal(find('reader-expired').code, 'EXPIRED');
  assert.equal(find('reader-public').publicPreserved, true);
  assert.equal(find('vendor-fixture-control').code, 'artifact_accepted');
  assert.equal(find('vendor-runtime-substitution').code, 'artifact_refused');
  assert.equal(find('vendor-default-pin-refusal').code, 'artifact_refused');
  assert.equal(report.execution.networkUsed, false);
  assert.equal(report.execution.nativeIdeUsed, false);
  assert.equal(report.releaseReady, false);
  assert.match(report.independence, /NOT INDEPENDENT/);
  assert.match(report.corpus.materializedSha256, /^[a-f0-9]{64}$/);
  assert.ok(report.sourceBindings['apps/local-ai-broker/src/BrokerServer.ts']);
  assert.ok(report.sourceBindings['packages/guard-core/src/Redactor.ts']);
  assert.ok(report.sourceBindings['packages/core/src/RegisteredSecretMatcher.ts']);
  const serialized = JSON.stringify(report) + markdown(report);
  for (const value of [corpus.registeredValue, corpus.opaqueValue, 'MintHorizon8!', 'QuietLemon9!',
    Buffer.from(corpus.registeredValue).toString('base64'), Buffer.from(corpus.registeredValue).toString('hex')]) {
    assert.equal(serialized.includes(value), false, 'Value-bearing content must not enter evidence');
  }
  for (const row of report.outcomes) {
    assert.ok(Number.isFinite(row.latencyMs) && row.latencyMs >= 0);
    assert.equal(row.latency.samples, 1);
  }
});
