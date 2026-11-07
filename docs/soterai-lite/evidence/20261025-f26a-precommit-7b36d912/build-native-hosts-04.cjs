// Root-run only, after forthcoming current full03/compiler15/proof04 gates.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { check, fact, json, sha, own, repo } = require('./post-full04-contract.cjs');
(async () => {
    const checked = check(); const sourceFiles = checked.sourceFiles; delete checked.sourceFiles;
    const out = own('prebuilt-native-hosts-04'), provenanceFile = own('native-driver-provenance-04.json');
    assert(!fs.existsSync(out) && !fs.existsSync(provenanceFile), 'Immutable output already exists.');
    const priorFile = own('native-driver-provenance-03.json');
    assert.equal(fact(priorFile).sha256, 'a0889724025f85fdd8fc9705f9c19c55ccbb4b36bdde44510500e41212c3c33c');
    const prior = json(priorFile); assert.equal(prior.status, 'BUILT_NOT_RUN_ESM_PARSER_INLINED'); assert.equal(prior.drivers.length, 21);
    for (const row of prior.drivers) { const raw = fs.readFileSync(own(row.path)); assert.equal(raw.length, row.bytes); assert.equal(sha(raw), row.sha256); }
    const names = {
        'lite-precommit-guard-host': 'litePreCommitGuard', 'lite-logs-host': 'liteLogs', 'lite-log-vault-runtime-host': 'liteLogVaultRuntime',
        'lite-vault-runtime-host': 'liteVaultRuntime', 'lite-streaming-output-host': 'liteStreamingOutput', 'lite-ps51-host': 'litePowerShell51',
        'lite-cmd-host': 'liteCmd', 'lite-gitbash-host': 'liteGitBash', 'lite-artifact-host': 'liteArtifactScanner', 'lite-history-host': 'liteHistoryScanner',
        'lite-broker-host': 'liteSafeReadMcp', 'lite-hygiene-host': 'liteHygiene', 'lite-vault-host': 'liteVault', 'lite-source-host': 'liteSourceScanner',
        'lite-container-host': 'liteContainerScanner', 'lite-terraform-host': 'liteTerraformScanner', 'lite-registry-host': 'liteRegistryScanner',
        'lite-service-account-host': 'liteServiceAccountScanner', 'lite-ci-host': 'liteCiScanner', 'lite-editor-host': 'liteEditorScanner', 'lite-mcp-host': 'liteMcpScanner'
    };
    const expectedNames = Object.keys(names).map(name => name + '.js').sort(); assert.deepEqual(prior.drivers.map(row => path.basename(row.path)).sort(), expectedNames);
    const { parserBundleOptions } = require(path.join(repo, 'packages/vscode-extension/scripts/parserBundleOptions.cjs'));
    const esbuild = require('esbuild'); fs.mkdirSync(out);
    const result = await esbuild.build({ ...parserBundleOptions(repo), metafile: true, absWorkingDir: repo,
        entryPoints: Object.fromEntries(Object.entries(names).map(([name, source]) => [name, path.join(repo, 'packages/vscode-extension/src/__tests__/host/' + source + '.host.ts')])),
        outdir: out, bundle: true, platform: 'node', format: 'cjs', external: ['vscode'], tsconfig: path.join(repo, 'packages/vscode-extension/tsconfig.json'), sourcemap: false, logLevel: 'warning' });
    const parser = Object.keys(result.metafile.inputs).filter(file => file.replace(/\\/g, '/').includes('node_modules/jsonc-parser/'));
    assert(parser.some(file => file.replace(/\\/g, '/').endsWith('jsonc-parser/lib/esm/main.js')));
    assert(!parser.some(file => file.replace(/\\/g, '/').includes('/lib/umd/')));
    assert(!Object.keys(result.metafile.inputs).some(file => /(?:phase2\/|vscode-stub)/.test(file.replace(/\\/g, '/'))), 'Unit doubles cannot establish native coverage.');
    const after = check(); assert.deepEqual(after, { ...checked, sourceFiles });
    const drivers = fs.readdirSync(out).filter(name => name.endsWith('.js')).sort().map(name => { const value = fact(path.join(out, name)); return { ...value, path: 'prebuilt-native-hosts-04/' + name }; });
    assert.equal(drivers.length, 21); assert.deepEqual(drivers.map(row => path.basename(row.path)).sort(), expectedNames);
    const comparisons = drivers.map(row => { const previous = prior.drivers.find(old => path.basename(old.path) === path.basename(row.path)); assert(previous); return { name: path.basename(row.path), previous, current: row, bytesIdentical: row.bytes === previous.bytes && row.sha256 === previous.sha256 }; });
    // Product code changed: compare and report actual bytes, never require or
    // assume twenty affected driver bundles remained equal to the old build.
    const sourceInputs = Object.keys(result.metafile.inputs).sort().map(file => fact(path.join(repo, file)));
    fs.writeFileSync(provenanceFile, JSON.stringify({ status: 'BUILT_NOT_RUN_ESM_PARSER_INLINED', time: new Date().toISOString(), ...checked,
        priorDriverProvenance: fact(priorFile), driverComparisons: comparisons, unchangedDriverCount: comparisons.filter(row => row.bytesIdentical).length,
        sourceInputs, inputs: result.metafile.inputs, outputs: result.metafile.outputs, drivers,
        limits: 'Fresh current-source driver build only. No native result transfer across the product fix or new VSIX.' }, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ status: 'BUILT_NOT_RUN', drivers: 21, unchangedDrivers: comparisons.filter(row => row.bytesIdentical).length, parserInputs: parser.length }));
})().catch(error => { console.error(error); process.exitCode = 1; });
