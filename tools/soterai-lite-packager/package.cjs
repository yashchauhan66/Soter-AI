'use strict';
// Repackage an exact immutable Lite payload with the isolated toolchain.
// Existing runtime acceptance remains attached to its original artifact.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const yauzl = require('yauzl');
const root = path.resolve(__dirname, '../..');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const runtimes = ['extension.js', 'local-ai-broker.js', 'soterai-mcp-server.js', 'pre-commit-client.js'];
const payload = ['package.json', ...runtimes.map(n => 'dist/' + n), 'readme.md', 'changelog.md', 'LICENSE.md', 'PRIVACY.md',
  'SBOM.cdx.json', 'THIRD-PARTY-NOTICES.md', 'media/icon.svg', 'media/logo_circle_whiter.png',
  'media/walkthrough/demo.md', 'media/walkthrough/vault.md', 'media/walkthrough/integrate.md'];

function fileFact(file) {
  const data = fs.readFileSync(file);
  return { path: path.relative(root, file).replaceAll('\\', '/'), bytes: data.length, sha256: sha(data) };
}
function freshDirectory(directory) {
  directory = path.resolve(directory);
  const relative = path.relative(root, directory);
  assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Output must be inside the workspace');
  assert(!fs.existsSync(directory), 'Existing output refused');
  for (let parent = path.dirname(directory); ; parent = path.dirname(parent)) {
    const info = fs.lstatSync(parent);
    assert(info.isDirectory() && !info.isSymbolicLink(), 'Ordinary output parent required');
    if (parent === root) break;
  }
  fs.mkdirSync(directory);
  return directory;
}
function canonicalName(name) {
  if (name === 'extension/README.md') return 'extension/readme.md';
  if (name === 'extension/CHANGELOG.md') return 'extension/changelog.md';
  return name;
}
function validateEntry(entry, seen) {
  const name = canonicalName(entry.fileName);
  const allowed = ['[Content_Types].xml', 'extension.vsixmanifest', ...payload.map(n => 'extension/' + n)];
  assert(allowed.includes(name), 'Unexpected archive entry: ' + name);
  assert(!seen.has(name.toLowerCase()), 'Duplicate or aliased archive entry');
  seen.add(name.toLowerCase());
  assert(entry.uncompressedSize <= 8 * 1024 * 1024 && entry.compressedSize <= 16 * 1024 * 1024, 'Archive entry too large');
  assert.equal(entry.generalPurposeBitFlag & 1, 0, 'Encrypted entry refused');
  const mode = (entry.externalFileAttributes >>> 16) & 0o170000;
  assert(mode === 0 || mode === 0o100000, 'Non-file archive entry refused');
  return name;
}
async function archive(bytes) {
  assert(bytes.length <= 16 * 1024 * 1024, 'Archive size bound exceeded');
  const zip = await yauzl.fromBufferPromise(bytes, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true });
  const entries = new Map(), seen = new Set();
  let total = 0;
  try {
    for await (const entry of zip.eachEntry()) {
      const name = validateEntry(entry, seen);
      total += entry.uncompressedSize;
      assert(total <= 32 * 1024 * 1024, 'Archive expansion bound exceeded');
      const chunks = []; let size = 0;
      for await (const chunk of await zip.openReadStreamPromise(entry)) {
        size += chunk.length;
        assert(size <= entry.uncompressedSize, 'Expanded size mismatch');
        chunks.push(chunk);
      }
      assert.equal(size, entry.uncompressedSize);
      entries.set(name, Buffer.concat(chunks));
    }
  } finally { zip.close(); }
  assert.equal(entries.size, payload.length + 2, 'Incomplete archive');
  return entries;
}
function comparePayload(before, after) {
  const expected = payload.map(n => 'extension/' + n).sort();
  assert.deepEqual([...before.keys()].filter(n => n.startsWith('extension/')).sort(), expected);
  assert.deepEqual([...after.keys()].filter(n => n.startsWith('extension/')).sort(), expected);
  return expected.map(name => {
    assert(before.get(name).equals(after.get(name)), 'Payload changed: ' + name);
    return { path: name, bytes: after.get(name).length, sha256: sha(after.get(name)) };
  });
}
function validateManifest(manifest) {
  assert.equal(manifest.publisher + '.' + manifest.name, 'soterai.soterai-ide-guard');
  assert.equal(manifest.version, '0.7.0');
  for (const key of ['scripts', 'dependencies', 'devDependencies', 'optionalDependencies', 'extensionPack', 'extensionDependencies']) {
    assert(!Object.hasOwn(manifest, key), 'Executable/dependency manifest field refused: ' + key);
  }
  assert.equal(manifest.main, './dist/extension.js');
}
async function run({ candidate, expectedSha256, outputDirectory }) {
  assert(/^[a-f0-9]{64}$/.test(expectedSha256), 'Exact candidate hash required');
  candidate = path.resolve(candidate);
  const original = fs.readFileSync(candidate);
  assert.equal(sha(original), expectedSha256, 'Candidate hash mismatch');
  const entries = await archive(original);
  validateManifest(JSON.parse(entries.get('extension/package.json')));
  const inputs = [__filename, path.join(__dirname, 'audit.cjs'), path.join(__dirname, 'package.json'), path.join(__dirname, 'package-lock.json')].map(fileFact);
  const { installedInventory } = require('./audit.cjs');
  const toolchain = installedInventory();
  const vsceMetadata = toolchain.inventory.find(row => row.name === '@vscode/vsce' && row.location === 'node_modules/@vscode/vsce');
  assert.equal(vsceMetadata?.version, '4.1.0', 'Pinned local VSCE required');
  const output = freshDirectory(outputDirectory), staging = path.join(output, 'staging');
  fs.mkdirSync(staging);
  const write = (name, data) => fs.writeFileSync(path.join(output, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
  write('toolchain-inventory.json', toolchain);
  write('started.json', { candidate: fileFact(candidate), toolchain: inputs, node: process.version, startedAt: new Date().toISOString() });
  for (const [name, bytes] of entries) {
    if (!name.startsWith('extension/')) continue;
    // VSCE archives these names in lowercase, but the source manifest's files
    // allowlist uses their conventional uppercase spelling.
    let relative = name.slice('extension/'.length);
    if (relative === 'readme.md') relative = 'README.md';
    if (relative === 'changelog.md') relative = 'CHANGELOG.md';
    const file = path.join(staging, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes, { flag: 'wx' });
  }
  try {
    const vsce = await import('@vscode/vsce');
    const artifact = path.join(output, 'soterai-lite-0.7.0-repack.vsix');
    await vsce.createVSIX({ cwd: staging, packagePath: artifact, dependencies: false, target: 'win32-x64', preRelease: true, rewriteRelativeLinks: false });
    const after = await archive(fs.readFileSync(artifact));
    const unchanged = comparePayload(entries, after);
    const metadataChanges = ['[Content_Types].xml', 'extension.vsixmanifest'].map(name => ({ name, unchanged: entries.get(name).equals(after.get(name)),
      beforeSha256: sha(entries.get(name)), afterSha256: sha(after.get(name)) }));
    assert.equal(sha(fs.readFileSync(candidate)), expectedSha256, 'Original candidate changed');
    assert.deepEqual(inputs.map(row => fileFact(path.join(root, row.path))), inputs, 'Toolchain inputs changed');
    assert.deepEqual(installedInventory(), toolchain, 'Installed toolchain changed during packaging');
    const result = { status: 'PASS_REPACK_PAYLOAD_EQUIVALENCE_NOT_HOST_VERIFIED', completedAt: new Date().toISOString(),
      original: fileFact(candidate), artifact: fileFact(artifact), toolchain: inputs,
      installedToolchain: fileFact(path.join(output, 'toolchain-inventory.json')), node: process.version,
      payload: unchanged, metadataChanges, packageApi: '@vscode/vsce@4.1.0 createVSIX',
      inheritedNativeAcceptance: false, releaseReady: false };
    write('result.json', result);
    return { status: result.status, artifact: result.artifact, identicalPayloadFiles: unchanged.length, metadataChanges };
  } catch (error) {
    write('failure.json', { status: 'FAILED_NOT_ACCEPTED', message: error.message, at: new Date().toISOString(), releaseReady: false });
    throw error;
  }
}
module.exports = { validateEntry, validateManifest, comparePayload, run, archive, payload, fileFact };
if (require.main === module) {
  const [candidate, expectedSha256, outputDirectory, ...extra] = process.argv.slice(2);
  if (!candidate || !expectedSha256 || !outputDirectory || extra.length) {
    console.error('Usage: node package.cjs <candidate.vsix> <sha256> <fresh-output-directory>'); process.exitCode = 1;
  } else run({ candidate, expectedSha256, outputDirectory }).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
}
