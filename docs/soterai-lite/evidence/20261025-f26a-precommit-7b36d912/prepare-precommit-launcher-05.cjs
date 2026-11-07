// Evidence authoring only. No Code/Git/test/compiler/build execution.
// Proposal preparation does not authorize the extra native fixture round.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict'), vm = require('node:vm');
const base = __dirname, repo = path.resolve(base, '../../../..'), own = name => path.join(base, name);
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const fact = file => { const raw = fs.readFileSync(file); return { path: path.relative(repo, file).replace(/\\/g, '/'), bytes: raw.length, sha256: sha(raw) }; };
const readPinned = (name, expected) => { const raw = fs.readFileSync(own(name)); assert.equal(sha(raw), expected, name); return raw; };
const writeNew = (name, raw) => fs.writeFileSync(own(name), raw, { flag: 'wx' });
const ancestorSha = '97161c38e178a02f7222fc1d68d21a90c18dd61908d7c54d70fede09659c3483';
const oldBootstrapSha = '5706c920648e5658807feaef34b912988310706626dc7d45ecf9f265393063f4';
const appRoot = 'C:\\Users\\USER\\AppData\\Local\\Programs\\Microsoft VS Code\\e646868227\\resources\\app';
const jsonRoot = path.join(appRoot, 'extensions/json-language-features');
const jsonFiles = [
    { relative: 'package.json', bytes: 3934, sha256: '9cd153a0d6bd8f8058b5f57c3f11c203228b102ec95e7a025d0e2a5448d662d3' },
    { relative: 'client/dist/node/jsonClientMain.js', bytes: 653282, sha256: '6471beebe24498a7d7c7d1803b08c475b0cf88115cf9999905a7890d3a9d75ca' },
    { relative: 'server/package.json', bytes: 1154, sha256: '9f89ec8214ef426f93002d427f1669027f41bece3a2f7f23787df45d58e237c4' },
    { relative: 'server/dist/node/jsonServerMain.js', bytes: 357534, sha256: 'b5425799cbb01710aa2f1ca48fd215d16e9c0d0d6f86447e2faeeaf5582d61e6' },
];
const mode = process.argv[2];
assert(process.argv.length === 3 && ['--prepare-proposal', '--materialize-approved-extra-round'].includes(mode),
    'Use --prepare-proposal; materialization additionally requires root to hold explicit extra-round user approval.');
