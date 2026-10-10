// Freeze supplied build, source identity and synthetic launch inputs. No build deletion.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const directory = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(directory, '../../../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
if (process.argv.includes('--disable-unique-evidence')) throw new Error('Unique evidence disabled; preparation unavailable.');
const outputIndex = process.argv.indexOf('--output-root');
const outputRoot = outputIndex < 0 ? path.join(directory, 'runs') : path.resolve(process.argv[outputIndex + 1] ?? '');
const comparablePath = value => process.platform === 'win32' ? value.toLowerCase() : value;
if (!comparablePath(outputRoot).startsWith(comparablePath(repo + path.sep))) throw new Error('Preparation output must stay in the repository.');
for (let cursor = outputRoot; cursor.length > repo.length; cursor = path.dirname(cursor)) {
  const info = await fs.lstat(cursor).catch(error => {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  });
  if (info?.isSymbolicLink()) throw new Error('Linked preparation output refused.');
}
await fs.mkdir(outputRoot, { recursive: true });
const run = path.join(outputRoot, 'host-' + crypto.randomBytes(12).toString('hex'));
await fs.mkdir(run);
const phase0 = JSON.parse(await fs.readFile(path.join(repo, 'docs/secretguard/guarantee-program-2026-10-09/phase0/evidence/baseline-final/inventory.json'), 'utf8'));
const sourceIdentity = [];
for (const source of phase0.sources) {
  const bytes = await fs.readFile(path.join(repo, source.path));
  sourceIdentity.push({ path: source.path, sha256: hash(bytes), matchesPhase0: hash(bytes) === source.sha256 });
}
const extension = path.join(repo, 'packages/vscode-extension');
const snapshot = path.join(run, 'snapshot');
await fs.mkdir(path.join(snapshot, 'dist'), { recursive: true });
const files = ['package.json', 'dist/extension.js', 'dist/local-ai-broker.js', 'dist/soterai-mcp-server.js'];
const suppliedBuild = [];
for (const name of files) {
  const bytes = await fs.readFile(path.join(extension, name));
  await fs.writeFile(path.join(snapshot, name), bytes, { flag: 'wx' });
  suppliedBuild.push({ path: 'packages/vscode-extension/' + name, snapshot: name, bytes: bytes.length, sha256: hash(bytes) });
}
await fs.cp(path.join(extension, 'media'), path.join(snapshot, 'media'), { recursive: true, errorOnExist: true, force: false });
const runtimeAssets = [];
async function inventoryAssets(folder) {
  for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
    const name = path.join(folder, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Linked runtime asset refused.');
    if (entry.isDirectory()) await inventoryAssets(name);
    else if (entry.isFile()) {
      const bytes = await fs.readFile(name);
      runtimeAssets.push({ path: path.relative(snapshot, name).split(path.sep).join('/'), bytes: bytes.length, sha256: hash(bytes) });
    }
  }
}
await inventoryAssets(path.join(snapshot, 'media'));
for (const name of ['workspace', 'profile/User', 'extensions', 'captures', 'temp']) await fs.mkdir(path.join(run, name), { recursive: true });
await fs.writeFile(path.join(run, 'workspace/.synthetic-phase1-lab'), 'synthetic-only-v1', { flag: 'wx' });
const manifest = { schemaVersion: 1, syntheticOnly: true, phase: 1, runId: path.basename(run), capturedAtUtc: new Date().toISOString(),
  run, repo, suppliedBuild, runtimeAssets, sourceIdentity, sourceChangesSincePhase0: sourceIdentity.filter(p => !p.matchesPhase0).map(p => p.path),
  currentSecurityResult: 'NOT_RUN', realAgentTested: false, productionCodeModified: false };
await fs.writeFile(path.join(run, 'freeze.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
await fs.writeFile(path.join(run, 'prepared-run.json'), JSON.stringify({ run }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ run, sourceFiles: sourceIdentity.length, sourceChangesSincePhase0: manifest.sourceChangesSincePhase0,
  suppliedExtensionSha256: suppliedBuild.find(p => p.snapshot === 'dist/extension.js').sha256 }, null, 2));
