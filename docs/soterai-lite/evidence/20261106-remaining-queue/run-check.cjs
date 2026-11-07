'use strict';
// Local verification only. Each invocation retains its exact inputs, both
// streams and actual child close. No process termination or implicit retry.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../..');
const mode = process.argv[2];
const label = process.argv[3];
assert(['focused', 'full', 'package', 'typecheck'].includes(mode));
assert(/^[a-z0-9-]+$/.test(label));
const dir = path.join(__dirname, label);
fs.mkdirSync(dir);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const write = (name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const testDir = path.join(repo, 'packages/vscode-extension/src/__tests__');
const files = fs.readdirSync(testDir, { recursive: true })
  .filter(name => name.endsWith('.test.ts') && (mode !== 'focused' || /^(preCommit|lifecycle|removalCoordinator|ownedLifecycleStop)/.test(path.basename(name))))
  .map(name => path.join(testDir, name)).sort();
let args = ['--import', 'tsx', '--test', '--test-concurrency=2', ...files];
if (mode === 'package') args = ['--test', ...fs.readdirSync(path.join(repo, 'packages/soterai-lite/scripts/__tests__')).filter(n => n.endsWith('.test.cjs')).map(n => path.join(repo, 'packages/soterai-lite/scripts/__tests__', n))];
if (mode === 'typecheck') args = [path.join(repo, 'node_modules/typescript/bin/tsc'), '--noEmit', '-p', path.join(repo, 'packages/soterai-lite/tsconfig.json')];
write('inputs.json', { observedAt: new Date().toISOString(), mode, executable: process.execPath, args,
  files: args.filter(f => /\.test\.(ts|cjs)$/.test(f)).map(f => { const bytes = fs.readFileSync(f); return { path: path.relative(repo, f).replaceAll('\\', '/'), bytes: bytes.length, sha256: hash(bytes) }; }) });
const startedAt = Date.now();
const child = cp.spawn(process.execPath, args, { cwd: repo, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
const streams = {};
for (const name of ['stdout', 'stderr']) {
  const fd = fs.openSync(path.join(dir, name + '.txt'), 'wx');
  streams[name] = { fd, bytes: 0, eof: false, error: false };
  child[name].on('data', bytes => { fs.writeSync(fd, bytes); streams[name].bytes += bytes.length; });
  child[name].on('end', () => { streams[name].eof = true; });
  child[name].on('error', () => { streams[name].error = true; });
}
write('started.json', { pid: child.pid, startedAt: new Date(startedAt).toISOString() });
let spawnError;
child.on('error', error => { spawnError = { code: error.code, message: error.message }; });
child.on('close', (exitCode, signal) => {
  const counts = {};
  for (const name of ['stdout', 'stderr']) { fs.fsyncSync(streams[name].fd); fs.closeSync(streams[name].fd); }
  const stdout = fs.readFileSync(path.join(dir, 'stdout.txt'), 'utf8');
  for (const match of stdout.matchAll(/^# (tests|pass|fail|cancelled|skipped|todo) (\d+)\r?$/gm)) counts[match[1]] = Number(match[2]);
  const result = { mode, exitCode, signal, actualClose: true, elapsedMs: Date.now() - startedAt, counts, spawnError,
    streams: Object.fromEntries(Object.entries(streams).map(([name, value]) => [name, { bytes: value.bytes, eof: value.eof, error: value.error, sha256: hash(fs.readFileSync(path.join(dir, name + '.txt'))) }])) };
  write('result.json', result);
  console.log(JSON.stringify(result, null, 2));
  if (exitCode !== 0 || spawnError) {
    console.log(stdout.split(/\r?\n/).filter((line, i, all) => line.startsWith('not ok') || all.slice(Math.max(0, i - 12), i).some(x => x.startsWith('not ok'))).join('\n').slice(-16000));
    console.error(fs.readFileSync(path.join(dir, 'stderr.txt'), 'utf8').slice(-4000));
  }
  process.exitCode = exitCode === 0 && !spawnError && Object.values(streams).every(s => s.eof && !s.error) ? 0 : 1;
});
