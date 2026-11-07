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
const jsonBuiltinAppRoot = "C:\\Users\\USER\\AppData\\Local\\Programs\\Microsoft VS Code\\e646868227\\resources\\app";
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
