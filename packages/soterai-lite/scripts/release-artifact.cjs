'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { auditFinalRelease } = require('./audit-release.cjs');
const IDENTITY = 'soterai.soterai-ide-guard';
const HASH = /^[a-f0-9]{64}$/;
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const demand = (condition, message) => { if (!condition) throw Error(message); };

function relativeFile(root, name) {
    demand(typeof name === 'string' && /^[A-Za-z0-9_.\/-]+$/.test(name) && !path.isAbsolute(name)
        && name.split('/').every(part => part && part !== '.' && part !== '..'), 'Invalid release-relative path');
    const resolved = path.resolve(root, name);
    demand(resolved.startsWith(root + path.sep), 'Release path escaped repository');
    return resolved;
}
function relative(root, file) { return path.relative(root, file).replaceAll('\\', '/'); }
async function parents(root, file) {
    demand(file.startsWith(root + path.sep), 'Release file outside repository');
    for (let cursor = path.dirname(file); ; cursor = path.dirname(cursor)) {
        const stat = await fs.lstat(cursor);
        demand(stat.isDirectory() && !stat.isSymbolicLink(), 'Ordinary release parent required');
        if (cursor === root) break;
    }
}
async function read(root, file, maximum = 2 * 1024 * 1024) {
    await parents(root, file);
    const before = await fs.lstat(file);
    demand(before.isFile() && !before.isSymbolicLink() && before.nlink === 1 && before.size <= maximum, 'Ordinary bounded release file required');
    const bytes = await fs.readFile(file), after = await fs.lstat(file);
    demand(after.isFile() && !after.isSymbolicLink() && after.nlink === 1 && before.ino === after.ino && before.size === after.size
        && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs && bytes.length === before.size, 'Release file changed during read');
    return bytes;
}

async function validateReceipt(repoRoot, packageReceiptPath) {
    const root = path.resolve(repoRoot), receiptFile = path.resolve(packageReceiptPath);
    demand(/^packages\/soterai-lite\/builds\/[^/]+\/package-receipt\.json$/.test(relative(root, receiptFile)), 'Lite build-attempt receipt required');
    const receiptRaw = await read(root, receiptFile), pack = JSON.parse(receiptRaw);
    demand(pack.schemaVersion === 1 && pack.status === 'PACKAGED_NOT_HOST_VERIFIED' && pack.identity === IDENTITY
        && /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(pack.version) && pack.target === 'win32-x64'
        && pack.preRelease === true && pack.releaseReady === false && HASH.test(pack.sha256), 'Unsupported Lite release receipt');
    const attempt = path.dirname(receiptFile), buildPath = relativeFile(root, pack.buildReceiptPath), inventoryPath = relativeFile(root, pack.finalReleaseInventoryPath);
    demand(buildPath === path.join(attempt, 'build-provenance.json') && inventoryPath === path.join(attempt, 'final-release-inventory.json'), 'Release receipts must share a build attempt');
    const buildRaw = await read(root, buildPath), build = JSON.parse(buildRaw);
    demand(sha(buildRaw) === pack.buildReceiptSha256 && build.identity === pack.identity && build.version === pack.version
        && (build.runId ?? 'synthetic') === pack.runId, 'Release identity/build receipt mismatch');
    const artifactPath = relativeFile(root, pack.output);
    demand(pack.output.startsWith('packages/soterai-lite/') && pack.output.endsWith('.vsix'), 'Explicit Lite VSIX required');
    const artifact = await read(root, artifactPath, 16 * 1024 * 1024);
    demand(Number.isSafeInteger(pack.bytes) && artifact.length === pack.bytes && sha(artifact) === pack.sha256, 'Release artifact mismatch');
    const inventoryRaw = await read(root, inventoryPath, 16 * 1024 * 1024);
    const audited = await auditFinalRelease({ repoRoot: root, vsixPath: artifactPath, expectedSha256: pack.sha256, buildReceiptPath: buildPath, packageReceiptPath: receiptFile });
    demand(inventoryRaw.equals(Buffer.from(JSON.stringify(audited.report, null, 2) + '\n')), 'Release inventory mismatch');
    demand(sha(await read(root, receiptFile)) === sha(receiptRaw), 'Release receipt changed during verification');
    return Object.freeze({ identity: pack.identity, version: pack.version, artifactPath: pack.output, artifactName: path.basename(artifactPath),
        bytes: pack.bytes, sha256: pack.sha256, target: pack.target, preRelease: true, releaseReady: false,
        buildAttemptPath: relative(root, attempt), buildReceiptPath: pack.buildReceiptPath, packageReceiptPath: relative(root, receiptFile),
        packageReceiptSha256: sha(receiptRaw), inventoryPath: pack.finalReleaseInventoryPath,
        sbomPath: relative(root, path.join(attempt, 'release-assets/SBOM.cdx.json')) });
}

