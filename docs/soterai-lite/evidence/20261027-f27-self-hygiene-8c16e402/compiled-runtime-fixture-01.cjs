// PREPARED_NOT_EXECUTED. Actual exact packaged children; never import a product runtime.
// One attempt, immutable evidence, bounded both-pipe collection, owner IPC/stdin EOF only.
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const cp = require('node:child_process'), http = require('node:http'), assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '../../../..'), H = 'docs/soterai-lite/evidence/20261027-f27-self-hygiene-8c16e402/';
const PROOF = { path: H + 'full-inputs-04.json', bytes: 197439, sha256: 'aec34a157a5d2b44a4d2040a4f469a029719f09b34b167ff26835daa77b782a8' };
const NODE = { path: 'C:/Program Files/nodejs/node.exe', bytes: 85119640, sha256: 'c5ff4c736112dd483c750fd4149d30c8a116db1a49b8b3ec88be4b65e6c86c19' };
const AUDITOR = { path: 'packages/soterai-lite/scripts/audit-release.cjs', bytes: 13441, sha256: '1e1bc1bb7c378b0d2e8f1293d30acbef06c302fc091f90a3a2414b20b73ce991' };
const HOST = { path: 'docs/soterai-lite/evidence/20261026-f26c-psreadline-53a78b20/host-version-review-proposal06.json', bytes: 11044, sha256: '8d0260e8f45fd0002fe0b1eab1d01e3448906aed9b42701013bb42cd34e939e6' };
const RECEIPTS = ['compiler-06', 'backend-typecheck-03', 'backend-tests-03', 'full-tests-02', 'readiness-02', 'package-01'];
const RUNTIMES = ['extension.js', 'local-ai-broker.js', 'pre-commit-client.js', 'soterai-mcp-server.js'];
const CANARY = 'F27_SYNTHETIC_ONLY_DIAGNOSTIC_8c16e402', PIPE_CAP = 256 * 1024, PHASE_MS = 20000;
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const equalPath = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const relative = value => {
    assert(typeof value === 'string' && value.length <= 1024 && !/[\\:\x00-\x1f\x7f]/.test(value));
    assert(!path.isAbsolute(value) && value.split('/').every(part => part && part !== '.' && part !== '..'));
    const file = path.resolve(ROOT, value); assert(file.startsWith(ROOT + path.sep)); return file;
};
function ordinary(file, directory = false) {
    const resolved = path.resolve(file), volume = path.parse(resolved).root;
    for (let cursor = resolved;; cursor = path.dirname(cursor)) {
        const info = fs.lstatSync(cursor); assert(!info.isSymbolicLink());
        assert(equalPath(fs.realpathSync(cursor), cursor));
        if (cursor === resolved) assert(directory ? info.isDirectory() : info.isFile() && info.nlink === 1);
        else assert(info.isDirectory());
        if (equalPath(cursor, volume)) break;
    }
    return fs.lstatSync(resolved);
}
async function pin(record, external = false) {
    assert(record && Number.isSafeInteger(record.bytes) && record.bytes >= 0 && /^[a-f0-9]{64}$/.test(record.sha256));
    const file = external ? path.resolve(record.path) : relative(record.path), before = ordinary(file);
    assert.equal(before.size, record.bytes); const hash = crypto.createHash('sha256'); let bytes = 0;
    for await (const chunk of fs.createReadStream(file)) { bytes += chunk.length; assert(bytes <= record.bytes); hash.update(chunk); }
    const after = ordinary(file); assert.equal(bytes, record.bytes); assert.equal(hash.digest('hex'), record.sha256);
    for (const key of ['size', 'ino', 'mtimeMs', 'ctimeMs']) assert.equal(after[key], before[key]);
    return file;
}
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
function noPrivate(raw, privateValues) {
    const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : raw;
    for (const value of privateValues) {
        assert(!text.includes(value)); assert(!text.includes(value.replaceAll('\\', '\\\\')));
        assert(!text.includes(encodeURIComponent(value)));
    }
}
async function sourceGuard() {
    await pin(PROOF); const proof = read(relative(PROOF.path));
    assert.equal(proof.fileCount, 1016); assert.equal(proof.files.length, 1016);
    const seen = new Set(); for (const item of proof.files) { assert(!seen.has(item.path)); seen.add(item.path); await pin(item); }
}
async function guard(bindingFile, bindingHash) {
    assert(/^[a-f0-9]{64}$/.test(bindingHash)); ordinary(bindingFile);
    const bindingRaw = fs.readFileSync(bindingFile); assert.equal(sha(bindingRaw), bindingHash); const b = read(bindingFile);
    assert.equal(b.schemaVersion, 1); assert.equal(b.status, 'BOUND_CURRENT_F27_PROOF04_SERIAL04_EXACT_ATTEMPT01_RUNTIME_NOT_RUN');
    assert.equal(b.feature, 'F27'); assert.equal(b.fileCount, 1016); assert.equal(b.native06, 'F26a_USER_DEFERRED_NOT_RUN');
    assert.deepEqual(b.sourceProof, PROOF); assert.deepEqual(b.node, NODE); assert.deepEqual(b.auditor, AUDITOR); assert.deepEqual(b.hostReview, HOST);
    assert.equal(relative(b.fixture.path), __filename); await pin(b.fixture); await sourceGuard();
    await pin(NODE, true); assert(equalPath(process.execPath, NODE.path)); await pin(AUDITOR); await pin(HOST);
    const host = read(relative(HOST.path)).currentHost;
    assert.equal(host.version, '1.143.1'); assert.equal(host.executable.sha256, '325fb30ba28d17fa6ba4df58043727b2469aca9d641793a65e413721b2110ec6');
    for (const item of [host.executable, ...host.applicationFiles]) await pin(item, true);
    assert(Array.isArray(b.archiveDependencies) && b.archiveDependencies.length >= 2);
    for (const item of b.archiveDependencies) { assert(item.path.startsWith('node_modules/')); await pin(item); }
    for (const expected of ['node_modules/yauzl/index.js', 'node_modules/yauzl/package.json']) assert(b.archiveDependencies.some(item => item.path === expected));
    assert.deepEqual(b.requiredReceipts.map(group => group.name).sort(), [...RECEIPTS].sort());
    assert.equal(b.serialDriver.path, H + 'run-serial-04.cjs'); assert.equal(b.serialResult.path, H + 'serial-result-03.json');
    await pin(b.serialDriver); await pin(b.serialResult);
    const serial = read(relative(b.serialResult.path)); assert.equal(serial.status, 'SERIAL_CURRENT_F27_VERIFICATION_AND_PACKAGE_PASS_NATIVE_CONTENT_ACCEPTANCE_PENDING');
    assert.equal(serial.signalsRequested, 0); assert.deepEqual(serial.results.map(row => row.name), RECEIPTS);
    const outputs = new Map();
    for (const group of b.requiredReceipts) {
        for (const key of ['receipt', 'close', 'stdout', 'stderr']) await pin(group[key]);
        assert.equal(group.receipt.path, H + group.name + '.txt.result.json');
        assert.equal(group.close.path, H + group.name + '-owned-close.json');
        assert.equal(group.stdout.path, H + group.name + '-wrapper-stdout.bin'); assert.equal(group.stderr.path, H + group.name + '-wrapper-stderr.bin');
        const r = read(relative(group.receipt.path)), c = read(relative(group.close.path)); assert.equal(r.exitCode, 0);
        assert.deepEqual(serial.results.find(row => row.name === group.name), c);
        const output = path.isAbsolute(path.normalize(r.output)) ? path.relative(ROOT, path.normalize(r.output)).replaceAll('\\', '/') : r.output.replaceAll('\\', '/');
        assert.equal(output, H + group.name + '.txt'); const raw = fs.readFileSync(relative(output)); ordinary(relative(output));
        assert.equal(sha(raw), r.sha256.toLowerCase()); outputs.set(group.name, raw);
        assert.equal(c.status, 'PASS_CLOSED_WRAPPER_AND_CANONICAL_RECEIPT'); assert.equal(c.actualClose, true);
        for (const key of ['wrapperExit', 'innerExit', 'signalsRequested']) assert.equal(c[key], 0);
        assert.equal(c.signal, null); assert.equal(c.stdoutEOF, true); assert.equal(c.stderrEOF, true);
        for (const key of ['overflow', 'streamError', 'deadlineExceeded']) assert.equal(c[key], false);
        for (const name of ['stdout', 'stderr']) {
            const row = c.streams.find(item => item.name === name); assert(row); assert.equal(row.bytes, group[name].bytes); assert.equal(row.sha256, group[name].sha256);
        }
        assert(equalPath(r.file, NODE.path));
        if (group.name === 'full-tests-02' || group.name === 'backend-tests-03') {
            const text = raw.toString('utf8'); assert(/(?:^|\n)# tests [1-9][0-9]*\r?(?:\n|$)/.test(text));
            assert(/(?:^|\n)# fail 0\r?(?:\n|$)/.test(text)); assert(/(?:^|\n)# cancelled 0\r?(?:\n|$)/.test(text));
            assert(!/(?:^|\n)\s*not ok\b/.test(text));
        }
    }
    assert.equal(b.vsix.path, 'packages/soterai-lite/soterai-lite-0.7.0-f27-20261027-attempt01.vsix');
    await pin(b.vsix); await pin(b.buildProvenance); await pin(b.packageReceipt);
    const packed = outputs.get('package-01').toString('utf8').split(/\r?\n/).filter(line => line.startsWith('{')).map(line => JSON.parse(line)).filter(row => row.status === 'PACKAGED_NOT_HOST_VERIFIED');
    assert.equal(packed.length, 1); const p = packed[0]; assert.equal(p.output.replaceAll('\\', '/'), b.vsix.path); assert.equal(p.bytes, b.vsix.bytes); assert.equal(p.sha256, b.vsix.sha256);
    assert(/^[0-9TZ:.a-f-]+$/.test(p.runId));
    const attempt = 'packages/soterai-lite/builds/' + p.runId + '/'; assert.equal(b.buildProvenance.path, attempt + 'build-provenance.json'); assert.equal(b.packageReceipt.path, attempt + 'package-receipt.json');
    assert.deepEqual(read(relative(b.packageReceipt.path)), p);
    const { auditRelease } = require(relative(AUDITOR.path));
    const audit = await auditRelease({ repoRoot: ROOT, vsixPath: relative(b.vsix.path), expectedSha256: b.vsix.sha256, buildReceiptPath: relative(b.buildProvenance.path) });
    assert.equal(audit.report.entries.length, 15); assert.equal(audit.report.runtimes.length, 4);
    assert.deepEqual(b.entries, audit.report.entries);
    assert.deepEqual(b.runtimes.map(({ name, bytes, sha256 }) => ({ name, bytes, sha256 })), audit.report.runtimes.map(({ name, bytes, sha256 }) => ({ name, bytes, sha256 })));
    assert.deepEqual(b.runtimes.map(row => row.name).sort(), RUNTIMES);
    assert.equal(b.runtimes.find(row => row.name === 'extension.js').sha256, p.extensionSha256);
    await sourceGuard(); assert.equal(sha(fs.readFileSync(bindingFile)), bindingHash); return b;
}
async function extract(b, destination) {
    const yauzl = require('yauzl'), zip = await yauzl.fromBufferPromise(fs.readFileSync(relative(b.vsix.path)), { lazyEntries: true, validateEntrySizes: true, strictFileNames: true });
    let count = 0; const seen = new Set();
    try { for await (const entry of zip.eachEntry()) {
        const row = b.entries.find(item => item.path === entry.fileName); assert(row && !seen.has(row.path)); seen.add(row.path);
        assert(!path.isAbsolute(row.path) && row.path.split('/').every(part => part && part !== '.' && part !== '..'));
        const chunks = [], stream = await zip.openReadStreamPromise(entry); let size = 0;
        for await (const raw of stream) { size += raw.length; assert(size <= row.bytes && size <= 8 * 1024 * 1024); chunks.push(raw); }
        const raw = Buffer.concat(chunks); assert.equal(size, row.bytes); assert.equal(sha(raw), row.sha256);
        const target = path.resolve(destination, row.path); assert(target.startsWith(destination + path.sep));
        fs.mkdirSync(path.dirname(target), { recursive: true }); ordinary(path.dirname(target), true); fs.writeFileSync(target, raw, { flag: 'wx' }); count++;
    } } finally { zip.close(); }
    assert.equal(count, 15); const manifest = read(path.join(destination, 'extension/package.json')), name = 'soterai.lite.selfHygiene';
    assert.equal(manifest.contributes.configuration.properties[name].default, false); assert.equal(manifest.contributes.configuration.properties[name].scope, 'machine');
    assert(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes(name));
}
async function snapshotGuard(b, snapshot) {
    ordinary(snapshot, true);
    for (const row of b.entries) {
        const target = path.resolve(snapshot, row.path); assert(target.startsWith(snapshot + path.sep));
        await pin({ path: target, bytes: row.bytes, sha256: row.sha256 }, true);
    }
}
function environment(profile) {
    ordinary(profile, true); const env = { SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows' };
    for (const [name, suffix] of Object.entries({ TEMP: 'Temp', TMP: 'Temp', USERPROFILE: 'User', HOME: 'Home', APPDATA: 'AppData/Roaming', LOCALAPPDATA: 'AppData/Local', XDG_CONFIG_HOME: 'XdgConfig', XDG_DATA_HOME: 'XdgData' })) {
        env[name] = path.join(profile, suffix); fs.mkdirSync(env[name], { recursive: true }); ordinary(env[name], true);
    }
    return env;
}
async function owned({ name, runtime, cwd, env, ipc, run, action, stop, check }) {
    const streams = {}, state = { actualClose: false, actualExit: false, exitCode: null, signal: null, closeCode: null, closeSignal: null, overflow: false, streamError: false, spawnError: false, deadlineExceeded: false, stopRequested: false, stopDeliveryError: false };
    for (const channel of ['stdout', 'stderr']) {
        const file = path.join(run, name + '-' + channel + '.bin'); streams[channel] = { file, fd: fs.openSync(file, 'wx'), bytes: 0, observedBytes: 0, eof: false };
    }
    let child; try { child = cp.spawn(NODE.path, [runtime], { cwd, env, windowsHide: true, shell: false, stdio: ipc ? ['ignore', 'pipe', 'pipe', 'ipc'] : ['pipe', 'pipe', 'pipe'] }); }
    catch { for (const s of Object.values(streams)) fs.closeSync(s.fd); throw new Error('COMPILED_CHILD_SPAWN_UNAVAILABLE'); }
    let complete; const closed = new Promise(resolve => { complete = resolve; });
    const maybeComplete = () => { if (state.actualClose && streams.stdout.eof && streams.stderr.eof) complete(); };
    for (const channel of ['stdout', 'stderr']) {
        child[channel].on('data', raw => {
            const s = streams[channel]; s.observedBytes += raw.length; const remaining = PIPE_CAP - s.bytes;
            if (raw.length > remaining) state.overflow = true;
            if (remaining > 0) { const retained = raw.subarray(0, remaining); try { fs.writeSync(s.fd, retained); s.bytes += retained.length; } catch { state.streamError = true; } }
        });
        child[channel].on('end', () => { streams[channel].eof = true; maybeComplete(); }); child[channel].on('error', () => { state.streamError = true; });
    }
    child.once('error', () => { state.spawnError = true; }); child.stdin?.on('error', () => { state.streamError = true; });
    child.once('exit', (code, signal) => { state.actualExit = true; state.exitCode = code; state.signal = signal; });
    child.once('close', (code, signal) => { state.actualClose = true; state.closeCode = code; state.closeSignal = signal; maybeComplete(); });
    let stopCompleted = Promise.resolve();
    const graceful = () => {
        if (state.stopRequested) return; state.stopRequested = true;
        try { stopCompleted = Promise.resolve(stop(child, () => { state.stopDeliveryError = true; })).catch(() => { state.stopDeliveryError = true; }); } catch { state.stopDeliveryError = true; }
    };
    let setupFailed = false;
    try { writeJson(path.join(run, name + '-owned-start.json'), { status: 'STARTED_NOT_COMPLETED', observedAt: new Date().toISOString(), pid: child.pid ?? null, compiledRuntimeSha256: sha(fs.readFileSync(runtime)), gracefulStop: ipc ? 'OWNER_IPC_STOP' : 'STDIN_EOF', signalsRequested: 0 }); }
    catch { setupFailed = true; state.streamError = true; graceful(); }
    const timer = setTimeout(() => {
        state.deadlineExceeded = true;
        try { writeJson(path.join(run, name + '-deadline.json'), { status: 'STOP_UNCONFIRMED_RETAIN_OWNERSHIP_NO_NEXT_PHASE', pid: child.pid ?? null, actualClose: state.actualClose, stdoutEOF: streams.stdout.eof, stderrEOF: streams.stderr.eof, signalsRequested: 0 }); } catch { state.streamError = true; }
        graceful();
    }, PHASE_MS);
    let actionFailed = false, observations;
    try { assert(!setupFailed); observations = await action(child, () => { assert(!state.deadlineExceeded && !state.actualClose); }); }
    catch { actionFailed = true; }
    finally { graceful(); await closed; await stopCompleted; clearTimeout(timer); }
    // No disposal, pipe destruction, or later phase while this actual barrier is pending.
    for (const s of Object.values(streams)) { try { fs.fsyncSync(s.fd); } finally { fs.closeSync(s.fd); } }
    const receipt = { status: 'ACTUAL_CLOSE_AND_BOTH_EOF_OBSERVED_NOT_YET_ASSERTED', observedAt: new Date().toISOString(), pid: child.pid ?? null, ...state, actionFailed, stdoutEOF: streams.stdout.eof, stderrEOF: streams.stderr.eof, signalsRequested: 0, streams: Object.entries(streams).map(([channel, s]) => ({ channel, bytes: s.bytes, observedBytes: s.observedBytes, sha256: sha(fs.readFileSync(s.file)) })) };
    writeJson(path.join(run, name + '-owned-close.json'), receipt);
    assert(state.actualExit && state.actualClose && state.exitCode === 0 && state.closeCode === 0 && state.signal === null && state.closeSignal === null);
    assert(streams.stdout.eof && streams.stderr.eof && !state.overflow && !state.streamError && !state.spawnError && !state.deadlineExceeded && !state.stopDeliveryError && !actionFailed);
    const result = await check(fs.readFileSync(streams.stdout.file), fs.readFileSync(streams.stderr.file), observations);
    writeJson(path.join(run, name + '-checks.json'), { status: 'PASS_ACTUAL_COMPILED_RUNTIME_SCOPED', checks: result, signalsRequested: 0 });
    return { name, checks: result.length, closeSha256: sha(fs.readFileSync(path.join(run, name + '-owned-close.json'))) };
}
function request(port, route, session, control, body, active) {
    active(); assert(Number.isInteger(port) && port > 0 && port <= 65535 && route.startsWith('/') && !route.startsWith('//'));
    const raw = body === undefined ? undefined : Buffer.from(JSON.stringify(body)); assert(!raw || raw.length < 8192);
    return new Promise((resolve, reject) => {
        const req = http.request({ host: '127.0.0.1', port, path: route, method: raw ? 'POST' : 'GET', agent: false, headers: { connection: 'close', authorization: 'Bearer ' + control, 'x-soterai-session': session, ...(raw ? { 'content-type': 'application/json', 'content-length': raw.length } : {}) } }, res => {
            let size = 0, overflow = false; const chunks = [];
            res.on('data', chunk => { size += chunk.length; if (size > 65536) overflow = true; else chunks.push(chunk); });
            res.once('error', () => reject(new Error('LOOPBACK_RESPONSE_UNAVAILABLE')));
            res.once('end', () => { try { assert(!overflow && res.complete); const bytes = Buffer.concat(chunks); resolve({ status: res.statusCode, raw: bytes, body: JSON.parse(bytes.toString('utf8')) }); } catch { reject(new Error('LOOPBACK_RESPONSE_INVALID')); } });
        });
        req.once('error', () => reject(new Error('LOOPBACK_REQUEST_UNAVAILABLE'))); req.end(raw);
    });
}
async function brokerPhase(mode, paths) {
    const session = crypto.randomUUID(), token = 'F27_SYNTHETIC_CLIENT_' + crypto.randomBytes(32).toString('hex'), control = 'F27_SYNTHETIC_CONTROL_' + crypto.randomBytes(32).toString('hex');
    const profile = path.join(paths.execution, mode + '-profile'); fs.mkdirSync(profile); const env = environment(profile);
    Object.assign(env, { SOTERAI_BROKER_SESSION: session, SOTERAI_BROKER_PORT: '0', SOTERAI_BROKER_TOKEN: token, SOTERAI_BROKER_CONTROL_TOKEN: control, SOTERAI_BROKER_STORAGE: path.join(profile, 'BrokerStorage'), SOTERAI_REQUIRE_CANARY_SYNC: '1' });
    if (mode !== 'default-off') env.SOTERAI_SELF_HYGIENE = mode === 'enabled' ? '1' : '0';
    const label = 'caller_' + CANARY, privatePath = path.join(paths.workspace, CANARY + '.txt'), privateValues = [CANARY, label, privatePath, session, token, control, profile, paths.workspace];
    return owned({ name: 'broker-' + mode, runtime: path.join(paths.snapshot, 'extension/dist/local-ai-broker.js'), cwd: paths.workspace, env, ipc: true, run: paths.run,
        stop: (child, failed) => { if (!child.connected) { if (child.exitCode === null) failed(); return; } return new Promise(done => child.send({ type: 'SOTERAI_BROKER_STOP', version: 1, session }, error => { if (error) failed(); done(); })); },
        action: async (child, active) => {
            const ready = await new Promise((resolve, reject) => { child.once('message', resolve); child.once('close', () => reject(new Error('READINESS_UNAVAILABLE'))); child.once('error', () => reject(new Error('READINESS_UNAVAILABLE'))); }); active();
            assert.deepEqual(Object.keys(ready).sort(), ['port', 'session', 'type', 'version']); assert.equal(ready.type, 'SOTERAI_BROKER_READY'); assert.equal(ready.version, 1); assert.equal(ready.session, session); assert(Number.isInteger(ready.port) && ready.port > 0 && ready.port <= 65535);
            const call = (route, body) => request(ready.port, route, session, control, body, active);
            const health = await call('/health'); assert.equal(health.status, 200); assert.equal(health.body.status, 'ok'); assert.equal(health.body.host, '127.0.0.1');
            const version = await call('/version'); assert.equal(version.status, 200); assert.equal(version.body.name, '@soterai/local-ai-broker');
            const owner = await call('/v1/lifecycle/status'); assert.equal(owner.status, 200); assert.equal(owner.body.session, session); assert.equal(owner.body.ready, true);
            const scan = await call('/v1/scan', { messages: [{ role: 'user', content: 'Public synthetic fixture note.' }], label, token, path: privatePath }); assert.equal(scan.status, 200); noPrivate(scan.raw, privateValues);
            const missing = await call('/f27-' + CANARY); assert.equal(missing.status, 404); assert.equal(missing.body.error.code, 'not_found'); noPrivate(missing.raw, privateValues);
            const malformed = await call('/v1/scan', { messages: CANARY, label, token, path: privatePath }); assert.equal(malformed.status, 400); assert.equal(malformed.body.error.code, 'invalid_messages'); noPrivate(malformed.raw, privateValues);
            const recent = await call('/v1/events/recent'), exported = await call('/v1/events/export-redacted', {}); assert.equal(recent.status, 200); assert.equal(exported.status, 200); noPrivate(recent.raw, privateValues); noPrivate(exported.raw, privateValues);
            if (mode === 'enabled') { assert(recent.body.events.some(row => row.eventType === 'broker_request_scanned')); assert.equal(exported.body.events.length, recent.body.events.length); }
            else { assert.deepEqual(recent.body, { withheld: true, events: [] }); assert.deepEqual(exported.body, { withheld: true, events: [], memory: { sessions: [] } }); }
            active(); return { port: ready.port };
        },
        check: (stdout, stderr, observed) => {
            noPrivate(stdout, privateValues); noPrivate(stderr, privateValues); assert.equal(stderr.length, 0);
            if (mode === 'enabled') {
                const text = stdout.toString('utf8'); assert(text.endsWith('\n')); const rows = text.trimEnd().split(/\r?\n/).map(line => JSON.parse(line)); assert.equal(rows.length, 3);
                for (const row of rows) { assert(Object.keys(row).every(key => ['timestamp', 'message', 'code', 'port', 'status'].includes(key))); assert.equal(new Date(row.timestamp).toISOString(), row.timestamp); assert.equal(row.message, row.code); }
                const started = rows.filter(row => row.code === 'broker_started'); assert.equal(started.length, 1); assert.equal(started[0].port, observed.port); assert.deepEqual(Object.keys(started[0]).sort(), ['code', 'message', 'port', 'timestamp']);
                const failures = rows.filter(row => row.code === 'request_failed'); assert.equal(failures.length, 2); assert.deepEqual(failures.map(row => row.status).sort(), [400, 404]);
                for (const row of failures) assert.deepEqual(Object.keys(row).sort(), ['code', 'message', 'status', 'timestamp']);
            } else assert.equal(stdout.length, 0);
            return ['B01_OWNER_IPC_PORT0_READY', 'B02_PUBLIC_HEALTH_VERSION_OWNER_STATUS', 'B03_PUBLIC_SCAN', 'B04_CONTROL_AUTHENTICATED_UNKNOWN_ROUTE_404', 'B05_MALFORMED_SCAN_400', 'B06_NO_CALLER_VALUES_IN_ACTUAL_DIAGNOSTIC_PIPES', mode === 'enabled' ? 'B07_PUBLIC_PORT_STATUS_METADATA_AND_OWNED_EVENT' : 'B07_OFF_DIAGNOSTICS_WITHHELD_AND_EMPTY_OWNED_EXPORT'];
        } });
}
async function mcpPhase(paths) {
    const profile = path.join(paths.execution, 'mcp-profile'); fs.mkdirSync(profile); const env = environment(profile); env.SOTERAI_SELF_HYGIENE = '1';
    const frames = [
        { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'f27-public-fixture', version: '1' } } },
        { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 2, method: 'ping' }, { jsonrpc: '2.0', id: 3, method: 'tools/list' },
        { jsonrpc: '2.0', id: 4, method: CANARY }, { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: CANARY, arguments: {} } }, { jsonrpc: '2.0', id: 6, method: 'ping' }
    ];
    return owned({ name: 'mcp-stdio', runtime: path.join(paths.snapshot, 'extension/dist/soterai-mcp-server.js'), cwd: paths.workspace, env, ipc: false, run: paths.run,
        stop: child => { if (!child.stdin.writableEnded) child.stdin.end(); }, action: async child => { child.stdin.end(frames.map(row => JSON.stringify(row)).join('\n') + '\n'); },
        check: (stdout, stderr) => {
            noPrivate(stdout, [CANARY, paths.workspace, profile]); noPrivate(stderr, [CANARY, paths.workspace, profile]); assert.equal(stderr.length, 0);
            const text = stdout.toString('utf8'); assert(text.endsWith('\n')); const rows = text.trimEnd().split(/\r?\n/).map(line => JSON.parse(line)); assert.equal(rows.length, 6); assert.deepEqual(rows.map(row => row.id), [1, 2, 3, 4, 5, 6]);
            for (const row of rows) { assert.equal(row.jsonrpc, '2.0'); assert(Number.isSafeInteger(row.id)); }
            assert.equal(rows[0].result.protocolVersion, '2024-11-05'); assert.equal(rows[0].result.serverInfo.name, 'soterai-guard'); assert.deepEqual(rows[0].result.capabilities, { tools: {} });
            for (const index of [1, 5]) assert.deepEqual(rows[index], { jsonrpc: '2.0', id: index === 1 ? 2 : 6, result: {} });
            assert.deepEqual(rows[2].result.tools.map(row => row.name).sort(), ['soterai_check_command', 'soterai_check_dependency', 'soterai_read_project_file_safely', 'soterai_scan_text']);
            assert.deepEqual(rows[3], { jsonrpc: '2.0', id: 4, error: { code: -32601, message: 'Method not found' } }); assert.deepEqual(rows[4], { jsonrpc: '2.0', id: 5, error: { code: -32602, message: 'Unknown tool' } });
            return ['M01_INITIALIZE_ACTUAL_STDIO', 'M02_PUBLIC_PING', 'M03_ACTUAL_TOOL_LIST', 'M04_UNKNOWN_METHOD_CONSTANT_ERROR_NO_CANARY', 'M05_UNKNOWN_TOOL_CONSTANT_ERROR_NO_CANARY', 'M06_SUBSEQUENT_PING_AND_STDIO_EOF'];
        } });
}
async function main() {
    assert.equal(process.platform, 'win32'); const args = process.argv.slice(2); assert.equal(args.length, 4); assert.equal(args[0], '--binding'); assert.equal(args[2], '--sha256');
    const bindingFile = relative(args[1]); assert(args[1].startsWith(H) && args[1].endsWith('.json') && !args[1].endsWith('.template.json'));
    const b = await guard(bindingFile, args[3]);
    // No output/profile mutation occurs until every binding and receipt is admitted.
    const id = new Date().toISOString().replace(/[-:.]/g, '').replace(/\d{3}Z$/, 'Z') + '-' + crypto.randomBytes(8).toString('hex');
    const name = 'f27-compiled-runtime-' + id, run = path.join(__dirname, name), base = 'D:\\SoterAI-Lite-test-profiles', execution = path.join(base, name);
    ordinary(__dirname, true); ordinary(base, true); assert(/^D:\\SoterAI-Lite-test-profiles\\f27-compiled-runtime-[0-9TZ]+-[a-f0-9]{16}$/.test(execution));
    assert(!fs.existsSync(run) && !fs.existsSync(execution)); fs.mkdirSync(run); fs.mkdirSync(execution); ordinary(run, true); ordinary(execution, true);
    const paths = { run, execution, workspace: path.join(execution, 'workspace'), snapshot: path.join(execution, 'snapshot') }; fs.mkdirSync(paths.workspace); fs.mkdirSync(paths.snapshot); ordinary(paths.workspace, true);
    fs.writeFileSync(path.join(paths.workspace, 'README.txt'), 'Public synthetic workspace. No repository history or provider configuration.\n', { flag: 'wx' });
    await extract(b, paths.snapshot); writeJson(path.join(run, 'inputs.json'), { status: 'EXACT_ARCHIVE_BOUND_NO_CHILD_YET', vsix: b.vsix, runtimes: b.runtimes, sourceProof: PROOF, bindingSha256: args[3], fixture: b.fixture, executionRoot: execution, syntheticOnly: true, signalsRequested: 0, native06: 'F26a_USER_DEFERRED_NOT_RUN' });
    const phases = [], keep = setInterval(() => {}, 1000);
    try {
        for (const mode of ['enabled', 'explicit-off', 'default-off']) { await guard(bindingFile, args[3]); await snapshotGuard(b, paths.snapshot); phases.push(await brokerPhase(mode, paths)); await snapshotGuard(b, paths.snapshot); await guard(bindingFile, args[3]); }
        await guard(bindingFile, args[3]); await snapshotGuard(b, paths.snapshot); phases.push(await mcpPhase(paths)); await snapshotGuard(b, paths.snapshot); await guard(bindingFile, args[3]);
        writeJson(path.join(run, 'summary.json'), { status: 'PASS_SCOPED_ACTUAL_PACKAGED_BROKER_CLI_AND_MCP_STDIO', vsixSha256: b.vsix.sha256, runtimes: b.runtimes, sourceProofSha256: PROOF.sha256, phases, checks: phases.reduce((sum, item) => sum + item.checks, 0), signalsRequested: 0, independence: 'LOW_SCRIPTED_COMPILED_NODE_RUNTIME_NOT_VSCODE_HOST_OR_HUMAN', coverageLimits: ['MCP_JSON_CANNOT_INJECT_ACCESSOR_DETECTOR_EXCEPTION', 'STARTUP_REFUSAL_NATURAL1_NOT_COVERED', 'NO_NATIVE_CRASH_DUMP_OR_TRANSIENT_MEMORY_CLAIM'], native06: 'F26a_USER_DEFERRED_NOT_RUN', releaseReady: false });
        console.log(JSON.stringify({ status: 'PASS_SCOPED_COMPILED_RUNTIME_ONLY', phases: phases.length, checks: phases.reduce((sum, item) => sum + item.checks, 0), signalsRequested: 0 }));
    } catch {
        writeJson(path.join(run, 'failure.json'), { status: 'FAIL_OR_INCOMPLETE_NO_LATER_PHASE_NO_RETRY', observedAt: new Date().toISOString(), completedPhases: phases, signalsRequested: 0, priorFailuresRetained: true }); throw new Error('COMPILED_RUNTIME_INCOMPLETE');
    } finally { clearInterval(keep); }
}
if (require.main === module) main().catch(() => { console.error('F27 compiled runtime verification refused or incomplete; retain all evidence; no automatic retry.'); process.exitCode = 1; });
