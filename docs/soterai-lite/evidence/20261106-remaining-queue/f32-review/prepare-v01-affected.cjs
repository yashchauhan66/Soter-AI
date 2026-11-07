'use strict';
// Prepares fresh inputs only. Never launches Code or imports the packaged extension.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict'), vm = require('node:vm');
const repo = path.resolve(__dirname, '../../../../..');
const prior = path.join(repo, 'docs/soterai-lite/evidence/20261102-f31b-final-package-7be1c304');
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
function fact(file) { const raw = fs.readFileSync(file); return { path: path.relative(repo, file).replaceAll('\\', '/'), bytes: raw.length, sha256: sha(raw) }; }
function pin(row) { const file = path.resolve(repo, row.path), stat = fs.lstatSync(file), raw = fs.readFileSync(file); assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1); assert.equal(raw.length, row.bytes, row.path); assert.equal(sha(raw), row.sha256, row.path); return file; }
const normalize = row => fact(pin(row));
async function prepare(config) {
 const sourceProof = normalize(config.sourceProof), fullAcceptance = normalize(config.fullAcceptance), qualification = normalize(config.finalQualification), vsix = normalize(config.currentVsix);
 const proof = read(pin(sourceProof)), full = read(pin(fullAcceptance)), qualified = read(pin(qualification));
 assert.match(config.sourceParent, /^[a-f0-9]{40}$/); assert.equal(proof.sourceParent, config.sourceParent); proof.files.forEach(pin);
 assert.equal(full.sourceProofSha256, sourceProof.sha256); assert.equal(full.counts.fail, 0); assert.equal(full.counts.cancelled, 0);
 assert.equal(qualified.status, 'FINAL_SOURCE_FULL_COMPILER_VSIX_CONTENT_BACKEND_REVIEWED_NATIVE_PENDING');
 assert.equal(qualified.sourceProofSha256, sourceProof.sha256); assert.equal(qualified.fullAcceptanceSha256, fullAcceptance.sha256); assert.equal(qualified.vsix.sha256, vsix.sha256);
 const inspection = normalize(qualified.inspection), inventory = read(pin(inspection)); assert.equal(inventory.entries.length, 18); assert.equal(inventory.runtimes.length, 4);
 const hostReview = normalize(config.vendorObservation || fact(path.join(repo, 'docs/soterai-lite/evidence/20261103-f32-lifecycle-2e95d6a4/public-vendor-observation-04.json')));
 const vendor = read(pin(hostReview)); assert(vendor.currentHost.version); pin(vendor.currentHost.executable);
 const out = path.resolve(repo, config.affectedOutput || 'docs/soterai-lite/evidence/20261106-v01-current-01');
 assert.equal(path.dirname(out), path.join(repo, 'docs/soterai-lite/evidence')); assert(!fs.existsSync(out), 'Fresh sibling evidence directory required');
 fs.mkdirSync(out);
 const own = name => path.join(out, name), put = (name, value) => fs.writeFileSync(own(name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
 const yauzl = require('yauzl'), zip = await yauzl.fromBufferPromise(fs.readFileSync(pin(vsix)), { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }), seen = new Set();
 try { for await (const entry of zip.eachEntry()) {
  const expected = inventory.entries.find(row => row.path === entry.fileName); assert(expected, entry.fileName); assert(!seen.has(entry.fileName.toLowerCase())); seen.add(entry.fileName.toLowerCase());
  assert.equal(entry.uncompressedSize, expected.bytes); assert(expected.bytes <= 8 * 1024 * 1024); assert(!entry.fileName.split('/').some(x => !x || x === '.' || x === '..')); assert(!/[\\:\x00-\x1f]/.test(entry.fileName));
  const chunks = []; let size = 0; const stream = await zip.openReadStreamPromise(entry);
  for await (const chunk of stream) { size += chunk.length; assert(size <= expected.bytes); chunks.push(chunk); }
  const raw = Buffer.concat(chunks); assert.equal(raw.length, expected.bytes); assert.equal(sha(raw), expected.sha256);
  const destination = own('vsix-extracted-01/' + entry.fileName); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, raw, { flag: 'wx' });
 }} finally { zip.close(); }
 assert.equal(seen.size, inventory.entries.length);
 const entryPoints = {
  'lite-ps51-host': 'packages/vscode-extension/src/__tests__/host/litePowerShell51.host.ts',
  'lite-editor-host': 'packages/vscode-extension/src/__tests__/host/liteEditorScanner.host.ts',
  'lite-mcp-host': 'packages/vscode-extension/src/__tests__/host/liteMcpScanner.host.ts',
  'lite-broker-host': 'packages/vscode-extension/src/__tests__/host/liteSafeReadMcp.host.ts',
  'affected-preparation-functional10-driver-01': 'packages/vscode-extension/src/__tests__/host/index.ts',
  'affected-preparation-security17-driver-01': 'packages/vscode-extension/src/__tests__/host/securityReview.host.ts'
 };
 const { parserBundleOptions } = require(path.join(repo, 'packages/vscode-extension/scripts/parserBundleOptions.cjs'));
 const buildOptions = { ...parserBundleOptions(repo), absWorkingDir: repo, entryPoints, outdir: own('drivers'), metafile: true, bundle: true, platform: 'node', format: 'cjs', external: ['vscode'], target: 'node18', tsconfig: path.join(repo, 'packages/vscode-extension/tsconfig.json'), loader: { '.txt': 'ts' }, sourcemap: false, logLevel: 'warning' };
 const built = await require('esbuild').build(buildOptions);
 const proofMap = new Map(proof.files.map(row => [row.path, row]));
 const sourceInputs = Object.keys(built.metafile.inputs).sort().map(name => { const row = fact(path.resolve(repo, name)); assert(!/phase2\/|vscode-stub/.test(row.path)); const expected = proofMap.get(row.path); if (expected) assert.deepEqual(row, expected); return { ...row, inProductProof: Boolean(expected) }; });
 for (const source of Object.values(entryPoints)) assert(proofMap.has(source), 'Host source absent from frozen proof: ' + source);
 const drivers = Object.keys(entryPoints).map(name => fact(own('drivers/' + name + '.js')));
 for (const name of ['affected-preparation-functional10-driver-01.js', 'affected-preparation-security17-driver-01.js']) fs.copyFileSync(own('drivers/' + name), own(name), fs.constants.COPYFILE_EXCL);
 put('driver-provenance.json', { status: 'FRESH_SIX_DRIVERS_PREPARED_NOT_NATIVE_RESULTS', sourceProof, entryPoints, options: { bundle: true, platform: 'node', format: 'cjs', external: ['vscode'], target: 'node18', sourcemap: false }, drivers, sourceInputs, auxiliarySourcePolicy: 'Transitive inputs outside the full product proof are recorded exactly here and repinned before/after every host. No older native result is transferred.' });
 const copied = [], helperNames = ['affected-ps51-05.ps1', 'affected-editor-05.ps1', 'affected-mcp-05.ps1', 'affected-retained-05.ps1', 'affected-functional10-05.ps1', 'affected-security17-05.ps1', 'affected-functional-security-05.ps1', 'affected-preparation-pipe-ownership-01.ps1'];
 for (const name of helperNames) { const raw = fs.readFileSync(path.join(prior, name)); fs.writeFileSync(own(name), raw, { flag: 'wx' }); copied.push({ source: fact(path.join(prior, name)), target: fact(own(name)), byteExact: true }); }
 for (const name of ['v01-admission.cjs', 'run-v01-affected.cjs', 'verify-v01-affected.cjs']) { const raw = fs.readFileSync(path.join(__dirname, name)); new vm.Script(raw.toString('utf8')); fs.writeFileSync(own(name), raw, { flag: 'wx' }); }
 let shared = fs.readFileSync(path.join(prior, 'affected-native-binding-05.ps1'), 'utf8');
 shared = shared.replaceAll('current-native-admission-06.cjs', 'v01-admission.cjs').replace('dd000bc5a9098193a8b3b493d44c9ea8d9446ccd0ce793888d8ec77966f2fb4a', fact(own('v01-admission.cjs')).sha256).replaceAll('content-inspection-02.json', 'content-inspection.json');
 assert(shared.includes(fact(own('v01-admission.cjs')).sha256)); put('affected-native-binding-05.ps1', shared); put('content-inspection.json', inventory);
 const oldScope = read(path.join(prior, 'affected-scope-05.json'));
 const families = oldScope.families.map(row => ({ ...row, helper: fact(own(row.helper)), driver: fact(own('drivers/' + row.driver)) }));
 const baseline = fact(path.join(repo, 'docs/soterai-lite/evidence/20261014-f06-vault-9c361a42/security-comparison-01.json'));
 const residualRows = read(pin(baseline)).rows.map(row => ({ attack: row.attack, status: row.current })); assert.equal(residualRows.length, 17);
 assert.deepEqual(residualRows.reduce((counts, row) => (counts[row.status] = (counts[row.status] || 0) + 1, counts), {}), { BLOCKED_SCOPED: 8, LEAK_CONFIRMED: 9 });
 const extractedRoot = path.relative(repo, own('vsix-extracted-01/extension')).replaceAll('\\', '/');
 const runtimes = inventory.entries.filter(row => row.path.startsWith('extension/dist/')).map(row => ({ ...row, path: extractedRoot + '/' + row.path.slice(10) }));
 const binding = { status: 'CURRENT_V01_AFFECTED_PREPARED_NOT_RUN', sourceParent: config.sourceParent, sourceProof, fullAcceptance, qualification, vsix, inspection: fact(own('content-inspection.json')), hostReview, hostVersion: vendor.currentHost.version, code: normalize(vendor.currentHost.executable), extractedRoot, frontendSha256: runtimes.find(row => row.path.endsWith('/extension.js')).sha256, runtimes, families, baseline, residualRows, driverProvenance: fact(own('driver-provenance.json')), sourceInputs: sourceInputs.map(({ inProductProof, ...row }) => row), fixtureInputs: [...copied.map(row => row.target), ...drivers, ...['affected-preparation-functional10-driver-01.js', 'affected-preparation-security17-driver-01.js', 'affected-native-binding-05.ps1', 'v01-admission.cjs', 'run-v01-affected.cjs', 'verify-v01-affected.cjs'].map(name => fact(own(name)))], owner: 'User requested remaining work and explicitly approved local tests and isolated VS Code checks on 6 November 2026.', f26a: 'Separately verified by native14; these four families do not replace its 34 assertions.', limits: '175 native + functional10 + security17 baseline only; tool routes and remaining V01/V02 gates are separate; LOW independence.' };
 put('binding.json', binding); put('preparation.json', { status: 'PREPARED_NOT_EXECUTED', binding: fact(own('binding.json')), copied, expected: { nativeChecks: 175, nativePhases: 8, functional: 10, securityCases: 17, historicalResiduals: { BLOCKED_SCOPED: 8, LEAK_CONFIRMED: 9 } }, nativeLaunches: 0 });
 put('syntax.ps1', "$ErrorActionPreference='Stop'\n$taskTokens=$null;$taskErrors=$null\nforeach($taskName in @(" + [...helperNames, 'affected-native-binding-05.ps1'].map(name => "'" + name + "'").join(',') + ")){[void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskName),[ref]$taskTokens,[ref]$taskErrors);if(@($taskErrors).Count){throw 'PowerShell syntax failure'}}\nWrite-Output 'PASS: all nine affected helpers parsed; no host launch'\n");
 require(own('v01-admission.cjs')).binding(); proof.files.forEach(pin);
 return { status: 'PREPARED_CURRENT_V01_AFFECTED_NOT_RUN', output: out, binding: fact(own('binding.json')), drivers: drivers.length, expectedNativeChecks: 175, expectedFunctional: 10, baseline: { cases: 17, blocked: 8, leaks: 9 } };
}
module.exports = { prepare, pin, fact };
if (require.main === module) prepare(read(path.resolve(process.argv[2]))).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
