'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { createRequire } = require('node:module');
const driver = path.join(__dirname, 'run-scripted-benchmarks-proposed-02.cjs'), bytes = fs.readFileSync(driver);
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), 'e5cbb68bd3551985e8d000f5684175b01b4d56e6793b95936ecc09cd2b99b886');
const projected = { exports: {} };
new vm.Script('(function(require,module,exports,__dirname,__filename){\n' + bytes.toString('utf8') +
  '\nmodule.exports={sourceComponents,contextAttempt,output,safe,SECRET};\n})', { filename: driver })
  .runInThisContext()(createRequire(driver), projected, projected.exports, __dirname, driver);
const api = projected.exports, proof = JSON.parse(fs.readFileSync(path.join(__dirname, '../20261103-f32-lifecycle-2e95d6a4/full-inputs-04.json')));
const component = api.sourceComponents(proof), controls = [];
function check(id, action) { action(); controls.push({ id, pass: true }); }
const publicText = 'Public task complete; two public records returned.\n';
const mixed = publicText + 'Fixture debug ' + api.SECRET + '\n';
check('BC01-public-only-on-retains-every-byte', () => { const value = api.output(component, true, publicText); assert.equal(value.status, 'COMPLETE'); assert.equal(value.stdout, publicText); assert.equal(value.redacted, false); });
check('BC02-public-only-off-retains-every-byte', () => { assert.equal(api.output(component, false, publicText).stdout, publicText); });
check('BC03-on-mixed-channel-is-exact-whole-channel-marker', () => { const value = api.output(component, true, mixed); assert.equal(value.status, 'COMPLETE'); assert.equal(value.stdout, '[REDACTED_SECRET_OUTPUT]'); assert.equal(value.redacted, true); });
check('BC04-on-secret-absent-across-registered-representations', () => { assert(api.safe(api.output(component, true, mixed))); });
check('BC05-off-deliberate-secret-and-useful-prefix-observed', () => { const value = api.output(component, false, mixed); assert.equal(api.safe(value), false); assert(value.stdout.includes(publicText)); });
check('BC06-old-partial-prefix-expectation-reproduced-false', () => { assert.equal(api.output(component, true, mixed).stdout.includes(publicText), false); });
check('BC07-real-context-component-withholds-secret', () => { const value = api.contextAttempt(component, true, [publicText, 'Synthetic private fixture: ' + api.SECRET]); assert.equal(value.forwarded, false); assert.equal(value.decision, 'MATCHED'); });
check('BC08-real-context-component-preserves-public-fallback', () => { const value = api.contextAttempt(component, true, [publicText, 'Use fixture placeholder.']); assert.equal(value.forwarded, true); assert.equal(value.decision, 'CLEAN'); });
const record = { status: 'EIGHT_ACTUAL_PURE_COMPONENT_FIXTURE_CONTROLS_PASS_NOT_FULL_BENCHMARK',
  driver: { path: driver, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }, controls,
  oldWrongExpectationReproduced: true, actualModels: 0, nativeOrServerOrNetworkCalls: 0, rawPrivateValuesRetained: false };
const output = path.join(__dirname, 'redactor-fixture-controls-result-02.json'); fs.writeFileSync(output, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: record.status, controls: controls.length, resultSha256: crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex') }));
