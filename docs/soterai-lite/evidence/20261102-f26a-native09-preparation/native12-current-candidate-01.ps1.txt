param(
 [Parameter(Mandatory=$true)][string]$CodePath,
 [Parameter(Mandatory=$true)][string]$HostTestsPath,
 [Parameter(Mandatory=$true)][string]$ExtensionRoot,
 [Parameter(Mandatory=$true)][string]$VsixPath,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedVsixSha256,
 [Parameter(Mandatory=$true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedBundleSha256
)
# PREPARED_NOT_EXECUTED. Every Code/Git launch is owned; no signals or pipe aborts.
$ErrorActionPreference='Stop'
$taskExpectedVsix='5dac9288fb259ad538ab751258f250d85a933bfb5bc8641dc32e54c01f6f047f'
$taskExpected='3524f4f234004d81924854c756330a5d1273e0251c524d1a31fa63c3b3c784b2'
$taskWorkerExpected='36e04d01bb9b38f8e402020318cc1d8d1a6d66176ec2be8c1630fbe6d012cacb'
$taskDriverExpected='8f7d11faa7ba03683fdbec85f95a0d2284bb126cd45c1dfc1cb02b2e3b090ced'
$taskCodeExpected='9f33ede68f3317402280fa997bc8963f93e67f2905e416d6bb092c03d60a37eb'
$taskGitExpected='da240fe9bc24895b3e04150a4990b8a6ff329ecabcd8f19684c2cc310da5ef3f'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskSource=[IO.Path]::GetFullPath($ExtensionRoot);$taskHost=[IO.Path]::GetFullPath($HostTestsPath);$taskVsix=[IO.Path]::GetFullPath($VsixPath)
$taskGit='C:\Program Files\Git\cmd\git.exe'
$taskOfflineHelper=Join-Path $PSScriptRoot 'native09-offline-owner-01.cjs'
function Get-F26ASha([string]$File){return (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant()}
function Assert-F26AFile([string]$File,[string]$Sha,[long]$Bytes=-1){
 if(-not(Test-Path -LiteralPath $File -PathType Leaf) -or (Get-F26ASha $File) -cne $Sha -or ($Bytes -ge 0 -and (Get-Item -LiteralPath $File).Length -ne $Bytes)){throw ('Pinned file differs: '+$File)}
}
function Write-F26ANewBytes([string]$File,[byte[]]$Bytes){
 $taskFd=[IO.File]::Open($File,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
 try{$taskFd.Write($Bytes,0,$Bytes.Length);$taskFd.Flush($true)}finally{$taskFd.Dispose()}
}
function Write-F26ANewJson([string]$File,[object]$Value){Write-F26ANewBytes $File ([Text.UTF8Encoding]::new($false).GetBytes(($Value|ConvertTo-Json -Depth 60)+[Environment]::NewLine))}
function Copy-F26ANew([string]$Source,[string]$Target){if(Test-Path -LiteralPath $Target){throw 'Existing evidence copy refused.'};[IO.File]::Copy($Source,$Target,$false)}
function Assert-F26AOrdinary([string]$File){
 $taskCursor=[IO.Path]::GetFullPath($File)
 if($taskCursor -ine $taskRepo -and -not $taskCursor.StartsWith($taskRepo+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Fixture ancestry guard escaped workspace.'}
 while($taskCursor.Length -ge $taskRepo.Length){if((Get-Item -LiteralPath $taskCursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked fixture input refused.'};$taskCursor=Split-Path -Parent $taskCursor}
}
# UNBOUND text-only successor helper custody. All future helpers require new exact-byte binding.
Assert-F26AFile (Join-Path $PSScriptRoot 'native09-current-admission-01.cjs') '71caae8c07839edff9ee0f0dbd33362c2b68d2784830900851bcc93226ba6c7e' 15337
Assert-F26AFile (Join-Path $PSScriptRoot 'native09-host-current-binding-01.ps1') 'c54d73a48cc9406d2b5f0002d05c26be1a73c6950f50786132253eb5b616d9d5' 1957
Assert-F26AFile (Join-Path $PSScriptRoot 'native09-artifact-binding-01.ps1') 'b380369073e876f0b7e984680c4636332ea048f98c87eb86ef58eb515cf4b416' 4578
Assert-F26AFile (Join-Path $taskRepo 'docs/soterai-lite/evidence/20261101-f28-reliability-9a4c2e71/current-native-admission-05.cjs') '251638db0be53eb3e79f808316e08c9d192e0eca10741fbc8484fb8353f3e368' 8293
Assert-F26AFile (Join-Path $PSScriptRoot 'native09-offline-owner-01.cjs') '73317aa89fd8bcdc937f56d737656b2ee93fcab7127ec058a2be02945eb7941a' 14903
Assert-F26AFile (Join-Path $taskRepo 'docs/soterai-lite/evidence/20261029-f26b-prepush-70e1c9a4/native-physical-admission-14.cjs') '6d8aba0bdc97360823f92af00ec5f27d5f05c27389214724e37d53a0e6b5a11d' 3547
foreach($taskInput in @($taskSource,$taskHost,$taskVsix)){
 if(-not $taskInput.StartsWith($taskRepo+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Fixture input outside workspace.'};Assert-F26AOrdinary $taskInput
}
if($ExpectedVsixSha256.ToLowerInvariant() -cne $taskExpectedVsix -or $ExpectedBundleSha256.ToLowerInvariant() -cne $taskExpected){throw 'Only this exact new F26a artifact/frontend is admitted.'}
if($taskVsix -ine [IO.Path]::GetFullPath((Join-Path $taskRepo 'packages/soterai-lite/soterai-lite-0.7.0-f28-20261101-attempt01.vsix'))){throw 'Exact F26a attempt02 path required.'}
if($taskSource -ine [IO.Path]::GetFullPath((Join-Path $taskRepo 'docs/soterai-lite/evidence/20261101-f28-reliability-9a4c2e71/vsix-extracted-02/extension')) -or $taskHost -ine [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'supplementary-prebuilt-hosts-01/lite-precommit-guard-host.js'))){throw 'Current exact extraction and prebuilt driver required.'}
Assert-F26AFile $taskVsix $taskExpectedVsix;Assert-F26AFile $taskHost $taskDriverExpected 74473
Assert-F26AFile $CodePath $taskCodeExpected 238751552;Assert-F26AFile $taskGit $taskGitExpected 46480
Assert-F26AFile (Join-Path $PSScriptRoot 'original-native34-freeze-01.json') '96c822673ea43cd246bb116b8232cefd86d9ab5448f0793d11e16455552dca6a'
Assert-F26AFile (Join-Path $PSScriptRoot 'supplementary-precommit-driver-provenance-01.json') '2e454f5001d0c467c533f162e98c7360d70a677f75806acda713c2b6b5d7677e'
$taskSemanticFreeze=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'original-native34-freeze-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
if(@($taskSemanticFreeze.primary).Count -ne 30 -or @($taskSemanticFreeze.restart).Count -ne 4 -or $taskSemanticFreeze.sha256 -cne 'd773858448cd4969d47d258915098519acb856f1afa28f6ca6cab2c0a8e33741'){throw 'Exact30+4 semantic fixture required.'}
Assert-F26AFile (Join-Path $taskRepo $taskSemanticFreeze.file) $taskSemanticFreeze.sha256 $taskSemanticFreeze.bytes
$taskProvenance=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'supplementary-precommit-driver-provenance-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
$taskSelectedDriver=@($taskProvenance.drivers|Where-Object{$_.path -ceq 'docs/soterai-lite/evidence/20261102-f26a-native09-preparation/supplementary-prebuilt-hosts-01/lite-precommit-guard-host.js'})
if($taskProvenance.status -cne 'F26A_CURRENT1076_SUPPLEMENTARY_DRIVER1_PREPARED_NOT_NATIVE_ACCEPTANCE' -or @($taskProvenance.drivers).Count -ne 1 -or $taskSelectedDriver.Count -ne 1 -or $taskSelectedDriver[0].sha256 -cne $taskDriverExpected){throw 'Current one supplementary driver provenance must bind this exact host.'}
. (Join-Path $PSScriptRoot 'native09-host-current-binding-01.ps1')
. (Join-Path $PSScriptRoot 'native09-artifact-binding-01.ps1')
Assert-F26AEditorHost
Assert-F15bRuntimeBinding -VsixPath $taskVsix -ExpectedVsixSha256 $taskExpectedVsix -ExtensionRoot $taskSource -ExpectedBundleSha256 $taskExpected
Assert-F26AFile (Join-Path $PSScriptRoot 'native10-bootstrap-admission-01.cjs') 'cad98a3837803cc3e7d7ae88c6e35bf0ba92210c9a5d373f92d0fff8e34fc866' 1519
$taskBootstrapAdmission=Join-Path $PSScriptRoot 'native10-bootstrap-admission-01.cjs'
& 'C:\Program Files\nodejs\node.exe' $taskBootstrapAdmission
if($LASTEXITCODE -ne 0){throw 'Current JSON bootstrap admission failed before Code/profile/Git.'}
$taskOfflineExpected=Get-F26ASha $taskOfflineHelper;$taskLauncherExpected=Get-F26ASha $PSCommandPath
# Explicit previous USER_DEFERRED decision remains a gate. No materialization/launch without fresh approval.
$taskApprovalFile=Join-Path $PSScriptRoot 'native12-user-approval-01.json'
if(-not(Test-Path -LiteralPath $taskApprovalFile -PathType Leaf)){throw 'F26a native11 remains NOT_AUTHORIZED: explicit fresh approval required'}
$taskApproval=Get-Content -LiteralPath $taskApprovalFile -Raw -Encoding UTF8|ConvertFrom-Json
if($taskApproval.status -cne 'EXPLICIT_USER_AUTHORIZATION_ONE_F26A_NATIVE12' -or $taskApproval.allowedAttempts -ne 1 -or -not $taskApproval.replyId -or $taskApproval.candidateSha256 -cne (Get-F26ASha $PSCommandPath) -or $taskApproval.proposalSha256 -cne (Get-F26ASha (Join-Path $PSScriptRoot 'NATIVE12-OFFLINE-ROOT-CASE-PROPOSAL01.md'))){throw 'Exact fresh native11 user approval does not bind this packet'}
$taskConsumption=Join-Path $PSScriptRoot 'native12-consumption-01.json'
if(Test-Path -LiteralPath $taskConsumption){throw 'This single native11 authorization is already consumed'}
Write-F26ANewJson $taskConsumption @{status='SINGLE_APPROVED_F26A_NATIVE12_CONSUMED_NO_AUTO_RETRY';observedAt=[DateTime]::UtcNow.ToString('o');approvalSha256=(Get-F26ASha $taskApprovalFile);proposalSha256=$taskApproval.proposalSha256;candidateSha256=$taskApproval.candidateSha256;signalsRequested=0}
$taskName='f26a-precommit-native-'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,8)
$taskRun=Join-Path $PSScriptRoot $taskName
$taskExecution=[IO.Path]::GetFullPath((Join-Path 'D:\SoterAI-Lite-test-profiles' $taskName))
if(-not $taskExecution.StartsWith('D:\SoterAI-Lite-test-profiles\',[StringComparison]::OrdinalIgnoreCase)){throw 'Unexpected isolated execution root.'}
if((Test-Path -LiteralPath $taskRun) -or (Test-Path -LiteralPath $taskExecution)){throw 'Existing evidence/profile refused.'}
$taskProfile=Join-Path $taskExecution 'profile';$taskWorkspace=Join-Path $taskExecution 'workspace';$taskInstalled=Join-Path $taskExecution 'extensions';$taskSnapshot=Join-Path $taskExecution 'extension'
foreach($taskDirectory in @($taskRun,$taskSnapshot,(Join-Path $taskProfile 'User'),(Join-Path $taskProfile 'Temp'),$taskWorkspace,$taskInstalled)){[void][IO.Directory]::CreateDirectory($taskDirectory)}
foreach($taskEntry in Get-ChildItem -LiteralPath $taskSource -Force){Copy-Item -LiteralPath $taskEntry.FullName -Destination $taskSnapshot -Recurse}
$taskManifestPath=Join-Path $taskSnapshot 'package.json';$taskOriginalManifest=[IO.File]::ReadAllBytes($taskManifestPath)
Write-F26ANewBytes (Join-Path $taskRun 'original-manifest.json') $taskOriginalManifest
$taskManifest=[Text.UTF8Encoding]::new($false,$true).GetString($taskOriginalManifest)|ConvertFrom-Json
if($taskManifest.publisher -cne 'soterai' -or $taskManifest.name -cne 'soterai-ide-guard' -or $taskManifest.main -cne './dist/extension.js'){throw 'Unexpected packaged extension identity/main.'}
$taskManifest.main='./dist-test/native-bootstrap.cjs'
[IO.File]::WriteAllText($taskManifestPath,($taskManifest|ConvertTo-Json -Depth 100),[Text.UTF8Encoding]::new($false))
$taskProbe=Join-Path $taskSnapshot 'dist-test/host/index.js';[void][IO.Directory]::CreateDirectory((Split-Path -Parent $taskProbe));Copy-F26ANew $taskHost $taskProbe
$taskBootstrap=@'
// Evidence-only developer bootstrap. This is not a shipped product runtime.
const vscode = require('vscode');
const fs = require('node:fs/promises');
const sync = require('node:fs');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const path = require('node:path');
const prefix = 'SOTERAI_LITE_F26A_HOOK_';
const git = 'C:\\Program Files\\Git\\cmd\\git.exe';
const realSpawn = cp.spawn;
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const evidence = process.env[prefix + 'EVIDENCE'];
const phase = process.env[prefix + 'PHASE'];
const profile = process.env[prefix + 'PROFILE'];
let actual, driver, startupOnly = true, beforeActivatePending = false;
let observedJobs = 0, skippedStartupSpawns = 0;
let setupFlush;
const setupObservers = [], setupRows = [];
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const startup = async stage => { try { await fs.appendFile(evidence + '.startup.jsonl', JSON.stringify({ phase, timestamp: new Date().toISOString(), stage }) + '\n'); } catch {} };
const diagnostic = () => typeof driver?.setupDiagnostic === 'function' ? driver.setupDiagnostic() : undefined;
const writeJson = (file, value) => fs.writeFile(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
function envSnapshot() {
    const keys = Object.keys(process.env), bounded = keys.length <= 4096;
    return { sha256: sha(JSON.stringify(process.env)), values: new Map(keys.slice(0, 4096).map(key => [key, process.env[key]])), bounded };
}
function changedKeys(before, after) {
    const all = [...new Set([...before.values.keys(), ...after.values.keys()])].sort();
    const changed = all.filter(key => before.values.get(key) !== after.values.get(key));
    const valid = changed.filter(key => /^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(key));
    return { names: valid.slice(0, 256), truncated: valid.length > 256 || !before.bounded || !after.bounded, invalidNamesDropped: valid.length !== changed.length };
}
const initialEnvironment = envSnapshot();
let beforeActivateEnvironment;
function publicSetup(values) {
    if (!startupOnly || observedJobs >= 5) return undefined;
    const root = vscode.workspace.workspaceFolders?.length === 1 ? vscode.workspace.workspaceFolders[0].uri.fsPath : undefined;
    if (!root || !/^D:\\SoterAI-Lite-test-profiles\\f26a-precommit-native-[0-9TZ]+-[a-f0-9]{8}\\workspace$/i.test(root)
        || !same(profile, path.join(path.dirname(root), 'profile')) || values.length !== 3 || values[0] !== git || !Array.isArray(values[1])) return undefined;
    const args = values[1], options = values[2], empty = path.join(profile, 'f26a-hook-fixture', 'empty-hooks');
    if (!options || !same(options.cwd, root) || options.shell !== false || options.windowsHide !== true
        || JSON.stringify(options.stdio) !== JSON.stringify(['ignore', 'pipe', 'pipe']) || !options.env) return undefined;
    const fixed = ['--no-pager', '--literal-pathspecs', '--no-lazy-fetch', '--no-replace-objects', '--no-optional-locks',
        '-c', 'core.hooksPath=' + empty, '-c', 'core.fsmonitor=false', '-c', 'credential.helper=', '-c', 'protocol.allow=never'];
    if (fixed.some((item, index) => args[index] !== item)) return undefined;
    const suffix = args.slice(fixed.length), forms = [
        { operation: 'version', suffix: ['--version'] },
        { operation: 'init', suffix: ['init', '--quiet', '--initial-branch=main', '--object-format=sha1', '--template=' + empty] },
        { operation: 'config-user-name', suffix: ['config', '--local', 'user.name', 'F26a Synthetic Owner'] },
        { operation: 'config-user-email', suffix: ['config', '--local', 'user.email', 'synthetic-f26a@example.invalid'] },
        { operation: 'config-autocrlf', suffix: ['config', '--local', 'core.autocrlf', 'false'] },
    ];
    const form = forms.find(item => JSON.stringify(item.suffix) === JSON.stringify(suffix)); if (!form) return undefined;
    const expected = {};
    for (const name of ['HOME', 'USERPROFILE', 'XDG_CONFIG_HOME', 'GIT_CONFIG_GLOBAL', 'GIT_CONFIG_SYSTEM', 'GIT_CONFIG_NOSYSTEM', 'SystemRoot', 'WINDIR', 'COMSPEC'])
        if (process.env[name] !== undefined) expected[name] = process.env[name];
    Object.assign(expected, { GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', GIT_OPTIONAL_LOCKS: '0', GIT_PAGER: '', PAGER: '',
        GIT_NO_LAZY_FETCH: '1', GIT_NO_REPLACE_OBJECTS: '1', GIT_PROTOCOL_FROM_USER: '0', LC_ALL: 'C', LANG: 'C' });
    const env = options.env;
    if (Object.keys(env).length !== Object.keys(expected).length || Object.keys(env).some(name => env[name] !== expected[name])) return undefined;
    for (const name of ['HOME', 'USERPROFILE', 'XDG_CONFIG_HOME']) if (!same(env[name], profile)) return undefined;
    for (const name of ['PATH', 'NODE_OPTIONS', 'NODE_PATH', 'GIT_CONFIG', 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_PARAMETERS']) if (env[name] !== undefined) return undefined;
    return { root, args: args.slice(), operation: form.operation, environmentSha256: sha(JSON.stringify(env)), before: envSnapshot() };
}
function observePublicSetup(child, selected) {
    const id = ++observedJobs, base = evidence + '.setup-child-' + String(id).padStart(2, '0');
    const row = { schemaVersion: 1, syntheticOnly: true, captureScope: 'BEFORE_ACTIVATE_EXACT_PUBLIC_SETUP_ONLY', phase,
        operation: selected.operation, executable: git, cwd: selected.root, args: selected.args, argvSha256: sha(JSON.stringify(selected.args)),
        environmentSha256: selected.environmentSha256, inheritedEnvironment: false, globalEnvironmentBeforeSha256: selected.before.sha256,
        beforeActivateEnvironmentSha256: beforeActivateEnvironment?.sha256 ?? null, pid: child.pid ?? null,
        startedAt: new Date().toISOString(), closed: false, exitCode: null, signal: null, stdoutEOF: false, stderrEOF: false,
        signalsRequested: 0, overflow: false, ioError: false, streamError: false, spawnFailed: false };
    setupRows.push(row);
    let resolve, finished = false;
    const completion = new Promise(done => { resolve = done; }); setupObservers.push(completion);
    const streams = {};
    for (const [name, cap] of [['stdout', 4096], ['stderr', 8192]]) {
        const file = base + '-' + name + '.bin'; let fd;
        try { fd = sync.openSync(file, 'wx'); } catch { row.ioError = true; }
        streams[name] = { file, fd, cap, admitted: 0, observed: 0, digest: crypto.createHash('sha256') };
    }
    const finish = () => {
        if (finished || !row.closed || !row.stdoutEOF || !row.stderrEOF) return; finished = true;
        for (const [name, state] of Object.entries(streams)) {
            if (state.fd !== undefined) try { sync.fsyncSync(state.fd); sync.closeSync(state.fd); } catch { row.ioError = true; }
            row[name] = { path: state.file, bytes: state.admitted, observedBytes: state.observed, cap: state.cap, sha256: state.digest.digest('hex') };
        }
        const after = envSnapshot(), keys = changedKeys(selected.before, after);
        row.globalEnvironmentAfterSha256 = after.sha256; row.changedEnvironmentKeyNames = keys.names;
        row.changedEnvironmentKeyNamesTruncated = keys.truncated; row.invalidEnvironmentKeyNamesDropped = keys.invalidNamesDropped;
        row.closedAt = new Date().toISOString();
        writeJson(base + '.json', row).then(() => resolve(), () => { row.ioError = true; resolve(); });
    };
    child.once('error', error => { row.spawnFailed = true; row.spawnErrorName = error instanceof Error ? error.name : 'UnknownFailure'; });
    child.once('close', (code, signal) => { row.closed = true; row.exitCode = code; row.signal = signal; finish(); });
    for (const name of ['stdout', 'stderr']) {
        const stream = child[name], state = streams[name];
        if (!stream) { row.streamError = true; continue; }
        stream.on('data', chunk => {
            const raw = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); state.observed += raw.length;
            const count = Math.min(raw.length, Math.max(0, state.cap - state.admitted)); if (state.observed > state.cap) row.overflow = true;
            if (state.fd !== undefined && count > 0 && !row.ioError) try {
                let offset = 0; while (offset < count) offset += sync.writeSync(state.fd, raw, offset, count - offset);
                state.digest.update(raw.subarray(0, count)); state.admitted += count;
            } catch { row.ioError = true; }
        });
        stream.once('error', () => { row.streamError = true; });
        stream.once('end', () => { row[name + 'EOF'] = true; finish(); });
    }
}
// Preserve exact invocation and child identity. The frozen driver captures this
// delegate at require time; after startupOnly=false it observes no output at all.
cp.spawn = function (...values) {
    let selected;
    if (startupOnly) try { selected = publicSetup(values); } catch { skippedStartupSpawns++; }
    const child = Reflect.apply(realSpawn, this, values);
    if (!startupOnly) return child;
    if (selected) observePublicSetup(child, selected); else skippedStartupSpawns++;
    return child;
};
const flushSetup = () => setupFlush ??= (async () => {
    await Promise.all(setupObservers);
    const after = envSnapshot(), keys = changedKeys(beforeActivateEnvironment ?? initialEnvironment, after);
    await writeJson(evidence + '.setup-observer-summary.json', { schemaVersion: 1, syntheticOnly: true, scope: 'PUBLIC_BEFORE_ACTIVATE_ONLY', phase,
        initialEnvironmentSha256: initialEnvironment.sha256, beforeActivateEnvironmentSha256: beforeActivateEnvironment?.sha256 ?? null,
        afterEnvironmentSha256: after.sha256, changedEnvironmentKeyNames: keys.names, changedEnvironmentKeyNamesTruncated: keys.truncated,
        invalidEnvironmentKeyNamesDropped: keys.invalidNamesDropped, observedJobs, skippedStartupSpawns,
        rows: setupRows, rawCapsPerChild: { stdout: 4096, stderr: 8192 }, signalsRequested: 0,
        delegation: 'UNCHANGED_REAL_SPAWN_ARGS_ENV_CHILD;CAPTURE_DISABLED_BEFORE_ACTUAL_ACTIVATION', limits: 'Diagnostic metadata only; no scanner/owner/private output or environment values.' });
})();
const close = async () => {
    const state = diagnostic();
    if (state?.halted || state?.busyChildren || state?.timedOutChildren) { await startup('STOP_UNCONFIRMED_OWNERSHIP_RETAINED_NO_CLOSE'); return; }
    await startup('close-start'); await vscode.commands.executeCommand('workbench.action.closeWindow'); await startup('close-end');
};
const failure = async (stage, error, publicSetupFailure = false) => {
    const body = { status: 'FAIL', stage, errorName: error instanceof Error ? error.name : 'UnknownFailure', setup: diagnostic() };
    if (publicSetupFailure) {
        body.publicSetupOnly = true;
        body.publicSetupStack = error instanceof Error && typeof error.stack === 'string'
            ? [error.name, ...error.stack.split('\n').filter(line => /^\s+at /.test(line)).slice(0, 32)].join('\n').slice(0, 8192) : 'Unavailable';
        body.stackScope = 'ERROR_NAME_AND_STACK_FRAMES_ONLY_NO_ASSERTION_VALUES_OR_ENVIRONMENT_DUMP';
        body.environmentValuesIncluded = false;
    }
    await writeJson(evidence + '.driver-error.json', body);
};

// Join the exact installed JSON builtin before the frozen driver's environment
// baseline. No process.env assignment, ignored key, sleep or changed oracle.
const jsonBuiltinPins = [
    {
        "relative": "package.json",
        "bytes": 3934,
        "sha256": "9cd153a0d6bd8f8058b5f57c3f11c203228b102ec95e7a025d0e2a5448d662d3"
    },
    {
        "relative": "client/dist/node/jsonClientMain.js",
        "bytes": 653282,
        "sha256": "6471beebe24498a7d7c7d1803b08c475b0cf88115cf9999905a7890d3a9d75ca"
    },
    {
        "relative": "server/package.json",
        "bytes": 1154,
        "sha256": "9f89ec8214ef426f93002d427f1669027f41bece3a2f7f23787df45d58e237c4"
    },
    {
        "relative": "server/dist/node/jsonServerMain.js",
        "bytes": 357534,
        "sha256": "b5425799cbb01710aa2f1ca48fd215d16e9c0d0d6f86447e2faeeaf5582d61e6"
    }
];
const jsonBuiltinAppRoot = "C:\\Users\\USER\\AppData\\Local\\Programs\\Microsoft VS Code\\2c33b50b16\\resources\\app";
async function joinPinnedJsonBuiltin() {
    const folders = vscode.workspace.workspaceFolders;
    const root = folders?.length === 1 && folders[0].uri.scheme === 'file' ? folders[0].uri.fsPath : undefined;
    if (!vscode.workspace.isTrusted || vscode.env.remoteName !== undefined || !root
        || !/^D:\\SoterAI-Lite-test-profiles\\f26a-precommit-native-[0-9TZ]+-[a-f0-9]{8}\\workspace$/i.test(root)
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
exports.activate = async function (context) {
    try {
        await startup('activation-enter'); await joinPinnedJsonBuiltin(); await startup('actual-require-start'); actual = require('../dist/extension.js'); await startup('actual-require-end');
        await startup('driver-require-start'); driver = require('./host/index.js'); await startup('driver-require-end');
        await startup('before-activate-start'); beforeActivateEnvironment = envSnapshot(); beforeActivatePending = true;
        if (typeof driver.beforeActivate !== 'function') throw Error('Native beforeActivate required.');
        await driver.beforeActivate(context); beforeActivatePending = false; startupOnly = false;
        await flushSetup(); await startup('before-activate-end');
        await startup('actual-activate-start'); await actual.activate(context); await startup('actual-activate-end');
    } catch (error) {
        const setupFailure = beforeActivatePending; startupOnly = false;
        await startup('activation-error');
        // Await real child close + both EOF + raw/row flush before editor close.
        // A stalled child keeps this promise and editor ownership alive; no
        // signal, pipe abort, timeout increase, new phase or guessed repair.
        try { await flushSetup(); await failure('activate', error, setupFailure); } finally { await close(); }
        return;
    }
    setTimeout(async () => { try { await startup('driver-run-start'); await driver.run(context); await startup('driver-run-end'); }
        catch (error) { await startup('driver-error'); await failure('run', error); } finally { await close(); } }, 1500);
};
exports.deactivate = function (...args) { return typeof actual?.deactivate === 'function' ? actual.deactivate(...args) : undefined; };
'@
$taskBootstrapPath=Join-Path $taskSnapshot 'dist-test/native-bootstrap.cjs';Write-F26ANewBytes $taskBootstrapPath ([Text.UTF8Encoding]::new($false).GetBytes($taskBootstrap))
Write-F26ANewBytes (Join-Path $taskWorkspace '.synthetic-lite-f26a-precommit-host') ([Text.UTF8Encoding]::new($false).GetBytes('synthetic-only-v1'))
$taskGlobalConfig=Join-Path $taskProfile 'empty-global.gitconfig';$taskSystemConfig=Join-Path $taskProfile 'empty-system.gitconfig'
Write-F26ANewBytes $taskGlobalConfig ([byte[]]@());Write-F26ANewBytes $taskSystemConfig ([byte[]]@())
$taskSettings=@{'telemetry.telemetryLevel'='off';'update.mode'='none';'extensions.autoUpdate'=$false;'extensions.autoCheckUpdates'=$false;
 'chat.disableAIFeatures'=$true;'git.enabled'=$false;'git.autoRepositoryDetection'=$false;'git.openRepositoryInParentFolders'='never';
 'json.schemaDownload.enable'=$false;'typescript.disableAutomaticTypeAcquisition'=$true;'workbench.enableExperiments'=$false;'extensions.ignoreRecommendations'=$true;
 'soterai.cloud.enabled'=$false;'soterai.privacyMode'='local';'soterai.autoVaultMigration.enabled'=$false;'soterai.broker.autoStart'=$false;
 'soterai.lite.historyHooks.preCommit'=$false;'soterai.hardening.secretInventory'=$true;'soterai.hardening.capabilityReleaseGuard'=$true;
 'soterai.lite.outputRedactor'=$true;'soterai.lite.secretMatching'=$true;'soterai.lite.vaultMode'=$true;'soterai.lite.vaultRuntime'=$true}
Write-F26ANewJson (Join-Path $taskProfile 'User/settings.json') $taskSettings
$taskRuntimeBindings=@()
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskZip=[IO.Compression.ZipFile]::OpenRead($taskVsix)
try{foreach($taskRuntimeName in @('extension.js','local-ai-broker.js','soterai-mcp-server.js','pre-commit-client.js')){
 $taskRuntimeEntries=@($taskZip.Entries|Where-Object{$_.FullName -ceq ('extension/dist/'+$taskRuntimeName)})
 if($taskRuntimeEntries.Count -ne 1){throw 'Unique exact runtime entry required.'}
 $taskStream=$taskRuntimeEntries[0].Open();$taskDigest=[Security.Cryptography.SHA256]::Create()
 try{$taskRuntimeSha=([BitConverter]::ToString($taskDigest.ComputeHash($taskStream))).Replace('-','').ToLowerInvariant()}finally{$taskDigest.Dispose();$taskStream.Dispose()}
 $taskRuntimeBindings+=@{name=$taskRuntimeName;bytes=$taskRuntimeEntries[0].Length;sha256=$taskRuntimeSha;source=(Join-Path $taskSource ('dist/'+$taskRuntimeName));execution=(Join-Path $taskSnapshot ('dist/'+$taskRuntimeName))}
}}finally{$taskZip.Dispose()}
if(@($taskRuntimeBindings|Where-Object{$_.name -ceq 'pre-commit-client.js' -and $_.sha256 -ceq $taskWorkerExpected}).Count -ne 1){throw 'Fourth runtime worker identity differs.'}
$taskManifestExpected=Get-F26ASha $taskManifestPath;$taskBootstrapExpected=Get-F26ASha $taskBootstrapPath
function Assert-F26ANative04Binding {
 Assert-F26AFile (Join-Path $PSScriptRoot 'native09-current-binding-01.json') '9a6e8cac4f1ef74618565faf9c4bb5c6f71e0f36b2f7c6f755996d685d131616' 254196
 $taskCurrentBinding=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native09-current-binding-01.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskCurrentBinding.status -cne 'F26A_CURRENT1076_NATIVE09_BOUND_NOT_AUTHORIZED_NOT_RUN' -or $taskCurrentBinding.fileCount -ne 1076){throw 'Current1076 exact F26a supplementary binding required.'}
 foreach($taskCurrentFact in $taskCurrentBinding.facts){Assert-F26AFile (Join-Path $taskRepo $taskCurrentFact.path) $taskCurrentFact.sha256 $taskCurrentFact.bytes}
}
function Assert-F26ANativeRuntimes {
 Assert-F26AEditorHost
 Assert-F26ANative04Binding
 Assert-F26AFile $taskOfflineHelper $taskOfflineExpected;Assert-F26AFile $PSCommandPath $taskLauncherExpected
 Assert-F15bRuntimeBinding -VsixPath $taskVsix -ExpectedVsixSha256 $taskExpectedVsix -ExtensionRoot $taskSource -ExpectedBundleSha256 $taskExpected
 Assert-F26AFile $CodePath $taskCodeExpected 238751552;Assert-F26AFile $taskGit $taskGitExpected 46480
 foreach($taskDriverInput in @($taskHost,$taskProbe)){Assert-F26AFile $taskDriverInput $taskDriverExpected 74473}
 foreach($taskBinding in $taskRuntimeBindings){foreach($taskFile in @($taskBinding.source,$taskBinding.execution)){Assert-F26AFile $taskFile $taskBinding.sha256 $taskBinding.bytes}}
 Assert-F26AFile $taskManifestPath $taskManifestExpected;Assert-F26AFile $taskBootstrapPath $taskBootstrapExpected
}
Assert-F26ANativeRuntimes
Write-F26ANewJson (Join-Path $taskRun 'freeze.json') @{schemaVersion=1;createdAt=[DateTime]::UtcNow.ToString('o');syntheticOnly=$true;phases=@('primary','restart');expectedChecks=@{primary=30;restart=4};executionEvidenceRoot=$taskExecution;
 sourceExtension=$taskSource;executionExtension=$taskSnapshot;profile=$taskProfile;workspace=$taskWorkspace;exactVsix=$taskVsix;vsixSha256=$taskExpectedVsix;extensionBundleSha256=$taskExpected;workerSha256=$taskWorkerExpected;
 runtimeBindings=$taskRuntimeBindings;codeExecutableSha256=$taskCodeExpected;codeProductVersion=([Diagnostics.FileVersionInfo]::GetVersionInfo($CodePath)).ProductVersion;hostProbeSha256=$taskDriverExpected;
 sourceManifestSha256=(Get-F26ASha (Join-Path $taskRun 'original-manifest.json'));fixtureManifestSha256=$taskManifestExpected;bootstrapSha256=$taskBootstrapExpected;
 semanticFreezeSha256='96c822673ea43cd246bb116b8232cefd86d9ab5448f0793d11e16455552dca6a';driverProvenanceSha256='2e454f5001d0c467c533f162e98c7360d70a677f75806acda713c2b6b5d7677e';
 offlineHelperSha256=$taskOfflineExpected;launcherSha256=$taskLauncherExpected;limitation='Exact VSIX four runtimes under documented developer bootstrap. Scripted native API owner decisions LOW; no human, OS confinement, credential validity or inferred nested-client closure.'}
function Assert-F26AResult($Observed,[string]$Phase){
 $taskCount=if($Phase -ceq 'primary'){30}else{4};$taskScopes=$taskSemanticFreeze.$Phase
 if($Observed.schemaVersion -ne 1 -or $Observed.syntheticOnly -ne $true -or $Observed.phase -cne $Phase -or $Observed.expectedChecks -ne $taskCount -or $Observed.passed -ne $taskCount -or @($Observed.observations).Count -ne $taskCount -or $Observed.failed -ne 0 -or $Observed.notRun -ne 0 -or $Observed.driverFailure){throw 'Exact native30+4 assertions are incomplete or failed.'}
 for($taskIndex=0;$taskIndex -lt $taskCount;$taskIndex++){
  $taskPrefix=if($Phase -ceq 'primary'){'F26A-HP'}else{'F26A-HR'};$taskId=$taskPrefix+($taskIndex+1).ToString('00');$taskRow=$Observed.observations[$taskIndex]
  if($taskRow.id -cne $taskId -or $taskRow.scope -cne $taskScopes[$taskIndex] -or $taskRow.status -cne 'PASS'){throw 'Distinct exact frozen observation IDs/scopes required.'}
 }
 if($Observed.extensionBundleSha256 -cne $taskExpected -or $Observed.workerSha256 -cne $taskWorkerExpected -or $Observed.hostProbeSha256 -cne $taskDriverExpected -or $Observed.codeSha256 -cne $taskCodeExpected -or $Observed.hostVersion -cne '1.144.0'){throw 'Native result runtime/driver/Code identities differ.'}
 if(@($Observed.runtimeBindings).Count -ne 4 -or @($Observed.currentRuntimeBindings).Count -ne 4){throw 'Four actual native runtime bindings required.'}
 foreach($taskBinding in $taskRuntimeBindings){foreach($taskField in @('runtimeBindings','currentRuntimeBindings')){
  $taskRows=@($Observed.$taskField|Where-Object{$_.file -ceq $taskBinding.name});if($taskRows.Count -ne 1 -or $taskRows[0].sha256 -cne $taskBinding.sha256 -or $taskRows[0].bytes -ne $taskBinding.bytes){throw 'Actual native runtime inventory changed.'}
 }}
 if($Observed.executionManifest.sha256 -cne $taskManifestExpected -or $Observed.currentExecutionManifest.sha256 -cne $taskManifestExpected -or $Observed.busyChildren -ne 0 -or $Observed.timedOutChildren -ne 0 -or $Observed.sourceDocuments -ne 0 -or $Observed.sourceDocumentEvents -ne 0 -or $Observed.directWorktreeReads -ne 0 -or $Observed.directObjectReads -ne 0 -or $Observed.metadataLeak -ne $false -or $Observed.parentEnvironmentUnchanged -ne $true -or $Observed.independence -cne 'LOW'){throw 'Actual native closure/custody/privacy evidence differs.'}
 foreach($taskChild in $Observed.children){
  if($taskChild.closed -ne $true -or $taskChild.stdoutEOF -ne $true -or $taskChild.stderrEOF -ne $true -or $taskChild.signalsRequested -ne 0 -or $taskChild.signal -ne $null -or $taskChild.busy -ne $false -or $taskChild.timedOut -ne $false -or $taskChild.spawnFailed -ne $false -or $taskChild.streamError -ne $false -or $taskChild.overflow -ne $false -or $taskChild.argumentsValid -ne $true -or $taskChild.environmentValid -ne $true -or $taskChild.parentEnvironmentUnchanged -ne $true -or $taskChild.invalidInput -ne $false){throw 'A real owned child lacks exact natural closure or safe argv/env evidence.'}
 }
 if($Phase -ceq 'primary' -and $Observed.readyForInterphase -ne $true){throw 'Primary did not retain the exact offline restart basis.'}
 if($Phase -ceq 'restart' -and $Observed.interphaseEvidence -cne 'ACTUAL_LAUNCHER_RECEIPT_VALIDATED'){throw 'Restart did not validate the actual offline receipt.'}
}
$taskResults=@()
foreach($taskPhase in @('primary','restart')){
 Assert-F26ANativeRuntimes
 $taskInfo=New-Object Diagnostics.ProcessStartInfo;$taskInfo.FileName=[IO.Path]::GetFullPath($CodePath)
 $taskArgs=@("--extensionDevelopmentPath=$taskSnapshot","--user-data-dir=$taskProfile","--extensions-dir=$taskInstalled",'--new-window','--disable-extensions',
  '--disable-extension=vscode.git','--disable-extension=vscode.github','--disable-extension=vscode.github-authentication','--disable-extension=vscode.microsoft-authentication',
  '--disable-extension=vscode.typescript-language-features','--disable-extension=vscode.npm','--disable-extension=vscode.extension-editing','--disable-workspace-trust',
  '--disable-gpu','--disable-updates','--skip-welcome','--skip-release-notes',$taskWorkspace)
 $taskInfo.Arguments=(($taskArgs|ForEach-Object{if($_ -match '"'){throw 'Invalid Code argument.'};'"'+$_+'"'}) -join ' ')
 $taskInfo.WorkingDirectory=$taskWorkspace;$taskInfo.UseShellExecute=$false;$taskInfo.CreateNoWindow=$true;$taskInfo.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden
 $taskInfo.RedirectStandardOutput=$true;$taskInfo.RedirectStandardError=$true;$taskInfo.EnvironmentVariables.Clear()
 foreach($taskSystemName in @('SystemRoot','WINDIR','COMSPEC')){$taskSystemValue=[Environment]::GetEnvironmentVariable($taskSystemName);if($taskSystemValue){$taskInfo.EnvironmentVariables[$taskSystemName]=$taskSystemValue}}
 $taskInfo.EnvironmentVariables['TEMP']=Join-Path $taskProfile 'Temp';$taskInfo.EnvironmentVariables['TMP']=Join-Path $taskProfile 'Temp'
 foreach($taskNameKey in @('HOME','USERPROFILE','XDG_CONFIG_HOME')){$taskInfo.EnvironmentVariables[$taskNameKey]=$taskProfile}
 $taskInfo.EnvironmentVariables['GIT_CONFIG_GLOBAL']=$taskGlobalConfig;$taskInfo.EnvironmentVariables['GIT_CONFIG_SYSTEM']=$taskSystemConfig;$taskInfo.EnvironmentVariables['GIT_CONFIG_NOSYSTEM']='1'
 $taskInfo.EnvironmentVariables['APPDATA']=Join-Path $taskProfile 'AppData/Roaming';$taskInfo.EnvironmentVariables['LOCALAPPDATA']=Join-Path $taskProfile 'AppData/Local'
 $taskResult=Join-Path $taskExecution ($taskPhase+'-results.json')
 $taskInfo.EnvironmentVariables['SOTERAI_LITE_F26A_HOOK_PROFILE']=$taskProfile;$taskInfo.EnvironmentVariables['SOTERAI_LITE_F26A_HOOK_EVIDENCE']=$taskResult
 $taskInfo.EnvironmentVariables['SOTERAI_LITE_F26A_HOOK_PHASE']=$taskPhase;$taskInfo.EnvironmentVariables['SOTERAI_LITE_F26A_HOOK_BUNDLE_SHA256']=$taskExpected
 $taskInfo.EnvironmentVariables['SOTERAI_LITE_F26A_HOOK_WORKER_SHA256']=$taskWorkerExpected;$taskInfo.EnvironmentVariables['SOTERAI_LITE_F26A_HOOK_DRIVER_KIND']='native-bootstrap'
 $taskProcess=New-Object Diagnostics.Process;$taskProcess.StartInfo=$taskInfo;$taskStarted=$false
 try{
  [void]$taskProcess.Start();$taskStarted=$true;$taskPid=$taskProcess.Id;$taskStart=$taskProcess.StartTime.ToUniversalTime().ToString('o')
  Write-F26ANewJson (Join-Path $taskRun ($taskPhase+'-owned-editor-start.json')) @{schemaVersion=1;pid=$taskPid;startUtc=$taskStart;executable=$CodePath;args=$taskArgs;profile=$taskProfile;workspace=$taskWorkspace;signalsRequested=0}
  $taskOut=$taskProcess.StandardOutput.ReadToEndAsync();$taskErr=$taskProcess.StandardError.ReadToEndAsync();$taskTimer=[Diagnostics.Stopwatch]::StartNew()
  while(-not $taskProcess.WaitForExit(1000) -and $taskTimer.Elapsed.TotalSeconds -lt 540){}
  $taskTimeout=-not $taskProcess.HasExited;$taskDrain=[Diagnostics.Stopwatch]::StartNew()
  while(-not $taskTimeout -and (-not $taskOut.IsCompleted -or -not $taskErr.IsCompleted) -and $taskDrain.ElapsedMilliseconds -lt 2000){Start-Sleep -Milliseconds 20}
  $taskDrainUnconfirmed=-not $taskOut.IsCompleted -or -not $taskErr.IsCompleted
  if($taskTimeout -or $taskDrainUnconfirmed){
   Write-F26ANewJson (Join-Path $taskRun ($taskPhase+'-owned-editor-pending.json')) @{status='STOP_UNCONFIRMED';pid=$taskPid;observedExit=$taskProcess.HasExited;stdoutEOF=$taskOut.IsCompleted;stderrEOF=$taskErr.IsCompleted;signalsRequested=0;timedOut=$taskTimeout;ownership='RETAIN_PROCESS_AND_PIPE_READERS_UNTIL_NATURAL_CLOSE_AND_BOTH_EOF_NO_LATER_PHASE'}
   while(-not $taskProcess.HasExited -or -not $taskOut.IsCompleted -or -not $taskErr.IsCompleted){if(-not $taskProcess.HasExited){[void]$taskProcess.WaitForExit(1000)}else{Start-Sleep -Milliseconds 20}}
  }
  $taskOutPath=Join-Path $taskRun ($taskPhase+'-stdout.txt');$taskErrPath=Join-Path $taskRun ($taskPhase+'-stderr.txt')
  $taskOutText=if($taskOut.IsCompleted){$taskOut.GetAwaiter().GetResult()}else{'INCOMPLETE stdout drain'}
  $taskErrText=if($taskErr.IsCompleted){$taskErr.GetAwaiter().GetResult()}else{'INCOMPLETE stderr drain'}
  Write-F26ANewBytes $taskOutPath ([Text.UTF8Encoding]::new($false).GetBytes($taskOutText));Write-F26ANewBytes $taskErrPath ([Text.UTF8Encoding]::new($false).GetBytes($taskErrText))
  $taskClose=@{observedExit=$taskProcess.HasExited;exitCode=$(if($taskProcess.HasExited){$taskProcess.ExitCode}else{$null});stdoutEOF=$taskOut.IsCompleted;stderrEOF=$taskErr.IsCompleted;signalsRequested=0;
   ownedWindowClose='workbench.action.closeWindow';executable=[IO.Path]::GetFullPath($CodePath);pid=$taskPid;pidAbsentTwice=$false;streamsStable=$false;timedOut=$taskTimeout}
  Write-F26ANewJson (Join-Path $taskRun ($taskPhase+'-owned-editor-close.json')) $taskClose
  foreach($taskSuffix in @('.driver-error.json','.startup.jsonl')){if(Test-Path -LiteralPath ($taskResult+$taskSuffix)){Copy-F26ANew ($taskResult+$taskSuffix) (Join-Path $taskRun ($taskPhase+$taskSuffix))}}
  if(Test-Path -LiteralPath $taskResult){Copy-F26ANew $taskResult (Join-Path $taskRun ($taskPhase+'-results.json'))}
  # Fixed-name vendor-startup metadata only; no JSON-server streams or env values.
  $taskJsonStartup=$taskResult+'.json-builtin-startup.json'
  if(Test-Path -LiteralPath $taskJsonStartup){
   if((Get-Item -LiteralPath $taskJsonStartup).Length -gt 65536){throw 'Vendor JSON startup metadata bound exceeded.'}
   Copy-F26ANew $taskJsonStartup (Join-Path $taskRun ($taskPhase+'-results.json.json-builtin-startup.json'))
  }

  # Diagnostic copies are restricted to this phase's public setup observer files.
  $taskSetupPrefix=[regex]::Escape($taskPhase+'-results.json')
  $taskSetupFiles=@(Get-ChildItem -LiteralPath $taskExecution -File|Where-Object{$_.Name -match ('^'+$taskSetupPrefix+'[.]setup-(child-[0-9]{2}(-stdout|-stderr)[.]bin|child-[0-9]{2}[.]json|observer-summary[.]json)$')})
  if($taskSetupFiles.Count -gt 16){throw 'Public setup diagnostic file count exceeded.'}
  foreach($taskSetupFile in $taskSetupFiles){
   $taskSetupCap=if($taskSetupFile.Name -match '-stdout[.]bin$'){4096}elseif($taskSetupFile.Name -match '-stderr[.]bin$'){8192}elseif($taskSetupFile.Name -match 'observer-summary[.]json$'){262144}else{65536}
   if($taskSetupFile.Length -gt $taskSetupCap){throw 'Public setup diagnostic bound exceeded.'}
   Copy-F26ANew $taskSetupFile.FullName (Join-Path $taskRun $taskSetupFile.Name)
  }

  if($taskTimeout -or $taskDrainUnconfirmed){throw 'STOP_UNCONFIRMED retained without signals or pipe destruction until actual natural closure; no later launch.'}
  if(-not $taskOut.IsCompleted -or -not $taskErr.IsCompleted -or $taskProcess.ExitCode -ne 0 -or -not(Test-Path -LiteralPath $taskResult)){throw 'INCOMPLETE actual Code exit0/bothEOF/result; no offline or restart launch.'}
  if(Test-Path -LiteralPath ($taskResult+'.driver-error.json')){throw 'Native driver error retained; no further phase.'}
  $taskObserved=Get-Content -LiteralPath $taskResult -Raw -Encoding UTF8|ConvertFrom-Json;Assert-F26AResult $taskObserved $taskPhase
  $taskAbsence=@();$taskStable=@()
  foreach($taskObservation in @(1,2)){
   if($taskObservation -eq 2){Start-Sleep -Milliseconds 250}
   $taskPresent=Get-Process -Id $taskPid -ErrorAction SilentlyContinue
   $taskAbsence+=@{pid=$taskPid;absent=($null -eq $taskPresent);observedAt=[DateTime]::UtcNow.ToString('o')}
   $taskStable+=@{stdout=(Get-F26ASha $taskOutPath);stderr=(Get-F26ASha $taskErrPath)}
  }
  if(@($taskAbsence|Where-Object{$_.absent -ne $true}).Count -ne 0 -or $taskStable[0].stdout -cne $taskStable[1].stdout -or $taskStable[0].stderr -cne $taskStable[1].stderr){throw 'Actual owned PID absence twice or stable streams unconfirmed; no later launch.'}
  $taskClose.pidAbsentTwice=$true;$taskClose.streamsStable=$true;$taskClose.pidAbsenceObservations=$taskAbsence
  $taskClose.streams=@(@{path=$taskOutPath;bytes=(Get-Item -LiteralPath $taskOutPath).Length;sha256=$taskStable[1].stdout},@{path=$taskErrPath;bytes=(Get-Item -LiteralPath $taskErrPath).Length;sha256=$taskStable[1].stderr})
  Write-F26ANewJson (Join-Path $taskRun ($taskPhase+'-owned-editor-absence.json')) $taskClose
  Assert-F26ANativeRuntimes
  $taskResults+=@{phase=$taskPhase;passed=$(if($taskPhase -ceq 'primary'){30}else{4});result=$taskResult;sha256=(Get-F26ASha $taskResult);actualCodeClosure=(Join-Path $taskRun ($taskPhase+'-owned-editor-absence.json'))}
  if($taskPhase -ceq 'primary'){
   $taskState=Join-Path $taskExecution 'precommit-restart-state.json';if(-not(Test-Path -LiteralPath $taskState)){throw 'Primary restart basis missing.'}
   Copy-F26ANew $taskState (Join-Path $taskRun 'precommit-restart-state.json')
   $taskOfflineEnvironment=[ordered]@{};foreach($taskEnvName in @('HOME','USERPROFILE','XDG_CONFIG_HOME','GIT_CONFIG_GLOBAL','GIT_CONFIG_SYSTEM','GIT_CONFIG_NOSYSTEM','SystemRoot','WINDIR','COMSPEC')){if($taskInfo.EnvironmentVariables.ContainsKey($taskEnvName)){$taskOfflineEnvironment[$taskEnvName]=$taskInfo.EnvironmentVariables[$taskEnvName]}}
   $taskPrimaryState=Get-Content -LiteralPath $taskState -Raw -Encoding UTF8|ConvertFrom-Json
   $taskOfflineRoot=[string]$taskPrimaryState.root
   if($taskOfflineRoot -notmatch '^D:\\SoterAI-Lite-test-profiles\\f26a-precommit-native-[0-9TZ]+-[a-f0-9]{8}\\workspace$' -or $taskOfflineRoot.Substring(2) -cne $taskWorkspace.Substring(2)){throw 'Only exact primary workspace and initial drive-letter case equivalence are admitted.'}
   $taskOfflineInput=Join-Path $taskRun 'offline-input.json'
   Write-F26ANewJson $taskOfflineInput @{schemaVersion=1;syntheticOnly=$true;parent=$taskExecution;root=$taskOfflineRoot;profile=$taskProfile;primaryStateSha256=(Get-F26ASha $taskState);primaryResult=$taskResult;code=$taskClose;codeEnvironment=$taskOfflineEnvironment}
   $taskOfflineNode=(Get-Command node.exe -ErrorAction Stop).Source;$taskOfflineInfo=New-Object Diagnostics.ProcessStartInfo
   $taskOfflineInfo.FileName=$taskOfflineNode;$taskOfflineInfo.Arguments='"'+$taskOfflineHelper+'" "'+$taskOfflineInput+'"';$taskOfflineInfo.WorkingDirectory=$taskWorkspace
   $taskOfflineInfo.UseShellExecute=$false;$taskOfflineInfo.CreateNoWindow=$true;$taskOfflineInfo.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden;$taskOfflineInfo.RedirectStandardOutput=$true;$taskOfflineInfo.RedirectStandardError=$true
   $taskOfflineInfo.EnvironmentVariables.Clear();foreach($taskEnvName in @('SystemRoot','WINDIR','COMSPEC')){if($taskInfo.EnvironmentVariables.ContainsKey($taskEnvName)){$taskOfflineInfo.EnvironmentVariables[$taskEnvName]=$taskInfo.EnvironmentVariables[$taskEnvName]}}
   $taskOfflineInfo.EnvironmentVariables['TEMP']=Join-Path $taskProfile 'Temp';$taskOfflineInfo.EnvironmentVariables['TMP']=Join-Path $taskProfile 'Temp';$taskOfflineInfo.EnvironmentVariables['HOME']=$taskProfile;$taskOfflineInfo.EnvironmentVariables['USERPROFILE']=$taskProfile
   $taskOfflineProcess=New-Object Diagnostics.Process;$taskOfflineProcess.StartInfo=$taskOfflineInfo;$taskOfflineStarted=$false
   try{
    [void]$taskOfflineProcess.Start();$taskOfflineStarted=$true;Write-F26ANewJson (Join-Path $taskRun 'offline-helper-start.json') @{pid=$taskOfflineProcess.Id;startUtc=$taskOfflineProcess.StartTime.ToUniversalTime().ToString('o');executable=$taskOfflineNode;script=$taskOfflineHelper;scriptSha256=(Get-F26ASha $taskOfflineHelper);input=$taskOfflineInput;signalsRequested=0}
    $taskOfflineOut=$taskOfflineProcess.StandardOutput.ReadToEndAsync();$taskOfflineErr=$taskOfflineProcess.StandardError.ReadToEndAsync();$taskOfflineTimer=[Diagnostics.Stopwatch]::StartNew()
    while(-not $taskOfflineProcess.WaitForExit(1000) -and $taskOfflineTimer.Elapsed.TotalSeconds -lt 120){}
    $taskOfflineTimeout=-not $taskOfflineProcess.HasExited;$taskOfflineDrain=[Diagnostics.Stopwatch]::StartNew()
    while(-not $taskOfflineTimeout -and (-not $taskOfflineOut.IsCompleted -or -not $taskOfflineErr.IsCompleted) -and $taskOfflineDrain.ElapsedMilliseconds -lt 2000){Start-Sleep -Milliseconds 20}
    $taskOfflineDrainUnconfirmed=-not $taskOfflineOut.IsCompleted -or -not $taskOfflineErr.IsCompleted
    if($taskOfflineTimeout -or $taskOfflineDrainUnconfirmed){
     Write-F26ANewJson (Join-Path $taskRun 'offline-helper-pending.json') @{status='STOP_UNCONFIRMED';pid=$taskOfflineProcess.Id;observedExit=$taskOfflineProcess.HasExited;stdoutEOF=$taskOfflineOut.IsCompleted;stderrEOF=$taskOfflineErr.IsCompleted;signalsRequested=0;timedOut=$taskOfflineTimeout;ownership='RETAIN_HELPER_GIT_AND_PIPE_READERS_UNTIL_NATURAL_CLOSE_AND_BOTH_EOF_NO_RESTART'}
     while(-not $taskOfflineProcess.HasExited -or -not $taskOfflineOut.IsCompleted -or -not $taskOfflineErr.IsCompleted){if(-not $taskOfflineProcess.HasExited){[void]$taskOfflineProcess.WaitForExit(1000)}else{Start-Sleep -Milliseconds 20}}
    }
    Write-F26ANewJson (Join-Path $taskRun 'offline-helper-close.json') @{observedExit=$taskOfflineProcess.HasExited;exitCode=$(if($taskOfflineProcess.HasExited){$taskOfflineProcess.ExitCode}else{$null});stdoutEOF=$taskOfflineOut.IsCompleted;stderrEOF=$taskOfflineErr.IsCompleted;signalsRequested=0;timedOut=$taskOfflineTimeout}
    $taskOfflineOutText=if($taskOfflineOut.IsCompleted){$taskOfflineOut.GetAwaiter().GetResult()}else{'INCOMPLETE stdout'};$taskOfflineErrText=if($taskOfflineErr.IsCompleted){$taskOfflineErr.GetAwaiter().GetResult()}else{'INCOMPLETE stderr'}
    Write-F26ANewBytes (Join-Path $taskRun 'offline-helper-stdout.txt') ([Text.UTF8Encoding]::new($false).GetBytes($taskOfflineOutText));Write-F26ANewBytes (Join-Path $taskRun 'offline-helper-stderr.txt') ([Text.UTF8Encoding]::new($false).GetBytes($taskOfflineErrText))
    if($taskOfflineTimeout -or $taskOfflineDrainUnconfirmed -or -not $taskOfflineOut.IsCompleted -or -not $taskOfflineErr.IsCompleted){throw 'STOP_UNCONFIRMED: offline helper/Git retained until actual closure, no pipe abort/restart/signals.'}
    if($taskOfflineProcess.ExitCode -ne 0){throw 'Actual offline owner probe failed; no restart.'}
   }finally{if(-not $taskOfflineStarted -or ($taskOfflineProcess.HasExited -and $taskOfflineOut.IsCompleted -and $taskOfflineErr.IsCompleted)){$taskOfflineProcess.Dispose()}}
   foreach($taskOfflineName in @('precommit-owner-absent.json','precommit-owner-absent-child-start.json','precommit-owner-absent-stdout.bin','precommit-owner-absent-stderr.bin')){Copy-F26ANew (Join-Path $taskExecution $taskOfflineName) (Join-Path $taskRun $taskOfflineName)}
   $taskAbsent=Get-Content -LiteralPath (Join-Path $taskExecution 'precommit-owner-absent.json') -Raw -Encoding UTF8|ConvertFrom-Json
   if($taskAbsent.status -cne 'ACTUAL_OWNER_ABSENT_BLOCKED' -or $taskAbsent.owner.closed -ne $true -or $taskAbsent.owner.stdoutEOF -ne $true -or $taskAbsent.owner.stderrEOF -ne $true -or $taskAbsent.owner.signalsRequested -ne 0 -or $taskAbsent.owner.timedOut -ne $false -or $taskAbsent.owner.exitCode -eq 0 -or $taskAbsent.primaryStateSha256 -cne (Get-F26ASha $taskState)){throw 'Actual offline blocked/state/closure proof missing; no restart.'}
   Assert-F26ANativeRuntimes
  }
 }finally{if(-not $taskStarted -or ($taskProcess.HasExited -and $taskOut.IsCompleted -and $taskErr.IsCompleted)){$taskProcess.Dispose()}}
}
Write-F26ANewJson (Join-Path $taskRun 'summary.json') @{status='PASS_SCOPED';nativeChecks=34;phases=$taskResults;extensionBundleSha256=$taskExpected;workerSha256=$taskWorkerExpected;vsixSha256=$taskExpectedVsix;
 actualOfflineEvidence=(Join-Path $taskExecution 'precommit-owner-absent.json');independence='LOW';ownerPresence='SCRIPTED_NATIVE_API_DECISIONS_NOT_HUMAN_REVIEW';nestedClientClosure='NOT_INFERRED_FROM_OWNER_GIT;SEE_SEPARATE_DIRECT_CLIENT_CONTROLS'}
Write-Output ('Native owning-editor hook evidence: '+$taskRun)
