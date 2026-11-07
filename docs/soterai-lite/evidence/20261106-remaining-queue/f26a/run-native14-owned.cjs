'use strict';
// Execute only after the coordinating parent releases the isolated host.
// One invocation; retains the actual PowerShell close and both output streams.
// The inner pinned launcher owns all Code/Git phases and their closure proofs.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const hash = raw => crypto.createHash('sha256').update(raw).digest('hex');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const preparation = json(path.join(__dirname, 'native14-preparation.json'));
for (const row of [preparation.admission, preparation.runner]) {
 const raw = fs.readFileSync(row.path); assert.equal(raw.length, row.bytes); assert.equal(hash(raw), row.sha256);
}
const admission = json(preparation.admission.path);
const repo = path.resolve(__dirname, '../../../../..');
const executable = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', preparation.runner.path,
 '-CodePath', admission.code.path, '-HostTestsPath', admission.driver.path,
 '-ExtensionRoot', admission.extraction, '-VsixPath', admission.vsix.path,
 '-ExpectedVsixSha256', admission.vsix.sha256, '-ExpectedBundleSha256', admission.runtimeFiles[0].sha256];
const dir = path.join(__dirname, 'native14-owned-run');
fs.mkdirSync(dir);
const write = (name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
write('inputs.json', { observedAt: new Date().toISOString(), executable, args, runner: preparation.runner, admission: preparation.admission,
 currentTask: 'Owner requested F26a completion and approved local tests and isolated VS Code checks on 6 November 2026; earlier skip superseded.', signalsRequested: 0 });
const start = Date.now();
const child = cp.spawn(executable, args, { cwd: repo, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
const streams = {};
for (const name of ['stdout', 'stderr']) {
 const state = streams[name] = { fd: fs.openSync(path.join(dir, name + '.txt'), 'wx'), bytes: 0, eof: false, error: false };
 child[name].on('data', raw => { fs.writeSync(state.fd, raw); state.bytes += raw.length; });
 child[name].on('end', () => { state.eof = true; });
 child[name].on('error', () => { state.error = true; });
}
write('start.json', { pid: child.pid, startedAt: new Date(start).toISOString(), executable, signalsRequested: 0 });
let spawnError;
child.on('error', error => { spawnError = { name: error.name, code: error.code }; });
child.on('close', (exitCode, signal) => {
 for (const state of Object.values(streams)) { fs.fsyncSync(state.fd); fs.closeSync(state.fd); }
 const result = { status: exitCode === 0 && !spawnError ? 'OUTER_LAUNCHER_CLOSED_ZERO_CHECK_INNER_NATIVE_SUMMARY' : 'FAILED_OR_INCOMPLETE_NO_AUTOMATIC_RETRY',
  exitCode, signal, actualClose: true, elapsedMs: Date.now() - start, spawnError, signalsRequested: 0,
  streams: Object.fromEntries(Object.entries(streams).map(([name, state]) => [name, { bytes: state.bytes, eof: state.eof, error: state.error, sha256: hash(fs.readFileSync(path.join(dir, name + '.txt'))) }])) };
 write('close.json', result);
 console.log(JSON.stringify(result));
 console.log(fs.readFileSync(path.join(dir, 'stdout.txt'), 'utf8').slice(-4000));
 if (exitCode !== 0) console.error(fs.readFileSync(path.join(dir, 'stderr.txt'), 'utf8').slice(-6000));
 process.exitCode = exitCode === 0 && !spawnError && signal === null && Object.values(streams).every(s => s.eof && !s.error) ? 0 : 1;
});
