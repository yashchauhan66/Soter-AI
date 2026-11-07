'use strict';
// Successor of qualify-vendor-installed-size-03.cjs for VS Code 1.145.2 (c4453f8ea4).
// Runs the pinned local CLI only (windowsHide true, ELECTRON_RUN_AS_NODE, both pipes owned by the
// existing owned-phase helper, no signals) to install each exact local VSIX into a fresh synthetic D: root,
// then admits the REAL installed package.json with the same exact-serialization function the lifecycle runner
// uses. No GUI window, no product code executed, no normal profile, no network, no extension dependency.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const own = n => path.join(__dirname, n), sha = b => crypto.createHash('sha256').update(b).digest('hex');
const fact = f => { const b = fs.readFileSync(f); return { path: path.resolve(f), bytes: b.length, sha256: sha(b) }; };
const read = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
const { phase } = require('../20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs');
const runner = require('./run-installed-lifecycle-proposed-05.cjs');
const launch = require('./installed-launch-contract-proposed-04.cjs');
const { admitInstalledManifest } = require('./installed-manifest-admission-proposed-02.cjs');
const BASE = 'D:\\SoterAI-Lite-test-profiles';
const PRODUCT = 'soterai.soterai-ide-guard';

function verifyFact(row) {
  const stat = fs.lstatSync(row.path); assert(stat.isFile() && !stat.isSymbolicLink() && stat.size === row.bytes);
  const fd = fs.openSync(row.path, 'r'), chunk = Buffer.alloc(65536), digest = crypto.createHash('sha256'); let total = 0;
  try { for (;;) { const n = fs.readSync(fd, chunk, 0, chunk.length, null); if (!n) break; total += n; digest.update(chunk.subarray(0, n)); } }
  finally { fs.closeSync(fd); }
  assert.equal(total, row.bytes); assert.equal(digest.digest('hex'), row.sha256, row.path);
}
function mkdir(dir) { assert(dir.toLowerCase().startsWith(BASE.toLowerCase() + '\\')); fs.mkdirSync(dir, { recursive: true }); }
function environment(profile) {
  return { SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows', COMSPEC: 'C:\\Windows\\System32\\cmd.exe',
    USERPROFILE: profile, HOME: path.join(profile, 'Home'), APPDATA: path.join(profile, 'AppData', 'Roaming'),
    LOCALAPPDATA: path.join(profile, 'AppData', 'Local'), XDG_CONFIG_HOME: path.join(profile, 'XdgConfig'),
    XDG_DATA_HOME: path.join(profile, 'XdgData'), TEMP: path.join(profile, 'Temp'), TMP: path.join(profile, 'Temp'),
    PATH: 'C:\\Windows\\System32;C:\\Program Files\\nodejs', DO_NOT_TRACK: '1', ELECTRON_RUN_AS_NODE: '1' };
}
async function xmlOf(vsix) {
  const payload = runner.inspectVsix(vsix, vsix.expectedVersion, vsix.runtimeCount);
  return payload;
}
(async () => {
  const vendor = read(own('public-vendor-observation-05.json'));
  assert.equal(vendor.currentHost.version, '1.145.2'); assert.equal(vendor.twoStableObservations, true);
  for (const row of [vendor.currentHost.executable, vendor.currentHost.codeCli, vendor.currentHost.cliProcessMain]) verifyFact(row);
  assert.equal(process.argv.length,4);assert.equal(process.argv[2],'--run');
  assert.equal(process.argv[3],fact(own('public-vendor-observation-05.json')).sha256,'Exact new vendor receipt required');
  const signature=read(own('current-signature-observation-05.json'));
  assert.equal(signature.vendorReceiptSha256,process.argv[3]);assert.equal(signature.rows.length,3);
  for(const row of signature.rows){assert.equal(row.status,'Valid');assert.equal(fact(row.path).sha256,row.sha256);}
  const prior=read(own('installed-extra09-admission.json'));
  const config=read(path.join(__dirname,'../20261106-remaining-queue/candidate-01/f32-candidate-config.json'));
  const currentVsix=config.currentVsix,oldVsix=prior.oldVsix;
  assert.equal(currentVsix.sha256,'011f96d19d42dbefc2e56eb5399bf5c7f16a09d6b71b8bae5be9d66b2f3769ec');
  assert.equal(oldVsix.sha256,'dcbcd9738cb480616cf4d3aa66d1a1ac2287e1754aa7307dea7ac23fee7c3677');
  verifyFact(currentVsix);verifyFact(oldVsix);
  fs.writeFileSync(own('vendor-installed-size-consumption-05.json'),JSON.stringify({status:'ONE_EXPLICIT_CURRENT_HOST_CLI_QUALIFICATION_CONSUMED',observedAt:new Date().toISOString(),vendorReceiptSha256:process.argv[3],currentVsix,oldVsix},null,2)+'\n',{flag:'wx'});
  const current = runner.inspectVsix(currentVsix, '0.7.0', 4), old = runner.inspectVsix(oldVsix, '0.6.3', 3);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const root = BASE + '\\f32-cliqual-' + stamp + '-' + crypto.randomBytes(4).toString('hex');
  assert(!fs.existsSync(root)); mkdir(root);
  const results = {};
  for (const [name, vsixRow, payload, version] of [['current', currentVsix, current, '0.7.0'], ['old', oldVsix, old, '0.6.3']]) {
    const profile = path.join(root, 'profile-' + name), extensions = path.join(root, 'extensions-' + name),
      run = path.join(root, 'run-' + name), assets = path.join(root, 'assets-' + name), workspace = path.join(root, 'workspace-' + name);
    for (const d of [profile, extensions, run, assets, workspace, ...['Home', 'AppData/Roaming', 'AppData/Local', 'XdgConfig', 'XdgData', 'Temp', 'User'].map(x => path.join(profile, x))]) mkdir(d);
    fs.writeFileSync(path.join(profile, 'User', 'settings.json'), JSON.stringify({ ...launch.SAFE_SETTINGS, 'soterai.broker.port': 64190 }, null, 2) + '\n', { flag: 'wx' });
    const vsixCopy = path.join(assets, name + '-exact.vsix'); fs.copyFileSync(vsixRow.path, vsixCopy, fs.constants.COPYFILE_EXCL);
    assert.equal(sha(fs.readFileSync(vsixCopy)), vsixRow.sha256);
    const originalFile = path.join(assets, name + '-original-package.json'); fs.writeFileSync(originalFile, payload.manifestRaw, { flag: 'wx' });
    const args = [vendor.currentHost.codeCli.path, '--user-data-dir=' + profile, '--extensions-dir=' + extensions, '--install-extension', vsixCopy, '--do-not-sync', '--force'];
    const started = Date.now();
    const out = await phase({ executable: vendor.currentHost.executable.path, args, cwd: workspace, env: environment(profile), run, name: 'cli-install-' + name, profile, deadlineMs: 180000 });
    const completed = Date.now();
    assert.equal(out.closed.code, 0, 'CLI install exit code'); assert(out.close.stdoutEOF && out.close.stderrEOF && !out.close.overflow && !out.close.streamError && !out.close.deadlineExceeded);
    const dirs = fs.readdirSync(extensions, { withFileTypes: true }).filter(e => e.isDirectory());
    const hits = [];
    for (const d of dirs) {
      const pj = path.join(extensions, d.name, 'package.json'); if (!fs.existsSync(pj)) continue;
      const m = JSON.parse(fs.readFileSync(pj, 'utf8'));
      if (m.publisher + '.' + m.name === PRODUCT && m.version === version) hits.push(path.join(extensions, d.name));
    }
    assert.equal(hits.length, 1, 'exactly one installed product directory');
    const installedXml = fact(path.join(hits[0], '.vsixmanifest'));
    assert.equal(installedXml.sha256, payload.archiveXml.sha256); assert.equal(installedXml.bytes, payload.archiveXml.bytes);
    const admitted = admitInstalledManifest({ original: fact(originalFile), installedPath: path.join(hits[0], 'package.json'),
      installStartedWallMs: started, installCompletedWallMs: completed, targetPlatform: 'undefined', payloadUncompressedBytes: payload.vendorInstalledSize });
    assert.equal(admitted.size, payload.vendorInstalledSize);
    const inventory = await phase({ executable: vendor.currentHost.executable.path,
      args: [vendor.currentHost.codeCli.path, '--user-data-dir=' + profile, '--extensions-dir=' + extensions, '--list-extensions', '--show-versions'],
      cwd: workspace, env: environment(profile), run, name: 'cli-list-' + name, profile, deadlineMs: 180000 });
    assert.equal(inventory.closed.code, 0);
    results[name] = { vsix: vsixRow, payloadUncompressedBytes: payload.payloadUncompressedBytes, archiveXml: payload.archiveXml,
      vendorInstalledSize: payload.vendorInstalledSize, installedDirectory: hits[0], installedManifest: fact(path.join(hits[0], 'package.json')),
      installedVsixManifest: installedXml, admission: admitted, installClose: fact(path.join(run, 'cli-install-' + name + '-owned-close.json')),
      listClose: fact(path.join(run, 'cli-list-' + name + '-owned-close.json')), listedExtensions: fs.readFileSync(path.join(run, 'cli-list-' + name + '-stdout.bin'), 'utf8').split(/\r?\n/).filter(Boolean) };
    assert.deepEqual(results[name].listedExtensions, [PRODUCT + '@' + version]);
  }
  for(const row of [vendor.currentHost.executable,vendor.currentHost.codeCli,vendor.currentHost.cliProcessMain])verifyFact(row);
  const source = fs.readFileSync(vendor.currentHost.cliProcessMain.path, 'utf8');
  assert.equal(sha(Buffer.from(source)), vendor.currentHost.cliProcessMain.sha256);
  const witnessRe = re => { const m = re.exec(source); assert(m, String(re)); return { pattern: String(re), utf16Offset: m.index, snippet: source.slice(Math.max(0, m.index - 120), m.index + 420) }; };
  const witnessAt = needle => { const i = source.indexOf(needle); assert(i >= 0, needle); return { needle, utf16Offset: i, snippet: source.slice(Math.max(0, i - 120), i + 420) }; };
  const result = { feature: 'F32', status: 'PASS_CURRENT_VENDOR_INSTALLED_SIZE_INCLUDES_EXACT_VSIXMANIFEST', observedAt: new Date().toISOString(),
    vendorVersion: vendor.currentHost.version, vendorCommit: vendor.currentHost.commit,
    vendorReceiptSha256: fact(own('public-vendor-observation-05.json')).sha256, currentVsixSha256: currentVsix.sha256, oldVsixSha256: oldVsix.sha256,
    method: 'REAL_PINNED_CLI_INSTALL_OF_EACH_EXACT_LOCAL_VSIX_INTO_FRESH_SYNTHETIC_ROOT_THEN_EXACT_SERIALIZATION_ADMISSION',
    syntheticRoot: root, current: results.current, old: results.old,
    vendorSource: vendor.currentHost.cliProcessMain,
    witnesses: [witnessRe(/async function \w+\(i,t\)\{let e;try\{e=await t\.resolve\(i\)\}catch\(n\)\{if\(n\.fileOperationResult===1\)return 0;throw n\}/), witnessAt('async updateManifestMetadata('), witnessAt('targetPlatform:e.targetPlatform}')],
    nativeLaunches: 0, cliInstalls: 2, guiWindows: 0, signalsRequested: 0,
    scope: 'Pinned CLI behavior for these two exact VSIX files on this machine only. No product code executed, no GUI window, no network.' };
  fs.writeFileSync(own('vendor-installed-size-qualification-05.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: result.status, current: { size: results.current.vendorInstalledSize, admission: results.current.admission },
    old: { size: results.old.vendorInstalledSize, admission: results.old.admission }, receipt: fact(own('vendor-installed-size-qualification-05.json')) }));
})().catch(e => { console.error(e); process.exitCode = 1; });
