'use strict';
// INERT component controls for external test instrumentation. NOT native proof.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const observed = require('./installed-broker-observation-proposed-03.cjs');
const PRIVATE = 'SOTERAI_F32_SYNTHETIC_PRIVATE_CONTROL_ONLY';
const healthy = () => ({ running: true, state: 'healthy', version: '0.2.0', url: 'http://127.0.0.1:53217',
  token: PRIVATE, memorySessionId: PRIVATE });
test('BO01 public healthy status is reduced to fixed metadata without raw result or token', () => {
  assert.deepEqual(observed.healthy(healthy()), {
    state: 'healthy', running: true, loopback: true, port: 53217, brokerVersion: '0.2.0',
  });
  assert(!JSON.stringify(observed.healthy(healthy())).includes(PRIVATE));
});
test('BO02 irrelevant private getter is never evaluated or serialized', () => {
  const value = healthy(); let reads = 0;
  Object.defineProperty(value, 'privateToken', { get() { reads++; throw Error(PRIVATE); } });
  observed.healthy(value); assert.equal(reads, 0);
});
test('BO03 healthy requires exact owner status/version/running fields', () => {
  for (const [key, value] of [['state', 'STOP_UNCONFIRMED'], ['state', 'starting'], ['running', false], ['version', '0.6.3']]) {
    assert.throws(() => observed.healthy({ ...healthy(), [key]: value }));
  }
});
test('BO04 only exact numeric private loopback endpoint is admitted; never legacy47321', () => {
  for (const url of ['http://localhost:53217', 'http://127.0.0.1:47321', 'http://127.0.0.1:0',
    'http://127.0.0.1:53217/path', 'http://127.0.0.1:53217?x=1',
    'http://127.0.0.1:53217/', 'http://user:secret@127.0.0.1:53217',
    'http://127.1:53217', 'https://127.0.0.1:53217', 'http://192.0.2.1:53217']) {
    assert.throws(() => observed.healthy({ ...healthy(), url }));
  }
});
test('BO05 void malformed and accessor status cannot become owner evidence', () => {
  for (const value of [undefined, null, [], {}, 'healthy']) assert.throws(() => observed.healthy(value));
  const value = healthy(); let reads = 0;
  Object.defineProperty(value, 'state', { get() { reads++; return 'healthy'; } });
  assert.throws(() => observed.healthy(value)); assert.equal(reads, 0);
});
test('BO06 unconfirmed or retained generation cannot be reported stopped', () => {
  for (const value of [
    { state: 'STOP_UNCONFIRMED', running: false, url: 'http://127.0.0.1:53217' },
    { state: 'stopped', running: true, url: 'http://127.0.0.1:0' },
    { state: 'stopped', running: false, url: 'http://127.0.0.1:53217' },
    { state: 'stopping', running: false, url: 'http://127.0.0.1:0' },
  ]) assert.throws(() => observed.stopped(value));
});
test('BO07 exact public stopped snapshot has no residual session or private fields', () => {
  const result = observed.stopped({ state: 'stopped', running: false, url: 'http://127.0.0.1:0', token: PRIVATE });
  assert.deepEqual(result, { state: 'stopped', running: false, loopback: true, port: 0 });
  assert(!JSON.stringify(result).includes(PRIVATE));
});
test('BO08 actual start and external custody must precede I12; stopped observation follows it', () => {
  const source = fs.readFileSync(path.join(__dirname, 'installed-observer-proposed-03.cjs'), 'utf8');
  const restart = source.slice(source.indexOf("} else if (b.phase === 'restart')"),
    source.indexOf("} else if (b.phase === 'upgrade-current' || b.phase === 'upgrade-restart')"));
  assert(restart.indexOf("check('I19'") < restart.indexOf("check('B01'"));
  assert(restart.indexOf("check('B01'") < restart.indexOf("check('I12'"));
  assert(restart.indexOf("check('I12'") < restart.indexOf("check('B02'"));
  assert(restart.includes('OWNED_BROKER_DESCENDANT_CUSTODY_VERIFIED'));
  assert(restart.includes('OWNED_BROKER_ABSENCE_VERIFIED'));
});
test('BO09 synthetic settings bind a safe configured port while owner uses its actual IPC port', () => {
  const source = fs.readFileSync(path.join(__dirname, 'installed-launch-contract-proposed-03.cjs'), 'utf8');
  assert(source.includes('b.configuredBrokerPort !== 47321'));
  assert(source.includes("'soterai.broker.port': b.configuredBrokerPort"));
  const observer = fs.readFileSync(path.join(__dirname, 'installed-observer-proposed-03.cjs'), 'utf8');
  assert(observer.includes('SOTERAI_BROKER_PORT') === false, 'Observer must not override private child environment');
  assert(observer.includes('PINNED_OWNER_PRIVATE_IPC_USES_OS_ASSIGNED_PORT_ZERO_NOT_LEGACY_CONFIGURED_PORT'));
});
test('BO10 fixture cannot repair a failed aggregate by separately stopping or restarting broker', () => {
  const source = fs.readFileSync(path.join(__dirname, 'installed-observer-proposed-03.cjs'), 'utf8');
  assert(!source.includes("native('soterai.stopLocalAIBroker'"));
  assert(!source.includes("native('soterai.restartLocalAIBroker'"));
  assert(source.includes("brokerObservation.stopped(await native('soterai.showBrokerStatus'))"));
});
