'use strict';
// Pure diagnostic projection of actual frozen fixture functions. Not a rerun of
// project/model/native cases. Never prints private text, raw results or errors.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const { createRequire } = require('node:module');
const driver = path.join(__dirname, 'run-scripted-benchmarks-proposed-01.cjs');
const bytes = fs.readFileSync(driver);
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), '7a58609651689921005d2ad30dcaa3f6a7b7dee24a924be3b5bdd68a13d5f107');
const wrapper = new vm.Script('(function(require,module,exports,__dirname,__filename){\n' + bytes.toString('utf8') +
  '\nmodule.exports={sourceComponents,contextAttempt,output,safe,SECRET};\n})', { filename: driver });
const projected = { exports: {} }; wrapper.runInThisContext()(createRequire(driver), projected, projected.exports, __dirname, driver);
const api = projected.exports;
const proof = JSON.parse(fs.readFileSync(path.join(__dirname, '../20261103-f32-lifecycle-2e95d6a4/full-inputs-04.json')));
const component = api.sourceComponents(proof);
const first = api.contextAttempt(component, true, ['Implement the public route using the fake service. Return only public data.', 'Synthetic private fixture: ' + api.SECRET]);
const fallback = api.contextAttempt(component, true, ['Implement the public route using the fake service. Return only public data.', 'Use fixture credential placeholder; actual value is unnecessary for this coding task.']);
const observed = api.output(component, true, 'Public task complete; two public records returned.\nFixture debug ' + api.SECRET + '\n');
const record = { status: 'PURE_BOUNDARY_DIAGNOSTICS_NOT_BENCHMARK_COMPLETION',
  first: { forwarded: first.forwarded, decision: first.decision }, fallback: { forwarded: fallback.forwarded, decision: fallback.decision },
  output: { status: observed.status, redacted: observed.redacted, usefulPrefix: observed.stdout.includes('Public task complete; two public records returned.'),
    registeredFormsAbsent: api.safe(observed), markerPresent: observed.stdout.includes('[REDACTED_SECRET_OUTPUT]') },
  rawPrivateValuesPrinted: false, nativeOrModelCalls: 0 };
const output = path.join(__dirname, 'component-boundary-diagnostics-01.json');
fs.writeFileSync(output, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(record));
