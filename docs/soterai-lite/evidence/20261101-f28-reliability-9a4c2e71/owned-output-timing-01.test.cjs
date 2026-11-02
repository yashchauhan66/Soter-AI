'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const fixture = fs.readFileSync(path.join(__dirname, 'owned-output-confirmed-01.host.ts'), 'utf8');
const original = fs.readFileSync(path.resolve('packages/vscode-extension/src/__tests__/host/liteLogVaultRuntime.host.ts'), 'utf8');
function block(begin, end) {
  const start = fixture.indexOf(begin), finish = fixture.indexOf(end);
  assert.ok(start >= 0 && finish > start);
  return fixture.slice(fixture.indexOf('\n', start) + 1, finish);
}
const waitText = block('// F28_OBSERVATION_WAIT_BEGIN:', '// F28_OBSERVATION_WAIT_END');
const confirmText = block('// F28_OBSERVATION_CONFIRM_BEGIN:', '// F28_OBSERVATION_CONFIRM_END');
function waitHelper() { return vm.runInNewContext(waitText + '\nwaitForObservation', {}); }
function confirmHelper(writeFile) {
  const js = ts.transpileModule(confirmText, {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  return vm.runInNewContext(js + '\nconfirmPendingObservation', {
    writeFile, join:path.join, folder:()=>({uri:{fsPath:'D:\\synthetic-test'}})
  });
}
const missing = () => Object.assign(new Error('Missing synthetic acknowledgement'), {code:'ENOENT'});
test('actual app helper waits through observer delay beyond the former 650ms window', async () => {
  let time = 0, reads = 0;
  const result = await waitHelper()(() => { reads++; if(time < 1600) throw missing(); return 'observed'; },
    async ms => { time += ms; }, () => time, 'phase-observed.txt');
  assert.equal(result, true); assert.equal(time, 1600); assert.ok(reads > 26);
});
test('actual app helper missing acknowledgement is finite at the existing 5s handshake bound', async () => {
  let time = 0;
  const result = await waitHelper()(() => { throw missing(); }, async ms => { time += ms; }, () => time, 'phase-observed.txt');
  assert.equal(result, false); assert.equal(time, 5000);
});
test('actual app helper refuses malformed acknowledgement and expires without accepting it', async () => {
  let time = 0;
  assert.equal(await waitHelper()(() => 'wrong', async ms => {time += ms;}, () => time, 'phase-observed.txt'), false);
  assert.equal(time, 5000);
});
test('actual app helper does not mask non-absence filesystem errors', async () => {
  let sleeps = 0; const denied = Object.assign(new Error('synthetic read denied'), {code:'EACCES'});
  await assert.rejects(waitHelper()(() => {throw denied;}, async()=>{sleeps++;}, ()=>0, 'phase-observed.txt'), error=>error===denied);
  assert.equal(sleeps, 0);
});
test('actual host helper waits for asynchronous pre-completion assertions before exclusive acknowledgement', async () => {
  const calls = []; let release;
  const pending = new Promise(resolve => {release = resolve;});
  const confirm = confirmHelper(async (...args)=>{calls.push(args);});
  const result = confirm('debug-raw', async()=>{await pending; calls.push('asserted');});
  await Promise.resolve(); assert.deepEqual(calls, []);
  release(); await result;
  assert.equal(calls[0], 'asserted'); assert.equal(calls.length, 2);
  assert.equal(calls[1][0], 'D:\\synthetic-test\\.synthetic-f25-debug-raw-observed.txt');
  assert.equal(calls[1][1], 'observed'); assert.equal(calls[1][2].flag, 'wx');
});
test('actual host helper never acknowledges a failed pending-output assertion', async () => {
  let writes = 0; const failure = new Error('synthetic premature delivery');
  await assert.rejects(confirmHelper(async()=>{writes++;})('control', ()=>{throw failure;}), error=>error===failure);
  assert.equal(writes, 0);
});
test('actual host helper propagates failed acknowledgement writes rather than claiming observation', async () => {
  const failure = Object.assign(new Error('synthetic existing acknowledgement'), {code:'EEXIST'});
  await assert.rejects(confirmHelper(async()=>{throw failure;})('task-raw', ()=>{}), error=>error===failure);
});
test('all original assertions and 19 scope descriptions remain; original lifecycle deadlines remain', () => {
  const assertions = value => [...value.matchAll(/assert\.\w+\([\s\S]*?;/g)].map(match=>match[0].replace(/\s+/g,' '));
  assert.deepEqual(assertions(fixture), assertions(original));
  const scopes = value=>value.slice(value.indexOf('    const scopes = ['), value.indexOf('    const observations:', value.indexOf('    const scopes = [')));
  assert.equal(scopes(fixture), scopes(original));
  for(const unchanged of ['ms = 10000', 'phase.endsWith("withdrawal") ? 2600 : 650', '"Synthetic owned lifecycle cleanup incomplete.", 6000'])
    assert.ok(fixture.includes(unchanged));
  assert.ok(fixture.includes('throw new Error("Synthetic observation deadline.")'));
  assert.ok(fixture.includes('if (!phase.endsWith("withdrawal") && !await waitForObservation'));
  assert.equal(fs.readFileSync(path.join(__dirname, 'owned-output-confirmed-01.host.ts.txt'), 'utf8'), fixture);
});