const oldLauncher = readPinned('run-precommit-native-04.ps1', ancestorSha);
const oldBootstrap = readPinned('precommit-startup-bootstrap-04.cjs', oldBootstrapSha);
const binding = readPinned('native-current-binding-03.json', 'df37214d1c6af39677175f4cd8245d6cfa314488aed520110e73fa2f582bb612');
const freeze = readPinned('native-host-freeze-02.json', '96c822673ea43cd246bb116b8232cefd86d9ab5448f0793d11e16455552dca6a');
const cause = readPinned('startup04-rootcause-01.json', '7e052998eae0349807d65e3ca6c0e447d190248339ad5c3e063315112d63cb62');
for (const pin of jsonFiles) {
    const file = path.join(jsonRoot, pin.relative), current = fact(file);
    assert.equal(current.bytes, pin.bytes); assert.equal(current.sha256, pin.sha256);
}
if (mode === '--materialize-approved-extra-round') {
    // This switch is a deliberate root-side safeguard, not an approval receipt.
    // Root must obtain and retain the requested extra-round user approval first.
    const custody = JSON.parse(fs.readFileSync(own('precommit-launcher05-authoring-custody.json'), 'utf8'));
    assert.equal(custody.status, 'PROPOSED_NOT_AUTHORIZED_NOT_EXECUTED');
    for (const member of ['generator', 'bootstrap', 'proposalLauncher', 'proposal', 'ancestorSnapshot', 'bootstrapSnapshot']) {
        const pin = custody[member], current = fact(path.join(repo, pin.path)); assert.deepEqual(current, pin);
    }
    const candidate = fs.readFileSync(own('precommit-launcher05-proposed.ps1.txt'));
    writeNew('run-precommit-native-05.ps1', candidate);
    writeNew('precommit-launcher05-materialized-custody.json', JSON.stringify({
        status: 'MATERIALIZED_ONLY_NOT_EXECUTED_ROOT_MUST_RETAIN_EXTRA_ROUND_APPROVAL', time: new Date().toISOString(),
        launcher: fact(own('run-precommit-native-05.ps1')), authoringCustody: fact(own('precommit-launcher05-authoring-custody.json')),
        delegate: 'No Code, Git, native, test, compiler or build operation is invoked by this generator.'
    }, null, 2) + '\n');
    console.log('Materialized exact proposed launcher bytes only; no native behavior executed.');
} else {
    const extra = `
// Join the exact installed JSON builtin before the frozen driver's environment
// baseline. No process.env assignment, ignored key, sleep or changed oracle.
const jsonBuiltinPins = ${JSON.stringify(jsonFiles, null, 4)};
const jsonBuiltinAppRoot = ${JSON.stringify(appRoot)};
async function joinPinnedJsonBuiltin() {
    const folders = vscode.workspace.workspaceFolders;
    const root = folders?.length === 1 && folders[0].uri.scheme === 'file' ? folders[0].uri.fsPath : undefined;
    if (!vscode.workspace.isTrusted || vscode.env.remoteName !== undefined || !root
        || !/^D:\\\\SoterAI-Lite-test-profiles\\\\f26a-precommit-native-[0-9TZ]+-[a-f0-9]{8}\\\\workspace$/i.test(root)
        || !same(profile, path.join(path.dirname(root), 'profile'))
        || !same(vscode.env.appRoot, jsonBuiltinAppRoot)) throw Error('Pinned trusted local synthetic profile required.');
    if (await fs.readFile(path.join(root, '.synthetic-lite-f26a-precommit-host'), 'utf8') !== 'synthetic-only-v1')
        throw Error('Synthetic marker required before vendor startup.');
    const extension = vscode.extensions.getExtension('vscode.json-language-features');
    const expectedRoot = path.join(jsonBuiltinAppRoot, 'extensions', 'json-language-features');
    if (!extension || extension.id !== 'vscode.json-language-features' || extension.extensionUri.scheme !== 'file'
        || !same(extension.extensionPath, expectedRoot) || !same(await fs.realpath(extension.extensionPath), expectedRoot)
        || extension.packageJSON?.publisher !== 'vscode' || extension.packageJSON?.name !== 'json-language-features'
        || extension.packageJSON?.version !== '10.0.0' || extension.packageJSON?.main !== './client/dist/node/jsonClientMain')
        throw Error('Exact installed JSON builtin required.');
    const files = [];
    for (const pin of jsonBuiltinPins) {
        const file = path.join(expectedRoot, pin.relative), stat = await fs.lstat(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== pin.bytes || !same(await fs.realpath(file), file))
            throw Error('Pinned vendor JSON input identity differs.');
        const raw = await fs.readFile(file);
        if (raw.length !== pin.bytes || sha(raw) !== pin.sha256) throw Error('Pinned vendor JSON input bytes differ.');
        files.push({ relative: pin.relative, bytes: raw.length, sha256: pin.sha256 });
    }
    const schemaDownload = () => vscode.workspace.getConfiguration('json').get('schemaDownload.enable');
    if (schemaDownload() !== false) throw Error('Schema downloads must be disabled before vendor activation.');
    const wasActive = extension.isActive;
    await startup('json-builtin-activation-start');
    // This vendor call starts a language-server child. Its streams/EOF are not
    // owner/Git evidence and are never admitted by the public-Git observer.
    await extension.activate();
    if (!extension.isActive || schemaDownload() !== false) throw Error('JSON builtin activation/configuration incomplete.');
    await startup('json-builtin-activation-end');
    await writeJson(evidence + '.json-builtin-startup.json', {
        schemaVersion: 1, scope: 'PINNED_VENDOR_JSON_STARTUP_ONLY_NOT_A_34_CASE_RESULT', phase,
        extensionId: extension.id, appRoot: jsonBuiltinAppRoot, extensionPath: expectedRoot,
        trustedLocalSyntheticProfile: true, schemaDownloadEnabled: false, wasActive, isActive: extension.isActive,
        files, ordering: 'ACTIVATION_PROMISE_JOINED_BEFORE_ACTUAL_REQUIRE_DRIVER_REQUIRE_AND_ENVIRONMENT_BASELINE',
        processEnvironmentAssignmentsByBootstrap: 0, ignoredEnvironmentKeys: 0, addedTimers: 0,
        vendorLanguageServer: 'STARTUP_CHILD_OUTSIDE_OWNER_GIT_WITNESSES_NO_STREAM_OR_EOF_CLAIM',
        rawVendorOutputCaptured: false, signalsRequested: 0
    });
}
`;
    const oldBody = oldBootstrap.toString('utf8');
    const fnAnchor = 'exports.activate = async function (context) {';
    assert.equal(oldBody.split(fnAnchor).length, 2);
    let bootstrap = oldBody.replace(fnAnchor, () => extra.replace(/\r?\n/g, '\r\n') + fnAnchor);
    const orderAnchor = "await startup('activation-enter'); await startup('actual-require-start');";
    assert.equal(bootstrap.split(orderAnchor).length, 2);
    bootstrap = bootstrap.replace(orderAnchor, () => "await startup('activation-enter'); await joinPinnedJsonBuiltin(); await startup('actual-require-start');");
    new vm.Script(bootstrap, { filename: 'precommit-startup-bootstrap-05.cjs' }); // Parse only.
    const original = oldLauncher.toString('utf8'), embed = /\$taskBootstrap=@'\r?\n[\s\S]*?\r?\n'@\r?\n/g;
    assert.equal([...original.matchAll(embed)].length, 1);
    let proposed = original.replace(embed, () => "$taskBootstrap=@'\r\n" + bootstrap.replace(/\r?\n/g, '\r\n').replace(/\r\n$/, '') + "\r\n'@\r\n");
    const settingsAnchor = "'typescript.disableAutomaticTypeAcquisition'=$true;";
    assert.equal(proposed.split(settingsAnchor).length, 2); assert(!proposed.includes("'json.schemaDownload.enable'="));
    proposed = proposed.replace(settingsAnchor, () => "'json.schemaDownload.enable'=$false;" + settingsAnchor);
    const copyAnchor = "  if(Test-Path -LiteralPath $taskResult){Copy-F26ANew $taskResult (Join-Path $taskRun ($taskPhase+'-results.json'))}";
    assert.equal(proposed.split(copyAnchor).length, 2);
    const copy = String.raw`
  # Fixed-name vendor-startup metadata only; no JSON-server streams or env values.
  $taskJsonStartup=$taskResult+'.json-builtin-startup.json'
  if(Test-Path -LiteralPath $taskJsonStartup){
   if((Get-Item -LiteralPath $taskJsonStartup).Length -gt 65536){throw 'Vendor JSON startup metadata bound exceeded.'}
   Copy-F26ANew $taskJsonStartup (Join-Path $taskRun ($taskPhase+'-results.json.json-builtin-startup.json'))
  }
`;
    proposed = proposed.replace(copyAnchor, () => copyAnchor + copy.replace(/\r?\n/g, '\r\n'));
    // Apart from the embedded bootstrap, one setting and fixed metadata copy,
    // the entire launcher remains byte-for-byte the exact executed04 source.
    const withoutBootstrap = value => value.replace(embed, () => '$BOOTSTRAP\n');
    const restored = proposed.replace(copy.replace(/\r?\n/g, '\r\n'), () => '').replace("'json.schemaDownload.enable'=$false;", () => '');
    assert.equal(withoutBootstrap(restored), withoutBootstrap(original));
    for (const item of ["expectedChecks=@{primary=30;restart=4}", 'Elapsed.TotalSeconds -lt 300',
        'RETAIN_PROCESS_AND_PIPE_READERS_UNTIL_NATURAL_CLOSE_AND_BOTH_EOF_NO_LATER_PHASE',
        "'git.enabled'=$false", "'--disable-extension=vscode.git'", "if($taskSetupFiles.Count -gt 16)",
        'native-host-freeze-02.json', 'host-current-binding-02.ps1', 'precommit-offline-owner-03.cjs']) assert(proposed.includes(item), item);
    const proposal = `# F26a additional bounded fixture round05 proposal\n\nStatus: PROPOSED_NOT_AUTHORIZED_NOT_EXECUTED. No runnable05 launcher or native run is created by proposal preparation. Root must obtain the user's explicit approval for one additional bounded fixture round before materializing/launching05. IMPLEMENTATION-PLAN.md:46 limits improvement rounds to three; rounds02/03/04 are preserved.\n\nThe actual04 public Git version child exited0 with both EOF and29 stdout bytes; the frozen parent-environment assertion failed when VSCODE_L10N_BUNDLE_LOCATION changed. The mutation and assertion are observed; attribution to the installed JSON builtin is inferred from its exact setter and same-host activation trace. See startup04-rootcause-01.json. No product activation or 34-case result is promoted.\n\nProposed change: in the fresh trusted local synthetic profile, write json.schemaDownload.enable=false before Code starts. Before loading either the product or driver, require the effective setting to be false, verify exact vscode.json-language-features identity/path and four installed manifest/client/server hashes, then await its public activate() promise. Check isActive and the setting again before capturing the unchanged driver baseline. No manual environment writes, ignored keys, delays, new deadline, source edits or oracle changes.\n\nThe builtin starts a real vendor JSON language-server child. It is outside the owner/Git 34-case witnesses: no vendor stream, environment-value capture, child EOF claim or child-count promotion. The inherited observer admits only the same five exact public setup Git jobs, then becomes a transparent delegate. Fixed public vendor metadata is copied separately under a64KiB bound. Activation rejection fails before driver setup; a pending activation remains subject to the existing300-second parent ownership protocol without a new timeout, cancellation, signal or pipe abort.\n\nRetained exactly: source989/native-source-inputs03; frozen30primary+4restart assertions and driver03; unchanged VSIXbf23137b018e9c6f479ce537ba58898a4077fcdea8a0a785261a3446ac4cbd91 and four runtimes; current bindings; numeric-loopback/offline-owner checks; synthetic D profile; built-in Git disabled; no signals; original failure evidence unregraded. No normal profile, network download/login, Git/source/build/native execution is performed while authoring this proposal.\n\nPrepared content: precommit-startup-bootstrap-05.cjs and precommit-launcher05-proposed.ps1.txt. prepare-precommit-launcher-05.cjs --materialize-approved-extra-round writes the exact reviewed proposed launcher bytes only, after root has retained the extra-round approval. The switch does not itself constitute approval. Root must parse PowerShell and recheck current pins before an actual run. No native coverage, complete protection or independent rating is claimed.\n`;
    const targets = ['precommit-startup-bootstrap-05.cjs', 'precommit-launcher05-proposed.ps1.txt', 'precommit-launcher05-proposal.md',
        'precommit-launcher05-authoring-custody.json', 'precommit-launcher05-inherited-run04.txt', 'precommit-launcher05-inherited-bootstrap04.txt'];
    for (const name of targets) assert(!fs.existsSync(own(name)), 'Immutable target already exists: ' + name);
    writeNew('precommit-launcher05-inherited-run04.txt', oldLauncher); writeNew('precommit-launcher05-inherited-bootstrap04.txt', oldBootstrap);
    writeNew('precommit-startup-bootstrap-05.cjs', bootstrap); writeNew('precommit-launcher05-proposed.ps1.txt', proposed); writeNew('precommit-launcher05-proposal.md', proposal);
    const custody = { status: 'PROPOSED_NOT_AUTHORIZED_NOT_EXECUTED', time: new Date().toISOString(),
        generator: fact(__filename), bootstrap: fact(own('precommit-startup-bootstrap-05.cjs')), proposalLauncher: fact(own('precommit-launcher05-proposed.ps1.txt')),
        proposal: fact(own('precommit-launcher05-proposal.md')), ancestor: fact(own('run-precommit-native-04.ps1')),
        ancestorSnapshot: fact(own('precommit-launcher05-inherited-run04.txt')), bootstrapSnapshot: fact(own('precommit-launcher05-inherited-bootstrap04.txt')),
        cause: fact(own('startup04-rootcause-01.json')), binding: fact(own('native-current-binding-03.json')), semanticFreeze: fact(own('native-host-freeze-02.json')),
        installedJson: { appRoot, extensionId: 'vscode.json-language-features', version: '10.0.0', files: jsonFiles.map(pin => ({ ...pin, ...fact(path.join(jsonRoot, pin.relative)) })) },
        onlyLauncherDeltas: ['Embedded bootstrap joins pinned JSON builtin before product/driver require/baseline', 'Isolated profile json.schemaDownload.enable=false', 'Fixed-name bounded public vendor startup metadata copy'],
        nonBootstrapInheritedLauncherExact: true, editorTimeoutSeconds: 300, primaryCases: 30, restartCases: 4,
        vendorChildScope: 'JSON_LANGUAGE_SERVER_OUTSIDE_34_GIT_OWNER_WITNESSES_NO_STREAM_OR_EOF_CLAIM',
        validation: 'Embedded JavaScript syntax via vm.Script only. PowerShell parse required before actual execution. No native/test/compiler/build/Git execution.',
        approval: 'EXTRA_ROUND_PENDING_ROOT_MUST_ASK_USER_AFTER_REVIEW', independence: 'LOW' };
    writeNew('precommit-launcher05-authoring-custody.json', JSON.stringify(custody, null, 2) + '\n');
    console.log(JSON.stringify(custody));
}
