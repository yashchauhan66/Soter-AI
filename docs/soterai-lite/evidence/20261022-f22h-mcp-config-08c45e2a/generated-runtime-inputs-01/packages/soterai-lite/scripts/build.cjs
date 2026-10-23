// Preserve every build attempt; only the operational dist pointer is refreshed.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const esbuild = require('esbuild');
const extensionRoot = path.resolve(__dirname, '..');
const repo = path.resolve(extensionRoot, '../..');
const legacy = path.join(repo, 'packages/vscode-extension');
const { parserBundleOptions } = require(path.join(legacy, 'scripts/parserBundleOptions.cjs'));
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
async function atomicWrite(file, data) {
  const staged = path.join(path.dirname(file), '.tmp-' + path.basename(file) + '-' + crypto.randomBytes(6).toString('hex'));
  await fs.writeFile(staged, data, { flag: 'wx' });
  await fs.rename(staged, file);
}
async function main() {
  const runId = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(4).toString('hex');
  const attempt = path.join(extensionRoot, 'builds', runId);
  await fs.mkdir(path.join(extensionRoot, 'builds'), { recursive: true });
  await fs.mkdir(attempt);
  const specs = [
    ['extension.js', path.join(extensionRoot, 'src/extension.ts'), ['vscode']],
    ['local-ai-broker.js', path.join(repo, 'apps/local-ai-broker/src/cli.ts'), []],
    ['soterai-mcp-server.js', path.join(legacy, 'src/agent/mcpServer.ts'), []]
  ];
  const forbidden = ['apps/privacy-controller/', 'project-privacy/capabilities/', 'tier2-lite/'];
  const inventory = [];
  for (const [name, entry, external] of specs) {
    const result = await esbuild.build({ ...parserBundleOptions(repo), absWorkingDir: repo, entryPoints: [entry], bundle: true,
      outfile: path.join(attempt, 'dist', name), platform: 'node', format: 'cjs', target: 'node18',
      tsconfig: path.join(legacy, 'tsconfig.json'), external, minify: true, sourcemap: false,
      metafile: true, logLevel: 'warning', legalComments: 'eof' });
    const inputs = [];
    for (const relative of Object.keys(result.metafile.inputs)) {
      const normalized = relative.replace(/\\/g, '/');
      if (forbidden.some(item => normalized.includes(item))) throw new Error('Full/test runtime input refused: ' + normalized);
      if (/\/(__tests__|fixtures|evidence)\//.test(normalized)) throw new Error('Test/evidence runtime input refused: ' + normalized);
      const bytes = await fs.readFile(path.resolve(repo, relative));
      inputs.push({ path: normalized, bytes: bytes.length, sha256: sha(bytes) });
    }
    await fs.writeFile(path.join(attempt, name + '.metafile.json'), JSON.stringify(result.metafile, null, 2) + '\n', { flag: 'wx' });
    const bytes = await fs.readFile(path.join(attempt, 'dist', name));
    if (bytes.includes(Buffer.from(repo)) || bytes.includes(Buffer.from(repo.replace(/\\/g, '\\\\')))) throw new Error('Local absolute workspace path in bundle');
    inventory.push({ name, bytes: bytes.length, sha256: sha(bytes), inputs });
  }
  const manifest = JSON.parse(await fs.readFile(path.join(extensionRoot, 'package.json'), 'utf8'));
  const canonical = JSON.parse(await fs.readFile(path.join(legacy, 'package.json'), 'utf8'));
  // One canonical contribution/activation contract for the compatibility tests.
  manifest.contributes = canonical.contributes;
  manifest.activationEvents = canonical.activationEvents;
  manifest.capabilities = canonical.capabilities;
  const manifestBytes = JSON.stringify(manifest, null, 2) + '\n';
  if (await fs.readFile(path.join(extensionRoot, 'package.json'), 'utf8') !== manifestBytes) {
    await atomicWrite(path.join(extensionRoot, 'package.json'), manifestBytes);
  }
  await fs.copyFile(path.join(extensionRoot, 'package.json'), path.join(attempt, 'package.json'));
  const receipt = { runId, attempt: path.relative(extensionRoot, attempt), manifestSha256: sha(Buffer.from(manifestBytes)),
    status: 'BUILT_NOT_HOST_VERIFIED', identity: manifest.publisher + '.' + manifest.name,
    version: manifest.version, runtimeCount: inventory.length, inventory };
  await fs.writeFile(path.join(attempt, 'build-provenance.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  await fs.mkdir(path.join(extensionRoot, 'dist'), { recursive: true });
  for (const [name] of specs) await fs.copyFile(path.join(attempt, 'dist', name), path.join(extensionRoot, 'dist', name));
  await atomicWrite(path.join(extensionRoot, 'dist', 'build-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'BUILT_NOT_HOST_VERIFIED', attempt: path.relative(repo, attempt),
    bundles: inventory.map(({ name, bytes, sha256 }) => ({ name, bytes, sha256 })) }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
