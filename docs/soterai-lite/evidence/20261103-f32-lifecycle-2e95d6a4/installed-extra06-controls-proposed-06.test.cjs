'use strict';
// Pure controls for the single extra06 attempt. Nothing here launches Code, a CLI, a listener or a process.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const gui = require('./native-owned-gui-phase-proposed-06.cjs');
const runner = require('./run-installed-lifecycle-proposed-06.cjs');
const launch3 = require('./installed-launch-contract-proposed-03.cjs');
const launch4 = require('./installed-launch-contract-proposed-04.cjs');
const prep = require('./prepare-installed-extra06-admission-proposed-01.cjs');
const renderer5 = require('./installed-renderer-proposed-05.cjs');
const own = n => path.join(__dirname, n), sha = b => crypto.createHash('sha256').update(b).digest('hex');
const text = n => fs.readFileSync(own(n), 'latin1');
const read = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
const earlier = read(own('installed-admission-03.json'));
const vendor = read(own('public-vendor-observation-03.json'));
const NEW_CODE_SHA = 'f1e1d79be5f50a238681738f813c4b353aad69f4b05f068899ec98a2d1b74c32', OLD_CODE_SHA = 'af032b86db394d21ba86872f4237a11b8395d2f57e8187963a3718a2cc6666ad';
const PORTS = [62101, 62102, 62103, 62104, 62105, 62106, 62107, 62108];
const ROOT = 'D:\\SoterAI-Lite-test-profiles\\f32-installed-20990101T000000Z-e6e6e6e6';
const admission = () => prep.makeAdmission({ runRoot: ROOT, debugPorts: PORTS, configuredBrokerPort: 62109, syntheticCanary: 'SOTERAI_F32_SYNTHETIC_COMPONENT_ONLY_06' });
function guiOptions() {
  const b = read(path.join(earlier.runRoot, 'profile-primary', 'F32Gate', 'primary', 'primary-observer-binding.json'));
  const executable = vendor.currentHost.executable;
  return { executable: executable.path, args: launch4.windowArgs(b, b.phase, Number(new URL(b.endpoint).port)), cwd: b.workspace,
    env: launch4.environment(b, b.bindingFile, false), run: b.gate, name: b.phase + '-code', profile: b.profile, deadlineMs: 600000,
    guiAuthority: { feature: 'F32', status: 'EXPLICIT_EXTRA06_VISIBLE_OWNED_GUI_ONLY', extraAttempt: 'PROPOSAL07', binding: b, executable } };
}