async function resolveRelease({ repoRoot, pointerPath }) {
    const root = path.resolve(repoRoot), pointerFile = path.resolve(pointerPath), raw = await read(root, pointerFile, 8192), pointer = JSON.parse(raw);
    demand(Object.keys(pointer).sort().join(',') === 'packageReceiptPath,packageReceiptSha256,schemaVersion'
        && pointer.schemaVersion === 1 && HASH.test(pointer.packageReceiptSha256), 'Invalid release pointer');
    const result = await validateReceipt(root, relativeFile(root, pointer.packageReceiptPath));
    demand(result.packageReceiptSha256 === pointer.packageReceiptSha256, 'Release pointer hash mismatch');
    demand(sha(await read(root, pointerFile, 8192)) === sha(raw), 'Release pointer changed during verification');
    return result;
}

async function writeReleasePointer({ repoRoot, packageReceiptPath, pointerPath }) {
    const root = path.resolve(repoRoot), destination = path.resolve(pointerPath);
    relativeFile(root, relative(root, destination));
    await parents(root, destination);
    const result = await validateReceipt(root, packageReceiptPath);
    // Create-only; a stale pointer is never replaced or used as a fallback.
    await fs.writeFile(destination, JSON.stringify({ schemaVersion: 1, packageReceiptPath: result.packageReceiptPath,
        packageReceiptSha256: result.packageReceiptSha256 }, null, 2) + '\n', { flag: 'wx' });
    return result;
}

async function writeGithubOutputs(result, file) {
    const values = { artifact_path: result.artifactPath, artifact_name: result.artifactName, artifact_sha256: result.sha256,
        artifact_bytes: String(result.bytes), extension_id: result.identity, version: result.version, build_attempt_path: result.buildAttemptPath,
        package_receipt_path: result.packageReceiptPath, package_receipt_sha256: result.packageReceiptSha256,
        inventory_path: result.inventoryPath, sbom_path: result.sbomPath };
    for (const value of Object.values(values)) demand(typeof value === 'string' && /^[A-Za-z0-9_.\/-]+$/.test(value), 'Unsafe CI output');
    const handle = await fs.open(file, 'a');
    try {
        const stat = await handle.stat(); demand(stat.isFile() && stat.nlink === 1, 'Ordinary CI output file required');
        await handle.writeFile(Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(''));
    } finally { await handle.close(); }
}

async function writeProvenance(root, result) {
    const attempt = relativeFile(root, result.buildAttemptPath), artifact = { path: result.artifactPath, bytes: result.bytes, sha256: 'sha256:' + result.sha256 };
    let commitSha, dirtyWorktree = true;
    try {
        commitSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim();
        dirtyWorktree = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim().length > 0;
    } catch { /* Unknown source status never becomes clean provenance. */ }
    const sbom = await read(root, relativeFile(root, result.sbomPath), 8 * 1024 * 1024);
    const attestation = { generatedAt: new Date().toISOString(), product: result.identity, version: result.version, commitSha, dirtyWorktree,
        buildCommands: ['node packages/soterai-lite/scripts/package.cjs --receipt-out <new-pointer>'],
        sbomPath: result.sbomPath, sbomPresent: true, artifacts: [artifact, { path: result.sbomPath, bytes: sbom.length, sha256: 'sha256:' + sha(sbom) }],
        artifactHash: artifact.sha256, packageReceiptPath: result.packageReceiptPath, packageReceiptSha256: result.packageReceiptSha256,
        signatureVerified: false, reproducibleBuildVerified: false, releaseReady: false, signingStatus: 'unsigned-local-build',
        claimBoundary: 'Exact Lite artifact and offline inventory verified. Native, independent, human and publication acceptance are separate.' };
    const files = { json: path.join(attempt, 'release-provenance-attestation.json'), markdown: path.join(attempt, 'release-provenance-attestation.md'), checksums: path.join(attempt, 'vscode-release-checksums.sha256') };
    await fs.writeFile(files.json, JSON.stringify(attestation, null, 2) + '\n', { flag: 'wx' });
    await fs.writeFile(files.markdown, `# Lite release provenance\n\nIdentity: ${result.identity}\n\nVersion: ${result.version}\n\nArtifact: ${result.artifactPath}\n\nSHA-256: ${result.sha256}\n\n${attestation.claimBoundary}\n`, { flag: 'wx' });
    await fs.writeFile(files.checksums, `${result.sha256}  ${result.artifactPath}\n`, { flag: 'wx' });
    return files;
}

function parseArguments(args) {
    const options = { command: args.shift() };
    demand(['resolve', 'provenance'].includes(options.command), 'Use resolve or provenance --pointer <path>');
    while (args.length) { const key = args.shift(), value = args.shift(); demand(['--pointer', '--github-output'].includes(key) && value && !Object.hasOwn(options, key), 'Invalid release argument'); options[key] = value; }
    demand(options['--pointer'], 'Explicit release pointer required');
    return options;
}
async function main() {
    const args = parseArguments(process.argv.slice(2)), root = path.resolve(__dirname, '../../..'), result = await resolveRelease({ repoRoot: root, pointerPath: path.resolve(root, args['--pointer']) });
    if (args.command === 'provenance') await writeProvenance(root, result);
    if (args['--github-output']) await writeGithubOutputs(result, args['--github-output']);
    console.log(JSON.stringify(result));
}
module.exports = { resolveRelease, writeReleasePointer, writeGithubOutputs, writeProvenance };
if (require.main === module) main().catch(() => { console.error('Lite release verification failed; no verified CI outputs emitted.'); process.exitCode = 1; });
