// Prepared evidence-only successor. Root executes after review; no native host.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict'), esbuild = require('esbuild');
const repo = path.resolve(__dirname, '../../../..'), out = path.join(__dirname, 'prebuilt-native-hosts-03');
const FIXTURE = 'packages/vscode-extension/src/__tests__/host/litePreCommitGuard.host.ts';
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const rel = file => path.relative(repo, file).replace(/\\/g, '/');
function pinned(name, expected) { const file = path.join(__dirname, name), raw = fs.readFileSync(file); assert.equal(sha(raw), expected, name); return { file, raw, value: JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, '')), fact: { path: rel(file), bytes: raw.length, sha256: sha(raw) } }; }
function gate(name, receiptSha) {
 const rawFile = path.join(__dirname, name + '.txt'), receiptFile = rawFile + '.result.json', receiptRaw = fs.readFileSync(receiptFile), receipt = json(receiptFile), raw = fs.readFileSync(rawFile);
 assert.equal(sha(receiptRaw), receiptSha, 'Gate receipt identity: ' + name); assert.equal(receipt.exitCode, 0, 'Required gate unavailable: ' + name); assert.equal(sha(raw), receipt.sha256.toLowerCase());
 return { path: rel(receiptFile), sha256: sha(receiptRaw), raw: { path: rel(rawFile), bytes: raw.length, sha256: sha(raw) } };
}
function check() {
 const full = pinned('full-inputs-02.json', '5b381391b7161f21af4dc30c3d6594373bb307f8903ab74d739d4d3a688ad322');
 const native = pinned('native-source-inputs-03.json', 'f94d6ca5ea2ff2499dbf76ea5f82239160806a7dc35bad5d42b79a7d5edb6aab');
 for (const proof of [full.value, native.value]) { assert.equal(proof.fileCount, 989); assert.equal(proof.files.length, 989); assert.equal(new Set(proof.files.map(row => row.path)).size, 989); }
 const previous = new Map(full.value.files.map(row => [row.path, row])), changed = [];
 for (const item of native.value.files) {
  assert(previous.has(item.path), 'Native proof added a path.');
  const before = previous.get(item.path); if (before.bytes !== item.bytes || before.sha256 !== item.sha256) changed.push(item.path);
  const file = path.resolve(repo, item.path); assert(file.startsWith(repo + path.sep)); const current = fs.readFileSync(file); assert.equal(current.length, item.bytes, item.path); assert.equal(sha(current), item.sha256, item.path);
 }
 assert.deepEqual(changed, [FIXTURE]); assert.equal(native.value.allowedNativeOnlyDelta, FIXTURE); assert.equal(native.value.unchangedFullInputs, 988);
 const prior = previous.get(FIXTURE), current = native.value.files.find(row => row.path === FIXTURE);
 assert.deepEqual([prior.bytes, prior.sha256], [66252, '91f6823b50b6c36aa5c8d277386978d3f92e15251c9f7ab2194d31ecc35b636d']);
 assert.deepEqual([current.bytes, current.sha256], [66256, 'd773858448cd4969d47d258915098519acb856f1afa28f6ca6cab2c0a8e33741']);
 const beforeRaw = fs.readFileSync(path.join(__dirname, 'litePreCommitGuard.host.ts.before-CodeExpectedError-01.txt'));
 assert.equal(sha(beforeRaw), prior.sha256); const text = beforeRaw.toString('utf8'), needle = 'error.name === "ExpectedError"';
 assert.equal(text.split(needle).length, 2); assert(Buffer.from(text.replace(needle, 'error.name === "CodeExpectedError"')).equals(fs.readFileSync(path.join(repo, FIXTURE))), 'Only the exact native fixture error-name literal may differ.');
 const semantic = pinned('native-host-freeze-02.json', '96c822673ea43cd246bb116b8232cefd86d9ab5448f0793d11e16455552dca6a');
 const priorSemantic = pinned('native-host-freeze-01.json', '090ee2ae998f18b44456dbd63727be2e9f4d8e4dc04ca5bc1c96767a0ad03e6e');
 assert.equal(semantic.value.sha256, current.sha256); assert.equal(semantic.value.bytes, current.bytes); assert.deepEqual(semantic.value.primary, priorSemantic.value.primary); assert.deepEqual(semantic.value.restart, priorSemantic.value.restart); assert.equal(semantic.value.primary.length, 30); assert.equal(semantic.value.restart.length, 4);
 return { inputProof: { ...native.fact, fileCount: 989 }, priorFullInputProof: { ...full.fact, fileCount: 989 }, semanticFreeze: semantic.fact,
  allowedNativeOnlyDelta: FIXTURE, unchangedFullInputs: 988, originalFullAttribution: 'Full02 remains attributed to proof02; only the reviewed native fixture literal differs. Product, unit and bundled runtime inputs are unchanged.' };
}
(async () => {
 const inputs = check(), compiler = gate('compiler-14', '4f78702568234099b8b827d30b929208c4c58b2464482f6ce22cfbb0bf5d8ddd'), full = gate('full-tests-02', '2cfdcf7e1cf975b01dd73a0e2093452e0513d18e836b15ca2af91cb0822ad859');
 const prior = pinned('native-driver-provenance-02.json', 'fc7d56817bec6fe869cf2819ed833c77ac70695d6aff043e40a6245bafcbc2f6');
 assert.equal(prior.value.status, 'BUILT_NOT_RUN_ESM_PARSER_INLINED'); assert.equal(prior.value.drivers.length, 21);
 const names = {
  'lite-precommit-guard-host': 'litePreCommitGuard', 'lite-logs-host': 'liteLogs', 'lite-log-vault-runtime-host': 'liteLogVaultRuntime',
  'lite-vault-runtime-host': 'liteVaultRuntime', 'lite-streaming-output-host': 'liteStreamingOutput', 'lite-ps51-host': 'litePowerShell51',
  'lite-cmd-host': 'liteCmd', 'lite-gitbash-host': 'liteGitBash', 'lite-artifact-host': 'liteArtifactScanner', 'lite-history-host': 'liteHistoryScanner',
  'lite-broker-host': 'liteSafeReadMcp', 'lite-hygiene-host': 'liteHygiene', 'lite-vault-host': 'liteVault', 'lite-source-host': 'liteSourceScanner',
  'lite-container-host': 'liteContainerScanner', 'lite-terraform-host': 'liteTerraformScanner', 'lite-registry-host': 'liteRegistryScanner',
  'lite-service-account-host': 'liteServiceAccountScanner', 'lite-ci-host': 'liteCiScanner', 'lite-editor-host': 'liteEditorScanner', 'lite-mcp-host': 'liteMcpScanner'
 };
 const expectedNames = Object.keys(names).map(name => name + '.js').sort(); assert.deepEqual(prior.value.drivers.map(row => path.basename(row.path)).sort(), expectedNames);
 for (const row of prior.value.drivers) { const raw = fs.readFileSync(path.join(__dirname, row.path)); assert.equal(raw.length, row.bytes); assert.equal(sha(raw), row.sha256); }
 if (fs.existsSync(out) || fs.existsSync(path.join(__dirname, 'native-driver-provenance-03.json'))) throw Error('Immutable native fixture build/provenance exists.'); fs.mkdirSync(out);
 const { parserBundleOptions } = require(path.join(repo, 'packages/vscode-extension/scripts/parserBundleOptions.cjs'));
 const result = await esbuild.build({ ...parserBundleOptions(repo), metafile: true, absWorkingDir: repo,
  entryPoints: Object.fromEntries(Object.entries(names).map(([name, source]) => [name, path.join(repo, 'packages/vscode-extension/src/__tests__/host/' + source + '.host.ts')])),
  outdir: out, bundle: true, platform: 'node', format: 'cjs', external: ['vscode'], tsconfig: path.join(repo, 'packages/vscode-extension/tsconfig.json'), sourcemap: false, logLevel: 'warning' });
 const parser = Object.keys(result.metafile.inputs).filter(file => file.replace(/\\/g, '/').includes('node_modules/jsonc-parser/'));
 assert(parser.some(file => file.replace(/\\/g, '/').endsWith('jsonc-parser/lib/esm/main.js'))); assert(!parser.some(file => file.replace(/\\/g, '/').includes('/lib/umd/')));
 assert(!Object.keys(result.metafile.inputs).some(file => /(?:phase2\/|vscode-stub)/.test(file.replace(/\\/g, '/'))), 'Unit editor doubles cannot establish native coverage.');
 check();
 const drivers = fs.readdirSync(out).filter(name => name.endsWith('.js')).sort().map(name => { const file = path.join(out, name), raw = fs.readFileSync(file); return { path: path.relative(__dirname, file).replace(/\\/g, '/'), bytes: raw.length, sha256: sha(raw) }; });
 assert.equal(drivers.length, 21); assert.deepEqual(drivers.map(row => path.basename(row.path)).sort(), expectedNames);
 const driverComparisons = drivers.map(row => { const before = prior.value.drivers.find(old => path.basename(old.path) === path.basename(row.path)); assert(before); return { name: path.basename(row.path), previous: before, current: row, bytesIdentical: row.bytes === before.bytes && row.sha256 === before.sha256 }; });
 const retained = driverComparisons.filter(row => row.name !== 'lite-precommit-guard-host.js'); assert.equal(retained.length, 20); assert(retained.every(row => row.bytesIdentical), 'All twenty other native driver bytes must remain exact.');
 assert.equal(driverComparisons.find(row => row.name === 'lite-precommit-guard-host.js').bytesIdentical, false, 'The exact corrected native fixture must change its bundle.');
 const actualInputs = Object.keys(result.metafile.inputs).sort().map(file => { const raw = fs.readFileSync(path.join(repo, file)); return { path: file.replace(/\\/g, '/'), bytes: raw.length, sha256: sha(raw) }; });
 fs.writeFileSync(path.join(__dirname, 'native-driver-provenance-03.json'), JSON.stringify({ status: 'BUILT_NOT_RUN_ESM_PARSER_INLINED', time: new Date().toISOString(),
  ...inputs, compiler, full, priorDriverProvenance: prior.fact, unchangedDriverCount: 20, driverComparisons, sourceInputs: actualInputs, inputs: result.metafile.inputs, outputs: result.metafile.outputs, drivers }, null, 2) + '\n', { flag: 'wx' });
 console.log(JSON.stringify({ status: 'BUILT_NOT_RUN', drivers: drivers.length, unchangedDrivers: 20, parserInputs: parser.length }));
})().catch(error => { console.error(error); process.exitCode = 1; });
