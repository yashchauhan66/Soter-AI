'use strict';

// Prepared fixture helper, never loaded by the product. Execute only after the
// launcher has proved natural primary editor closure. No signals or pipe aborts.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), cp = require('node:child_process');
const assert = require('node:assert/strict');
const GIT = 'C:\\Program Files\\Git\\cmd\\git.exe';
const GIT_SHA = 'da240fe9bc24895b3e04150a4990b8a6ff329ecabcd8f19684c2cc310da5ef3f';
const CODE_SHA = '9f33ede68f3317402280fa997bc8963f93e67f2905e416d6bb092c03d60a37eb';
const WORKER = '36e04d01bb9b38f8e402020318cc1d8d1a6d66176ec2be8c1630fbe6d012cacb';
const DRIVER = '8f7d11faa7ba03683fdbec85f95a0d2284bb126cd45c1dfc1cb02b2e3b090ced';
const CAP = 1048576 + 128 * 96 + 8192, LIMIT = 90000;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const within = (base, file) => { const rel = path.relative(path.resolve(base), path.resolve(file)); return rel === '' || !path.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + path.sep); };
function ordinary(file, directory = false) {
  const stat = fs.lstatSync(file); assert(!stat.isSymbolicLink()); assert(same(fs.realpathSync(file), file));
  assert(directory ? stat.isDirectory() : stat.isFile() && (stat.nlink === 1 || same(file, GIT) && stat.nlink === 2));
  for (let cursor = file;;) { assert(!fs.lstatSync(cursor).isSymbolicLink()); const next = path.dirname(cursor); if (next === cursor) break; cursor = next; }
  return stat;
}
function bytes(file, cap) { const before = ordinary(file); assert(before.size <= cap); const raw = fs.readFileSync(file); const after = ordinary(file);
  assert.equal(raw.length, before.size); assert.deepEqual([after.ino, after.dev, after.nlink, after.size, after.mtimeMs, after.ctimeMs], [before.ino, before.dev, before.nlink, before.size, before.mtimeMs, before.ctimeMs]); return raw; }
function fileHash(file, cap) {
  const before = ordinary(file); assert(before.size <= cap); const fd = fs.openSync(file, 'r'), chunk = Buffer.alloc(65536), digest = crypto.createHash('sha256');
  try { let offset = 0; for (;;) { const count = fs.readSync(fd, chunk, 0, chunk.length, offset); if (!count) break; offset += count; assert(offset <= cap); digest.update(chunk.subarray(0, count)); }
    assert.equal(offset, before.size); const after = ordinary(file); assert.deepEqual([after.ino, after.dev, after.nlink, after.size, after.mtimeMs, after.ctimeMs], [before.ino, before.dev, before.nlink, before.size, before.mtimeMs, before.ctimeMs]); return digest.digest('hex'); }
  finally { fs.closeSync(fd); chunk.fill(0); }
}
function fact(file) { try { const stat = ordinary(file); const raw = bytes(file, 536870912); return { present: true, bytes: raw.length, sha256: hash(raw), mode: stat.mode & 0o777 }; }
  catch (error) { if (error.code === 'ENOENT') return { present: false, bytes: 0, sha256: null, mode: null }; throw error; } }
