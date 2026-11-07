// Prepared current-only native fixture build. No editor or native test is run.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict'), esbuild = require('esbuild');
const repo = path.resolve(__dirname, '../../../..'), out = path.join(__dirname, 'prebuilt-native-hosts-02');
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
function gate(name) {
 const rawFile = path.join(__dirname, name + '.txt'), receiptFile = rawFile + '.result.json', receipt = json(receiptFile), raw = fs.readFileSync(rawFile);
 assert.equal(receipt.exitCode, 0, 'Required current gate unavailable: ' + name); assert.equal(sha(raw), receipt.sha256.toLowerCase());
 return { path: path.relative(repo, receiptFile).replace(/\\/g, '/'), sha256: sha(fs.readFileSync(receiptFile)) };
}
function check() {
 const file = path.join(__dirname, 'full-inputs-02.json'), raw = fs.readFileSync(file);
 assert.equal(sha(raw), '5b381391b7161f21af4dc30c3d6594373bb307f8903ab74d739d4d3a688ad322');
 const proof = JSON.parse(raw); assert.equal(proof.fileCount, 989); assert.equal(proof.files.length, 989);
 for (const item of proof.files) { const current = fs.readFileSync(path.join(repo, item.path)); assert.equal(current.length, item.bytes, item.path); assert.equal(sha(current), item.sha256, item.path); }
 return { path: path.relative(repo, file).replace(/\\/g, '/'), sha256: sha(raw), fileCount: proof.files.length };
}
(async () => {
 const inputs = check(), compiler = gate('compiler-13'), full = gate('full-tests-02');
 const names = {
  'lite-precommit-guard-host': 'litePreCommitGuard', 'lite-logs-host': 'liteLogs', 'lite-log-vault-runtime-host': 'liteLogVaultRuntime',
  'lite-vault-runtime-host': 'liteVaultRuntime', 'lite-streaming-output-host': 'liteStreamingOutput', 'lite-ps51-host': 'litePowerShell51',
  'lite-cmd-host': 'liteCmd', 'lite-gitbash-host': 'liteGitBash', 'lite-artifact-host': 'liteArtifactScanner', 'lite-history-host': 'liteHistoryScanner',
  'lite-broker-host': 'liteSafeReadMcp', 'lite-hygiene-host': 'liteHygiene', 'lite-vault-host': 'liteVault', 'lite-source-host': 'liteSourceScanner',
  'lite-container-host': 'liteContainerScanner', 'lite-terraform-host': 'liteTerraformScanner', 'lite-registry-host': 'liteRegistryScanner',
  'lite-service-account-host': 'liteServiceAccountScanner', 'lite-ci-host': 'liteCiScanner', 'lite-editor-host': 'liteEditorScanner', 'lite-mcp-host': 'liteMcpScanner'
 };
 if (fs.existsSync(out)) throw Error('Immutable native fixture build exists.'); fs.mkdirSync(out);
 const { parserBundleOptions } = require(path.join(repo, 'packages/vscode-extension/scripts/parserBundleOptions.cjs'));
 const result = await esbuild.build({ ...parserBundleOptions(repo), metafile: true, absWorkingDir: repo,
  entryPoints: Object.fromEntries(Object.entries(names).map(([name, source]) => [name, path.join(repo, 'packages/vscode-extension/src/__tests__/host/' + source + '.host.ts')])),
  outdir: out, bundle: true, platform: 'node', format: 'cjs', external: ['vscode'], tsconfig: path.join(repo, 'packages/vscode-extension/tsconfig.json'), sourcemap: false, logLevel: 'warning' });
 const parser = Object.keys(result.metafile.inputs).filter(file => file.replace(/\\/g, '/').includes('node_modules/jsonc-parser/'));
 assert(parser.some(file => file.replace(/\\/g, '/').endsWith('jsonc-parser/lib/esm/main.js'))); assert(!parser.some(file => file.replace(/\\/g, '/').includes('/lib/umd/')));
 assert(!Object.keys(result.metafile.inputs).some(file => /(?:phase2\/|vscode-stub)/.test(file.replace(/\\/g, '/'))), 'Unit editor doubles cannot establish native coverage.');
 check();
 const drivers = fs.readdirSync(out).filter(name => name.endsWith('.js')).sort().map(name => { const file = path.join(out, name), raw = fs.readFileSync(file); return { path: path.relative(__dirname, file).replace(/\\/g, '/'), bytes: raw.length, sha256: sha(raw) }; });
 assert.equal(drivers.length, 21);
 const actualInputs = Object.keys(result.metafile.inputs).sort().map(file => { const raw = fs.readFileSync(path.join(repo, file)); return { path: file.replace(/\\/g, '/'), bytes: raw.length, sha256: sha(raw) }; });
 fs.writeFileSync(path.join(__dirname, 'native-driver-provenance-02.json'), JSON.stringify({ status: 'BUILT_NOT_RUN_ESM_PARSER_INLINED', time: new Date().toISOString(),
  inputProof: inputs, compiler, full, sourceInputs: actualInputs, inputs: result.metafile.inputs, outputs: result.metafile.outputs, drivers }, null, 2) + '\n', { flag: 'wx' });
 console.log(JSON.stringify({ status: 'BUILT_NOT_RUN', drivers: drivers.length, parserInputs: parser.length }));
})().catch(error => { console.error(error); process.exitCode = 1; });