test('E01 launch contract 04 adds only window.dialogStyle custom to the reviewed contract 03', () => {
  const { 'window.dialogStyle': style, ...rest } = launch4.SAFE_SETTINGS;
  assert.equal(style, 'custom'); assert.deepEqual(rest, launch3.SAFE_SETTINGS); assert(!('window.dialogStyle' in launch3.SAFE_SETTINGS));
  for (const name of ['validate', 'environment', 'cliArgs', 'windowArgs', 'prepareUserSettings']) assert.equal(launch4[name].toString(), launch3[name].toString(), name);
  assert.equal(launch4.SAFE_SETTINGS['security.workspace.trust.enabled'], true); assert.equal(launch4.SAFE_SETTINGS['security.workspace.trust.startupPrompt'], 'always');
});
test('E02 renderer 05 keeps the frozen dialog allow-list and adds only typed non-secret modal diagnostics', () => {
  const r4 = text('installed-renderer-proposed-04.cjs'), r5 = text('installed-renderer-proposed-05.cjs');
  // 04 keeps the dictionary inside nativeModal as `allowed`; 05 hoists the same literal as ALLOWED_MODALS.
  const block = (s, marker) => { const lines = s.split(/\r?\n/), i = lines.findIndex(l => l.includes(marker)); assert(i >= 0, marker);
    const j = lines.findIndex((l, k) => k > i && l.trim() === '};'); assert(j > i); return lines.slice(i + 1, j).map(l => l.trim()).join('\n'); };
  assert.equal(block(r5, 'const ALLOWED_MODALS = {'), block(r4, 'const allowed = {')); assert(block(r5, 'const ALLOWED_MODALS = {').length > 200);
  for (const forbidden of ['.click(', '.fill(', '.check(', '.dispatchEvent(', 'page.route', 'setContent(', 'addInitScript', 'exposeFunction', 'keyboard.insertText']) {
    assert(!r5.includes(forbidden), forbidden);
  }
  assert.equal(r5.split('page.evaluate(').length - 1, r4.split('page.evaluate(').length - 1 + 1);
  const snapshot = r5.slice(r5.indexOf('async function snapshotModal'), r5.indexOf('async function modalWait'));
  const ret = snapshot.slice(snapshot.indexOf('return {'));
  assert.deepEqual([...ret.matchAll(/^\s+(\w+):/gm)].map(m => m[1]), ['documentFocused', 'visibleDialogCount', 'expectedIndex', 'expectedTextPresent', 'matchedAllowedIndex', 'quickInputVisible']);
  assert(!/texts[\s,}]/.test(ret.replace(/raw\.texts/g, '')), 'dialog text must not be returned');
  const error = new Error('PRIVATE_TEST_ONLY'); error.stack = 'Error PRIVATE_TEST_ONLY\n at f (D:\\private-profile\\renderer.cjs:123:8)';
  const d = renderer5.safeRendererDiagnostic(error);
  assert.deepEqual(d, { stage: 'PRELUDE', sourceLine: 123, sourceColumn: 8 }); assert(!JSON.stringify(d).includes('private-profile') && !JSON.stringify(d).includes('PRIVATE_TEST_ONLY'));
});
test('E03 exact 1.145.0 GUI contract selects explicit visible Code only without launching', () => {
  assert.deepEqual(gui.validateGuiContract(guiOptions()), { windowsHide: false, guiVisibility: 'EXPLICIT_VISIBLE_OWNED_SYNTHETIC_CODE', codeSha256: NEW_CODE_SHA });
  assert.equal(vendor.currentHost.executable.sha256, NEW_CODE_SHA); assert.equal(vendor.currentHost.executable.bytes, 238751544);
});
test('E04 stale extra05 authority, the old 1.144.1 Code hash, Node and CLI arguments refuse GUI visibility', () => {
  const mutations = [o => { o.guiAuthority.status = 'EXPLICIT_EXTRA05_VISIBLE_OWNED_GUI_ONLY'; }, o => { o.guiAuthority.extraAttempt = 'PROPOSAL05'; },
    o => { o.guiAuthority.executable = { ...o.guiAuthority.executable, sha256: OLD_CODE_SHA, bytes: 238751552 }; },
    o => { o.guiAuthority.executable.sha256 = '0'.repeat(64); }, o => { o.executable = 'C:\\Program Files\\nodejs\\node.exe'; }, o => { o.args = ['--list-extensions']; },
    o => { o.profile = 'C:\\Users\\USER\\AppData\\Roaming\\Code'; }, o => { o.cwd = 'C:\\Users\\USER'; }, o => { o.env.EXTRA_PRIVATE_VALUE = 'DO_NOT_COPY'; },
    o => { o.deadlineMs = 600001; }, o => { o.args.push('--disable-workspace-trust'); }, o => { o.args.push('--extensionTestsPath=D:\\fixture'); },
    o => { o.args.push('--extensionDevelopmentPath=C:\\product'); }];
  for (const mutate of mutations) { const o = guiOptions(); mutate(o); assert.throws(() => gui.validateGuiContract(o)); }
});
test('E05 GUI helper 06 differs from reviewed helper 05 only by the five reviewed pins and keeps the original pipe logic', () => {
  const g5 = text('native-owned-gui-phase-proposed-05.cjs'), g6 = text('native-owned-gui-phase-proposed-06.cjs');
  const reversed = g6.split('installed-launch-contract-proposed-04.cjs').join('installed-launch-contract-proposed-03.cjs').split(NEW_CODE_SHA).join(OLD_CODE_SHA)
    .split('EXPLICIT_EXTRA06_VISIBLE_OWNED_GUI_ONLY').join('EXPLICIT_EXTRA05_VISIBLE_OWNED_GUI_ONLY').split("'PROPOSAL07'").join("'PROPOSAL05'").split('238751544').join('238751552');
  assert.equal(reversed, g5);
  const original = fs.readFileSync(path.join(__dirname, '../20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs'), 'utf8');
  assert.equal(sha(Buffer.from(original)), 'c3ca6d3b159ecbd825a0e917a40e5c24cb9aa3aeaa76d67a3fa0fc18113dea4f');
  const take = s => s.slice(s.indexOf(' const streams={};'), s.indexOf('\nmodule.exports='));
  const back = take(g6).replace('windowsHide:false', 'windowsHide:true').replace("status:'STARTED_NOT_COMPLETED',...guiObservation,observedAt:", "status:'STARTED_NOT_COMPLETED',observedAt:").replace('const close={...guiObservation,observedAt:', 'const close={observedAt:');
  assert.equal(back, take(original));
});
test('E06 custody 05 equals reviewed custody 04 except the exact vendor version literal', () => {
  const c4 = text('installed-owner-custody-proposed-04.ps1'), c5 = text('installed-owner-custody-proposed-05.ps1');
  assert.equal(c5.split("'1.145.0'").join("'1.144.1'"), c4); assert.equal(c5.split("'1.145.0'").length - 1, 2); assert(!c5.includes('1.144.1'));
});
test('E07 runner 06 differs from reviewed runner 05 only by the extra06 names, 1.145.0 vendor pins and the extra05 retention check', () => {
  const r5 = text('run-installed-lifecycle-proposed-05.cjs'); let r6 = text('run-installed-lifecycle-proposed-06.cjs');
  const start = r6.indexOf('function verifyPreviousExtra05(a){'), end = r6.indexOf('function reviewedAdmission(');
  assert(start > 0 && end > start); r6 = r6.slice(0, start) + r6.slice(end);
  const pairs = [["'installed-extra05-user-approval.json'", "'installed-extra06-user-approval.json'"], ['USER_APPROVED_ONE_BOUNDED_EXTRA05_VISIBLE_GUI_DIAGNOSTIC', 'USER_APPROVED_ONE_BOUNDED_EXTRA06_VISIBLE_GUI_DIAGNOSTIC'],
    ["'PROPOSAL05'", "'PROPOSAL07'"], ['TRUST-DIAGNOSTIC-PROPOSAL05.md', 'I06-ROOT-CAUSE-PROPOSAL07.md'], ["'installed-extra05-admission.json'", "'installed-extra06-admission.json'"],
    ['ROOT_REVIEWED_F32_INSTALLED_EXTRA05_FINAL_INPUTS', 'ROOT_REVIEWED_F32_INSTALLED_EXTRA06_FINAL_INPUTS'], ["'installed-launch-contract-proposed-03.cjs'", "'installed-launch-contract-proposed-04.cjs'"],
    ["renderer: 'installed-renderer-proposed-04.cjs'", "renderer: 'installed-renderer-proposed-05.cjs'"], ["custody: 'installed-owner-custody-proposed-04.ps1'", "custody: 'installed-owner-custody-proposed-05.ps1'"],
    ["guiHelper:'native-owned-gui-phase-proposed-05.cjs'", "guiHelper:'native-owned-gui-phase-proposed-06.cjs'"], ['installed-extra05-consumed.json', 'installed-extra06-consumed.json'],
    ['CONSUMED_ONE_EXPLICIT_EXTRA05_NO_RETRY', 'CONSUMED_ONE_EXPLICIT_EXTRA06_NO_RETRY'], ['EXPLICIT_EXTRA05_VISIBLE_OWNED_GUI_ONLY', 'EXPLICIT_EXTRA06_VISIBLE_OWNED_GUI_ONLY'],
    ["'installed-extra05-result.json'", "'installed-extra06-result.json'"], ["'installed-extra05-failure.json'", "'installed-extra06-failure.json'"], ["'1.144.1'", "'1.145.0'"],
    ["'261c84cb1eddf11235f9e2c921425e9663fbe556'", "'a717861c07586a53d83b80d742cd3f59b20a6273'"], ['261c84cb1e\\\\resources', 'a717861c07\\\\resources'],
    ['Recorded extra05 consumption forbids retry', 'Recorded extra06 consumption forbids retry'], ['consumed05', 'consumed06'],
    ['verifyPreviousRound(a); verifyPreviousRound02(a); verifyPreviousRound03(a);', 'verifyPreviousRound(a); verifyPreviousRound02(a); verifyPreviousRound03(a); verifyPreviousExtra05(a);'],
    ['verifyPreviousRound03, verifyPreviousRound, verifyPreviousRound02,', 'verifyPreviousRound03, verifyPreviousExtra05, verifyPreviousRound, verifyPreviousRound02,']];
  for (const [from, to] of pairs) r6 = r6.split(to).join(from);
  assert.equal(r6, r5);
});
test('E08 no 1.144.1 vendor pin survives in the extra06 runner, custody or GUI helper and 1.145.0 is pinned exactly', () => {
  for (const name of ['run-installed-lifecycle-proposed-06.cjs', 'installed-owner-custody-proposed-05.ps1', 'native-owned-gui-phase-proposed-06.cjs']) {
    const t = text(name); assert(!t.includes('1.144.1') && !t.includes('261c84cb1e') && !t.includes(OLD_CODE_SHA), name);
  }
  const t = text('run-installed-lifecycle-proposed-06.cjs');
  assert(t.includes("'1.145.0'") && t.includes('a717861c07586a53d83b80d742cd3f59b20a6273') && t.includes('a717861c07\\\\resources\\\\app'));
  assert.equal(vendor.currentHost.version, '1.145.0'); assert.equal(vendor.currentHost.appRoot, 'C:\\Users\\USER\\AppData\\Local\\Programs\\Microsoft VS Code\\a717861c07\\resources\\app');
});
test('E09 the consumed failed extra05 and all three normal rounds stay retained and forged evidence is refused', () => {
  const a = admission(); runner.verifyPreviousRound(a); runner.verifyPreviousRound02(a); runner.verifyPreviousRound03(a); runner.verifyPreviousExtra05(a);
  for (const mutate of [x => { x.previousExtra05.failure.sha256 = '0'.repeat(64); }, x => { x.previousExtra05.consumed.bytes += 1; }, x => { x.previousExtra05.rootResult.sha256 = '1'.repeat(64); },
    x => { x.previousExtra05.admission.sha256 = '2'.repeat(64); }, x => { delete x.previousExtra05; }, x => { x.previousExtra05.failure.path = x.previousExtra05.checkpoint.path; }]) {
    const b = admission(); mutate(b); assert.throws(() => runner.verifyPreviousExtra05(b));
  }
  const reuse = admission(); reuse.runRoot = read(own('installed-extra05-consumed.json')).runRoot; assert.throws(() => runner.verifyPreviousExtra05(reuse), /cannot reuse/);
  const b3 = admission(); b3.previousRound03.rendererClose.sha256 = '0'.repeat(64); assert.throws(() => runner.verifyPreviousRound03(b3));
});
test('E10 no approval file means no run authority and strict root/port admission refuses reuse', () => {
  assert.throws(() => runner.verifyExtraApproval(admission()), /Explicit single-extra approval/);
  const args = { runRoot: read(own('installed-extra05-consumed.json')).runRoot, debugPorts: PORTS, configuredBrokerPort: 62109, syntheticCanary: 'SOTERAI_F32_SYNTHETIC_COMPONENT_ONLY_06' };
  assert.throws(() => prep.makeAdmission(args));
  args.runRoot = ROOT; args.debugPorts = [...PORTS]; args.debugPorts[1] = args.debugPorts[0]; assert.throws(() => prep.makeAdmission(args));
  args.debugPorts = read(own('installed-extra05-admission.json')).debugPorts; assert.throws(() => prep.makeAdmission(args));
  args.debugPorts = PORTS; args.configuredBrokerPort = PORTS[0]; assert.throws(() => prep.makeAdmission(args));
});
test('E11 assertion inventory, window count and observation totals are unchanged from the reviewed runner', () => {
  const s = text('run-installed-lifecycle-proposed-06.cjs');
  assert(s.includes('assert.equal(portIndex, 8') && s.includes('assert.equal(observations.size, 44') && s.includes('sum + row.observerCount, 0), 59)'));
  const checks = file => [...fs.readFileSync(own(file), 'utf8').matchAll(/(?:await )?check\('([A-Z][0-9]{2})', '([^']+)'/g)].map(m => m.slice(1));
  assert.deepEqual(checks('installed-observer-proposed-05.cjs'), checks('installed-observer-proposed-04.cjs')); assert(checks('installed-observer-proposed-05.cjs').length > 0);
});
test('E12 every 1.145.0 evidence file is bound to the exact current vendor receipt', () => {
  const receipt = sha(fs.readFileSync(own('public-vendor-observation-03.json')));
  assert.equal(read(own('current-vendor-review-02.json')).vendorReceiptSha256, receipt); assert.equal(read(own('current-package-qualification-02.json')).currentVendorReceiptSha256, receipt);
  assert.equal(read(own('vendor-installed-size-qualification-03.json')).vendorReceiptSha256, receipt); assert.equal(read(own('current-signature-observation-03.json')).vendorReceiptSha256, receipt);
  const review = read(own('current-vendor-review-02.json'));
  for (const k of ['currentCodeSigner', 'localCliNoDownload', 'exactInstallerMetadataSerialization', 'playwrightAttachDisconnectOnly', 'completePlaywrightGraph']) assert.equal(review.checks[k], 'PASS_STATIC_REVIEW');
  assert.equal(review.dialogStyleWitness.default, 'native'); assert.equal(review.vendorDelta.changedRows, 10);
  const size = read(own('vendor-installed-size-qualification-03.json')); assert.equal(size.current.vendorInstalledSize, 3668082); assert.equal(size.old.vendorInstalledSize, 5466512);
});