function json(file, cap = 1048576) { return JSON.parse(bytes(file, cap).toString('utf8').replace(/^\uFEFF/, '')); }
function writeNew(file, value) { const fd = fs.openSync(file, 'wx'); try { fs.writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
function head(root) { assert.equal(bytes(path.join(root, '.git', 'HEAD'), 4096).toString('utf8').trim(), 'ref: refs/heads/main');
  try { const oid = bytes(path.join(root, '.git', 'refs', 'heads', 'main'), 4096).toString('utf8').trim(); assert.match(oid, /^[a-f0-9]{40}$/); return oid; }
  catch (error) { if (error.code === 'ENOENT') return 'UNBORN'; throw error; } }
function main() {
  assert.equal(process.platform, 'win32'); assert.equal(process.argv.length, 3);
  const inputFile = path.resolve(process.argv[2]); assert(within(__dirname, inputFile)); const input = json(inputFile);
  assert.equal(input.schemaVersion, 1); assert.equal(input.syntheticOnly, true);
  const parent = path.resolve(input.parent), root = path.resolve(input.root), profile = path.resolve(input.profile);
  assert.match(parent, /^D:\\SoterAI-Lite-test-profiles\\f26a-precommit-native-[0-9TZ]+-[a-f0-9]{8}$/i);
  assert(same(root, path.join(parent, 'workspace')) && same(profile, path.join(parent, 'profile')));
  ordinary(parent, true); ordinary(root, true); ordinary(profile, true);
  assert.equal(bytes(path.join(root, '.synthetic-lite-f26a-precommit-host'), 128).toString('utf8').trim(), 'synthetic-only-v1');
  const statePath = path.join(parent, 'precommit-restart-state.json'), stateRaw = bytes(statePath, 1048576), state = JSON.parse(stateRaw);
  assert.equal(input.primaryStateSha256, hash(stateRaw)); assert(state.schemaVersion === 1 && state.syntheticOnly === true && state.ready === true && state.phase === 'primary' && same(state.root, root));
  assert.equal(state.driverSha256, DRIVER);
  assert(same(input.primaryResult, path.join(parent, 'primary-results.json')));
  const primary = json(input.primaryResult); assert(primary.phase === 'primary' && primary.passed === 30 && primary.failed === 0 && primary.notRun === 0 && primary.readyForInterphase === true);
  assert.equal(primary.hostProbeSha256, DRIVER); assert.equal(primary.workerSha256, WORKER);
  const code = input.code;
  assert(code.observedExit === true && code.exitCode === 0 && code.stdoutEOF === true && code.stderrEOF === true && code.signalsRequested === 0
    && code.pidAbsentTwice === true && code.streamsStable === true && code.ownedWindowClose === 'workbench.action.closeWindow');
  assert(Array.isArray(code.pidAbsenceObservations) && code.pidAbsenceObservations.length === 2 && code.pidAbsenceObservations.every(row => row.pid === code.pid && row.absent === true));
  assert(same(code.executable, 'C:\\Users\\USER\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe'));
  assert.equal(fileHash(code.executable, 536870912), CODE_SHA);
  for (const stream of code.streams) { assert(within(path.dirname(inputFile), stream.path)); const raw = bytes(stream.path, 8388608); assert.equal(raw.length, stream.bytes); assert.equal(hash(raw), stream.sha256); }
  const source = input.codeEnvironment, env = {};
  for (const name of ['HOME', 'USERPROFILE', 'XDG_CONFIG_HOME', 'GIT_CONFIG_GLOBAL', 'GIT_CONFIG_SYSTEM', 'GIT_CONFIG_NOSYSTEM', 'SystemRoot', 'WINDIR', 'COMSPEC'])
    if (source[name] !== undefined) { assert.equal(typeof source[name], 'string'); env[name] = source[name]; }
  for (const name of ['HOME', 'USERPROFILE', 'XDG_CONFIG_HOME']) assert(same(env[name], profile));
  for (const name of ['GIT_CONFIG_GLOBAL', 'GIT_CONFIG_SYSTEM']) { assert(within(profile, env[name])); assert.equal(bytes(env[name], 4096).length, 0); }
  assert.equal(env.GIT_CONFIG_NOSYSTEM, '1');
  Object.assign(env, { GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never', GIT_OPTIONAL_LOCKS: '0', GIT_PAGER: '', PAGER: '',
    GIT_NO_LAZY_FETCH: '1', GIT_NO_REPLACE_OBJECTS: '1', GIT_PROTOCOL_FROM_USER: '0', LC_ALL: 'C', LANG: 'C' });
  assert.equal(hash(JSON.stringify(env)), state.ownerEnvironmentSha256);
  env.SOTERAI_F26A_ORIGINAL_ENV = 'TEST_ONLY_F26A_ORIGINAL_ENV_37b912ab';
  assert.equal(hash(JSON.stringify(env)), state.offlineEnvironmentSha256);
  const args = ['--no-pager', 'commit', '--quiet', '-m', 'F26a synthetic offline owner absent'];
  assert.deepEqual(state.offlineArguments, args); assert(!args.some(value => /core[.]hookspath|no-verify|^-c$/i.test(value)));
  const paths = { hook: path.join(root, '.git', 'hooks', 'pre-commit'), source: path.join(root, '.env.precommit-native'), index: path.join(root, '.git', 'index'),
    customHook: path.join(root, '.synthetic hooks', 'pre-commit'), config: path.join(root, '.git', 'config') };
  const before = {}; for (const [name, file] of Object.entries(paths)) { before[name] = fact(file); assert.deepEqual(before[name], state[name]); }
  const headBefore = head(root); assert.equal(headBefore, state.head);
  // Validate the actual public descriptor route without querying any listener.
  const hookText = bytes(paths.hook, 98304).toString('utf8'), pinMatch = /--pin '([A-Za-z0-9_-]+)' --index/.exec(hookText); assert(pinMatch);
  const pinRaw = Buffer.from(pinMatch[1], 'base64url'); assert.equal(pinRaw.toString('base64url'), pinMatch[1]); assert.equal(hash(pinRaw), state.publicPinSha256);
  const pin = JSON.parse(pinRaw); assert.equal(pin.root, state.root); assert(same(pin.root, root)); assert.equal(pin.generation, state.generation); assert.equal(pin.workerSha256, WORKER);
  assert(same(pin.runtime, code.executable)); assert.equal(pin.runtimeSha256, CODE_SHA); assert(within(profile, pin.descriptor));
  assert(within(path.join(parent, 'extension', 'dist'), pin.worker)); assert.equal(fileHash(pin.worker, 2097152), WORKER);
  const descriptor = fact(pin.descriptor); assert.deepEqual(descriptor, state.descriptor);
  const envelope = json(pin.descriptor, 8192), endpoint = new URL(envelope.payload.endpoint);
  assert.equal(envelope.domain, 'SoterAI-PreCommit-Descriptor-v1'); assert.equal(envelope.payload.session, state.session); assert.equal(envelope.payload.root, pin.root);
  assert.equal(endpoint.protocol, 'http:'); assert.equal(endpoint.hostname, '127.0.0.1'); assert.equal(endpoint.pathname, '/pre-commit');
  assert(!endpoint.username && !endpoint.password && !endpoint.search && !endpoint.hash && Number(endpoint.port) > 0);
  assert(crypto.verify(null, Buffer.from(envelope.domain + '\0' + JSON.stringify(envelope.payload)), crypto.createPublicKey({ key: Buffer.from(pin.publicKey, 'base64'), format: 'der', type: 'spki' }), Buffer.from(envelope.signature, 'base64url')));
  const backups = state.backupFacts.map(row => { assert.match(row.name, /^[a-f0-9]{32}[.]enc$/); const file = path.join(path.dirname(path.dirname(pin.descriptor)), 'config-backups', row.name); assert.deepEqual(fact(file), row.fact); return { file, expected: row.fact }; });
  assert.equal(fileHash(GIT, 1048576), GIT_SHA);
  const stdoutFile = path.join(parent, 'precommit-owner-absent-stdout.bin'), stderrFile = path.join(parent, 'precommit-owner-absent-stderr.bin');
  const streams = { stdout: { file: stdoutFile, fd: fs.openSync(stdoutFile, 'wx'), bytes: 0, observed: 0, eof: false }, stderr: { file: stderrFile, fd: fs.openSync(stderrFile, 'wx'), bytes: 0, observed: 0, eof: false } };
  let child, closed = false, exitCode = null, signal = null, timedOut = false, overflow = false, streamError = false, spawnFailed = false, signalsRequested = 0, finished = false;
  const keep = setInterval(() => {}, 1000), timer = setTimeout(() => {
    timedOut = true; process.exitCode = 1;
    writeNew(path.join(parent, 'precommit-owner-absent-timeout.json'), { schemaVersion: 1, status: 'STOP_UNCONFIRMED', syntheticOnly: true, pid: child?.pid ?? null,
      childClosed: closed, stdoutEOF: streams.stdout.eof, stderrEOF: streams.stderr.eof, signalsRequested, limitation: 'No signal or pipe destruction; ownership retained until actual close and both EOF.' });
  }, LIMIT);
  const finish = () => {
    if (finished || !closed || !streams.stdout.eof || !streams.stderr.eof) return; finished = true; clearTimeout(timer); clearInterval(keep);
    for (const stream of Object.values(streams)) { fs.fsyncSync(stream.fd); fs.closeSync(stream.fd); }
    const owner = { executable: GIT, executableSha256: GIT_SHA, args, cwd: root, environmentSha256: hash(JSON.stringify(env)), pid: child.pid ?? null,
      closed, exitCode, signal, stdoutEOF: streams.stdout.eof, stderrEOF: streams.stderr.eof, timedOut, signalsRequested, overflow, streamError, spawnFailed,
      ownerArgumentsHaveNoHooksOverride: true, nestedClientClosure: 'NOT_INFERRED_FROM_OWNER_GIT', stdout: { path: stdoutFile, bytes: streams.stdout.bytes, sha256: fileHash(stdoutFile, CAP) },
      stderr: { path: stderrFile, bytes: streams.stderr.bytes, sha256: fileHash(stderrFile, CAP) } };
    const after = {}; for (const [name, file] of Object.entries(paths)) after[name] = fact(file);
    const receipt = { schemaVersion: 1, status: 'ACTUAL_OWNER_ABSENT_BLOCKED', syntheticOnly: true, primaryStateSha256: hash(stateRaw), generation: state.generation, code, owner,
      headBefore, headAfter: head(root), sourceBefore: before.source, sourceAfter: after.source, indexBefore: before.index, indexAfter: after.index, hookBefore: before.hook, hookAfter: after.hook };
    try {
      assert(!timedOut && !overflow && !streamError && !spawnFailed && signalsRequested === 0 && signal === null && Number.isInteger(exitCode) && exitCode !== 0);
      assert(bytes(stderrFile, CAP).includes(Buffer.from('SoterAI: Commit withheld. Open the owning editor or review pre-commit status.')), 'Actual owned hook must report its fixed withholding boundary.');
      assert.equal(receipt.headAfter, headBefore); assert.deepEqual(after, before); assert.deepEqual(fact(pin.descriptor), descriptor);
      backups.forEach(row => assert.deepEqual(fact(row.file), row.expected)); assert.equal(hash(bytes(statePath, 1048576)), hash(stateRaw));
      assert.equal(fileHash(GIT, 1048576), GIT_SHA); assert.equal(fileHash(code.executable, 536870912), CODE_SHA);
      writeNew(path.join(parent, 'precommit-owner-absent.json'), receipt); process.stdout.write(JSON.stringify({ status: receipt.status, ownerPid: owner.pid }) + '\n');
    } catch (error) { process.exitCode = 1; writeNew(path.join(parent, 'precommit-owner-absent-failure.json'), { ...receipt, status: 'FAILED_OR_INCOMPLETE', errorName: error.name }); }
  };
  child = cp.spawn(GIT, args, { cwd: root, env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.kill = () => { signalsRequested++; throw Error('Signals forbidden.'); };
  writeNew(path.join(parent, 'precommit-owner-absent-child-start.json'), { schemaVersion: 1, syntheticOnly: true, pid: child.pid ?? null, helperPid: process.pid, executable: GIT, args, cwd: root, environmentSha256: hash(JSON.stringify(env)), startedAt: new Date().toISOString(), signalsRequested: 0 });
  child.once('error', () => { spawnFailed = true; });
  child.once('close', (code, received) => { closed = true; exitCode = code; signal = received; finish(); });
  for (const name of ['stdout', 'stderr']) {
    const state = streams[name], stream = child[name]; assert(stream);
    stream.on('data', chunk => { state.observed += chunk.length; const admitted = Math.min(chunk.length, Math.max(0, CAP - state.bytes));
      if (state.observed > CAP) overflow = true;
      let used = 0; while (used < admitted) used += fs.writeSync(state.fd, chunk, used, admitted - used); state.bytes += admitted; });
    stream.once('error', () => { streamError = true; }); stream.once('end', () => { state.eof = true; finish(); });
  }
}
try { main(); } catch (error) { process.exitCode = 1; process.stderr.write(JSON.stringify({ status: 'REFUSED_BEFORE_OR_DURING_OFFLINE_PROBE', errorName: error.name }) + '\n'); }
