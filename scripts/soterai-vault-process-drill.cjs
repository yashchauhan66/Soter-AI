'use strict';
// Real process restarts and owned-child interruption; VS Code UI/key storage
// remain explicit synthetic seams. This does not certify native SecretStorage.
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes, createHash } = require('node:crypto');
const repo = path.resolve(__dirname, '..');
const base = path.join(repo, 'docs/soterai-lite/evidence/20261114-release-gates');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const original = 'DB_PASSWORD="BlueMango7!"\nAPI_PASSWORD="OrangeRiver9!"\n';
async function main() {
  const [directory, pointer] = process.argv.slice(2);
  assert(directory); const out = path.resolve(repo, directory); assert(out.startsWith(base + path.sep));
  await fs.mkdir(out); await fs.mkdir(path.join(out, 'temp'));
  const key = randomBytes(32).toString('base64'), observations = [];
  let release;
  if (pointer) release = await require('../packages/soterai-lite/scripts/release-artifact.cjs').resolveRelease({ repoRoot: repo, pointerPath: path.resolve(repo, pointer) });
  const sourceHashes = {};
  for (const name of ['VaultManager', 'VaultStorage']) {
    const file = 'packages/vscode-extension/src/firewall/' + name + '.ts'; sourceHashes[file] = sha(await fs.readFile(path.join(repo, file)));
    if (release) {
      const build = JSON.parse(await fs.readFile(path.join(repo, release.buildReceiptPath), 'utf8'));
      const source = build.inventory.find(item => item.name === 'extension.js').inputs.find(item => item.path === file);
      assert(source && source.sha256 === sourceHashes[file], 'Drill source must match the packaged source receipt');
    }
  }
  async function cohort(name) {
    const root = path.join(out, name); await fs.mkdir(root);
    await fs.mkdir(path.join(root, 'workspace')); await fs.mkdir(path.join(root, 'storage'));
    await fs.writeFile(path.join(root, 'workspace/.env'), original, { flag: 'wx' }); return root;
  }
  async function worker(mode, root, hold = false) {
    const env = { SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, TEMP: path.join(out, 'temp'), TMP: path.join(out, 'temp') };
    for (const name of Object.keys(env)) if (env[name] === undefined) delete env[name];
    const child = spawn(process.execPath, ['--require', path.join(__dirname, 'soterai-source-contract-loader.cjs'), '--import', 'tsx', path.join(__dirname, 'soterai-vault-process-drill.worker.ts')],
      { cwd: repo, env, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    let bytes = 0, settled = false;
    const closed = new Promise(resolve => child.once('close', (code, signal) => resolve({ code, signal })));
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { child.kill(); reject(Error('WORKER_TIMEOUT')); }, 45000);
      const fail = () => { if (!settled) { settled = true; clearTimeout(timer); child.kill(); reject(Error('WORKER_FAILED')); } };
      child.once('error', fail); child.once('close', () => { if (!settled) fail(); });
      for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { bytes += chunk.length; if (bytes > 65536) fail(); });
      child.on('message', message => {
        if (!message?.ok) return fail();
        if (hold && message.phase !== 'VAULT_COMMITTED_BEFORE_SOURCE') return fail();
        settled = true; clearTimeout(timer); resolve(message);
      });
      child.send({ mode, root, key });
    });
    if (hold) {
      assert.equal(result.sourceStillOriginal, true); child.kill(); await closed;
      observations.push({ mode, actualOwningProcessInterrupted: true, sourceStillOriginal: true });
    } else {
      assert.equal((await closed).code, 0); observations.push(result);
    }
    return result;
  }
  const normal = await cohort('restart');
  const seed = await worker('seed', normal), reopened = await worker('inspect', normal);
  assert.equal(seed.migrated, 2); assert.equal(reopened.entriesSha256, seed.entriesSha256);
  assert.equal(reopened.cipherSha256, seed.cipherSha256); assert.equal(reopened.sourceMasked, true);
  const restored = await worker('restore', normal); assert.equal(restored.restored, 2); assert.equal(restored.sourceIsOriginal, true);
  const interrupted = await cohort('interruption'); await worker('hold-after-vault', interrupted, true);
  const recovered = await worker('recover', interrupted); assert.equal(recovered.recovered, true); assert.equal(recovered.sourceMasked, true); assert.equal(recovered.pendingRecordPresent, false);
  const repeated = await worker('recover', interrupted); assert.equal(repeated.recovered, false); assert.equal(repeated.entriesSha256, recovered.entriesSha256);
  assert.equal((await worker('restore', interrupted)).sourceIsOriginal, true);
  const cipherPath = path.join(interrupted, 'storage/soterai-vault.enc'), cipher = await fs.readFile(cipherPath);
  const damaged = Buffer.from(cipher); damaged[Math.floor(damaged.length / 2)] ^= 1;
  await fs.writeFile(cipherPath, damaged); await worker('expect-corruption', interrupted);
  assert((await fs.readFile(cipherPath)).equals(damaged), 'Corrupt state must be retained');
  const report = { schemaVersion: 1, status: 'PASS_SOURCE_PROCESS_RECOVERY_DRILL', artifactSha256: release?.sha256 ?? null,
    sourceHashes, observations, actualChildProcesses: observations.length, actualProcessRestart: true,
    actualOwningProcessInterrupted: true, nativeEditorTested: false, nativeSecretStorageTested: false,
    keyStorageSeam: 'Synthetic in-memory key supplied over owned IPC to each fresh worker; no key persisted or printed',
    firstPartyImports: 'Fresh source aliases matching the Lite builder; package/dist imports are not used',
    uiSeam: 'Synthetic owner consent through the VS Code source-test adapter',
    priorInstalledVersionUpgradeTested: false, independentHumanReview: false, releaseReady: false };
  await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: report.status, workers: observations.length, artifactSha256: report.artifactSha256, nativeEditorTested: false, releaseReady: false }));
}
main().catch(() => { console.error('Process recovery drill did not pass; retained fixtures are not native acceptance.'); process.exitCode = 2; });
