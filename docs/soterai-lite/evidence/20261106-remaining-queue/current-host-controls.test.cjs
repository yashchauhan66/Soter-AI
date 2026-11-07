'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../20261103-f32-lifecycle-2e95d6a4');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8').replace(/^\uFEFF/, ''));
const text = name => fs.readFileSync(path.join(root, name), 'utf8');
const oldGui = require(path.join(root, 'native-owned-gui-phase-proposed-06.cjs'));
const gui = require(path.join(root, 'native-owned-gui-phase-proposed-07.cjs'));
const launch = require(path.join(root, 'installed-launch-contract-proposed-04.cjs'));
const vendor = read('public-vendor-observation-04.json');
function options() {
  const b = read('retained-native-extra06-01/primary-observer-binding.json');
  const executable = structuredClone(vendor.currentHost.executable);
  return { executable: executable.path, args: launch.windowArgs(b, b.phase, Number(new URL(b.endpoint).port)), cwd: b.workspace,
    env: launch.environment(b, b.bindingFile), run: b.gate, name: b.phase + '-code', profile: b.profile, deadlineMs: 600000,
    guiAuthority: { feature: 'F32', status: 'EXPLICIT_EXTRA07_VISIBLE_OWNED_GUI_ONLY', extraAttempt: 'PROPOSAL08', binding: b, executable } };
}
test('Current installed Code is rejected by the retained stale host contract', () => {
  const o = options(); o.guiAuthority.status = 'EXPLICIT_EXTRA06_VISIBLE_OWNED_GUI_ONLY'; o.guiAuthority.extraAttempt = 'PROPOSAL07';
  assert.throws(() => oldGui.validateGuiContract(o));
});
test('Current exact Code is admitted by the successor, without launching a process', () => {
  assert.deepEqual(gui.validateGuiContract(options()), { windowsHide: false, guiVisibility: 'EXPLICIT_VISIBLE_OWNED_SYNTHETIC_CODE', codeSha256: vendor.currentHost.executable.sha256 });
});
for (const [name, mutate] of [
  ['stale executable hash', o => { o.guiAuthority.executable.sha256 = 'f1e1d79be5f50a238681738f813c4b353aad69f4b05f068899ec98a2d1b74c32'; }],
  ['normal user profile', o => { o.profile = 'C:\\Users\\USER\\AppData\\Roaming\\Code'; }],
  ['unreviewed environment', o => { o.env.EXTRA_PRIVATE_VALUE = 'SYNTHETIC_ONLY'; }],
  ['product development injection', o => { o.args.push('--extensionDevelopmentPath=C:\\unreviewed'); }],
  ['disabled workspace trust', o => { o.args.push('--disable-workspace-trust'); }],
  ['CLI executable use', o => { o.args = ['--list-extensions']; }],
]) test('Successor refuses ' + name, () => { const o = options(); mutate(o); assert.throws(() => gui.validateGuiContract(o)); });
test('Same native pipe and owned close implementation is retained', () => {
  const slice = name => text(name).slice(text(name).indexOf(' const streams={};'));
  assert.equal(slice('native-owned-gui-phase-proposed-07.cjs'), slice('native-owned-gui-phase-proposed-06.cjs'));
});
test('Original lifecycle acceptance assertions and eight phase sequence remain intact', () => {
  const take = name => { const source = text(name); return source.slice(source.indexOf('    const primary = binding'), source.indexOf('    stable();\n    // No new human/admin gate.')); };
  assert.equal(take('run-installed-lifecycle-proposed-07.cjs'), take('run-installed-lifecycle-proposed-06.cjs'));
  const source = text('run-installed-lifecycle-proposed-07.cjs');
  assert(source.includes('assert.equal(observations.size, 44'));
  assert(source.includes('sum + row.observerCount, 0), 59)'));
  assert(source.includes('assert.equal(portIndex, 8'));
});
