'use strict';
// INERT UNTIL ROOT REVIEWS THIS SOURCE AND CREATES THE EXACT ADMISSION.
// Authoring/import defines functions only. There is no bundled approval, retry,
// product loader, bootstrap, API mock, forced activation, browser launch or kill.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');

const REPO = path.resolve(__dirname, '../../../..');
const BASE = 'D:\\SoterAI-Lite-test-profiles';
const PRODUCT = 'soterai.soterai-ide-guard';
const OLD_SHA = 'dcbcd9738cb480616cf4d3aa66d1a1ac2287e1754aa7307dea7ac23fee7c3677';
const OWNED_SHA = 'c3ca6d3b159ecbd825a0e917a40e5c24cb9aa3aeaa76d67a3fa0fc18113dea4f';
const HASH = /^[0-9a-f]{64}$/;
const MAX_FILE = 536870912;
const sha = raw => crypto.createHash('sha256').update(raw).digest('hex');
const same = (left, right) => path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const jsonBytes = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
function inside(root, file) {
  const relative = path.relative(root, file);
  return relative !== '' && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
}
function canonical(file) {
  assert(typeof file === 'string' && /^[A-Za-z]:\\/.test(file));
  assert(!file.startsWith('\\') && !/[\x00-\x1f]/.test(file));
  assert(!file.slice(2).includes(':') && !file.split('\\').slice(1).some(part => /[. ]$/.test(part)), 'No ADS or Windows path aliases');
  assert.equal(path.resolve(file), file, 'Canonical absolute local path required');
  return file;
}
function parents(file) {
  canonical(file);
  for (let cursor = file;; cursor = path.dirname(cursor)) {
    const stat = fs.lstatSync(cursor);
    assert(!stat.isSymbolicLink(), 'Linked input or ancestor refuses admission');
    if (path.dirname(cursor) === cursor) break;
  }
}
function readFile(file, limit = MAX_FILE, publicLinkCount) {
  parents(file);
  const before = fs.lstatSync(file);
  assert(before.isFile() && before.size >= 0 && before.size <= limit);
  if (publicLinkCount !== undefined) {
    assert.equal(file.toLowerCase(), 'c:\\windows\\system32\\windowspowershell\\v1.0\\powershell.exe');
    assert(Number.isInteger(publicLinkCount) && publicLinkCount >= 1 && publicLinkCount <= 16);
    assert.equal(before.nlink, publicLinkCount);
  } else assert.equal(before.nlink, 1, 'Private inputs require one link');
  const raw = fs.readFileSync(file), after = fs.lstatSync(file);
  assert.equal(raw.length, before.size); assert.equal(after.size, before.size);
  assert.equal(after.ino, before.ino); assert.equal(after.mtimeMs, before.mtimeMs);
  return raw;
}
function fact(file, limit = MAX_FILE) {
  const raw = readFile(file, limit);
  return { path: file, bytes: raw.length, sha256: sha(raw) };
}
function pin(row, limit = MAX_FILE) {
  assert(row && HASH.test(row.sha256) && Number.isSafeInteger(row.bytes) && row.bytes >= 0);
  const publicLink = row.path?.toLowerCase() === 'c:\\windows\\system32\\windowspowershell\\v1.0\\powershell.exe'
    ? row.fileLinkCount : undefined;
  const raw = readFile(row.path, limit, publicLink);
  assert.equal(raw.length, row.bytes, 'Pinned size changed');
  assert.equal(sha(raw), row.sha256, 'Pinned bytes changed');
  return raw;
}
function verifyFact(row, limit = MAX_FILE) {
  // Hash large public executables in fixed chunks; do not retain a Code.exe-
  // sized Buffer in the orchestration process beside live Code/renderer hosts.
  assert(row && HASH.test(row.sha256) && Number.isSafeInteger(row.bytes) && row.bytes >= 0);
  parents(row.path); const before = fs.lstatSync(row.path);
  assert(before.isFile() && before.size === row.bytes && before.size <= limit);
  if (row.path.toLowerCase() === 'c:\\windows\\system32\\windowspowershell\\v1.0\\powershell.exe') {
    assert(Number.isInteger(row.fileLinkCount) && row.fileLinkCount >= 1 && row.fileLinkCount <= 16); assert.equal(before.nlink, row.fileLinkCount);
  } else assert.equal(before.nlink, 1);
  const fd = fs.openSync(row.path, 'r'), buffer = Buffer.alloc(65536), digest = crypto.createHash('sha256'); let total = 0;
  try {
    const opened = fs.fstatSync(fd); assert.equal(opened.ino, before.ino); assert.equal(opened.size, before.size);
    while (true) {
      const count = fs.readSync(fd, buffer, 0, buffer.length, null); if (!count) break;
      total += count; assert(total <= limit && total <= before.size); digest.update(buffer.subarray(0, count));
    }
    const after = fs.fstatSync(fd); assert.equal(after.size, before.size); assert.equal(after.ino, before.ino); assert.equal(after.mtimeMs, before.mtimeMs);
  } finally { fs.closeSync(fd); }
  const afterPath = fs.lstatSync(row.path); assert.equal(afterPath.ino, before.ino); assert.equal(afterPath.size, before.size); assert.equal(afterPath.mtimeMs, before.mtimeMs);
  assert.equal(total, row.bytes); assert.equal(digest.digest('hex'), row.sha256);
}
function json(raw) {
  // Reject duplicate property names, including escaped aliases. This parser is
  // shared by admission/receipts/payload manifests; last-key-wins is not allowed.
  const text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
  const value = JSON.parse(text);
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g) ?? [];
  const stack = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token === '{') stack.push(new Set());
    else if (token === '[') stack.push(undefined);
    else if (token === '}' || token === ']') stack.pop();
    else if (token.startsWith('"') && tokens[index + 1] === ':') {
      const keys = stack.at(-1), key = JSON.parse(token);
      assert(keys && !keys.has(key), 'Duplicate JSON property refuses admission'); keys.add(key);
    }
  }
  return value;
}
const pinnedJson = row => json(pin(row, 16 * 1024 * 1024));
function write(file, value) {
  assert(inside(__dirname, file) || inside(activeRoot, file), 'Evidence stays in owned locations');
  parents(path.dirname(file));
  fs.writeFileSync(file, jsonBytes(value), { flag: 'wx' });
  return fact(file, 16 * 1024 * 1024);
}
let activeRoot = __dirname;
function mkdir(file) {
  assert(inside(activeRoot, file));
  if (fs.existsSync(file)) { parents(file); assert(fs.lstatSync(file).isDirectory()); return; }
  const parent = path.dirname(file);
  if (!fs.existsSync(parent)) mkdir(parent);
  parents(parent); fs.mkdirSync(file); parents(file);
}
function copy(row, destination) {
  assert(inside(activeRoot, destination)); parents(path.dirname(destination));
  const raw = pin(row); fs.writeFileSync(destination, raw, { flag: 'wx' });
  return fact(destination);
}
function crc32(raw) {
  let result = 0xffffffff;
  for (const byte of raw) {
    result ^= byte;
    for (let bit = 0; bit < 8; bit++) result = result >>> 1 ^ (result & 1 ? 0xedb88320 : 0);
  }
  return (result ^ 0xffffffff) >>> 0;
}
function inspectVsix(row, expectedVersion, runtimeCount) {
  const archive = pin(row, 16 * 1024 * 1024);
  let eocd = -1;
  for (let offset = archive.length - 22; offset >= Math.max(0, archive.length - 65557); offset--) {
    if (archive.readUInt32LE(offset) === 0x06054b50 && offset + 22 + archive.readUInt16LE(offset + 20) === archive.length) {
      assert.equal(eocd, -1, 'Ambiguous ZIP end record'); eocd = offset;
    }
  }
  assert(eocd >= 0); assert.equal(archive.readUInt16LE(eocd + 4), 0); assert.equal(archive.readUInt16LE(eocd + 6), 0);
  const count = archive.readUInt16LE(eocd + 10), centralBytes = archive.readUInt32LE(eocd + 12);
  let cursor = archive.readUInt32LE(eocd + 16);
  assert.equal(archive.readUInt16LE(eocd + 8), count); assert(count > 0 && count <= 256);
  assert.equal(cursor + centralBytes, eocd);
  const seen = new Set(), entries = new Map(); let payloadUncompressedBytes = 0;
  for (let index = 0; index < count; index++) {
    assert(cursor + 46 <= eocd && archive.readUInt32LE(cursor) === 0x02014b50);
    const flags = archive.readUInt16LE(cursor + 8), method = archive.readUInt16LE(cursor + 10);
    const crc = archive.readUInt32LE(cursor + 16), compressed = archive.readUInt32LE(cursor + 20);
    const uncompressed = archive.readUInt32LE(cursor + 24), nameBytes = archive.readUInt16LE(cursor + 28);
    const extraBytes = archive.readUInt16LE(cursor + 30), commentBytes = archive.readUInt16LE(cursor + 32);
    const external = archive.readUInt32LE(cursor + 38), local = archive.readUInt32LE(cursor + 42);
    assert.equal(archive.readUInt16LE(cursor + 34), 0); assert(!(flags & 1)); assert([0, 8].includes(method));
    assert(nameBytes > 0 && nameBytes <= 240 && uncompressed <= 16 * 1024 * 1024);
    assert(cursor + 46 + nameBytes + extraBytes + commentBytes <= eocd);
    const name = new TextDecoder('utf-8', { fatal: true }).decode(archive.subarray(cursor + 46, cursor + 46 + nameBytes));
    assert(!/[\\\x00-\x1f:]/.test(name) && !name.startsWith('/') && !name.split('/').some(part => part === '.' || part === '..'));
    assert(!seen.has(name.toLowerCase()), 'Duplicate or case-alias ZIP entry'); seen.add(name.toLowerCase());
    assert.notEqual((external >>> 16) & 0xf000, 0xa000, 'ZIP symlink refuses admission');
    assert(local + 30 <= archive.length && archive.readUInt32LE(local) === 0x04034b50);
    assert.equal(archive.readUInt16LE(local + 6), flags); assert.equal(archive.readUInt16LE(local + 8), method);
    const localName = archive.readUInt16LE(local + 26), localExtra = archive.readUInt16LE(local + 28);
    assert.equal(localName, nameBytes);
    assert(archive.subarray(local + 30, local + 30 + localName).equals(archive.subarray(cursor + 46, cursor + 46 + nameBytes)));
    const start = local + 30 + localName + localExtra;
    assert(start + compressed <= archive.readUInt32LE(eocd + 16));
    const compressedRaw = archive.subarray(start, start + compressed);
    const raw = method === 0 ? compressedRaw : zlib.inflateRawSync(compressedRaw, { maxOutputLength: 16 * 1024 * 1024 });
    assert.equal(raw.length, uncompressed); assert.equal(crc32(raw), crc);
    if (name.startsWith('extension/') && !name.endsWith('/')) {
      const relative = name.slice('extension/'.length); assert(relative);
      payloadUncompressedBytes += raw.length; assert(payloadUncompressedBytes <= 64 * 1024 * 1024);
      entries.set(relative, raw);
    }
    cursor += 46 + nameBytes + extraBytes + commentBytes;
  }
  assert.equal(cursor, eocd);
  const manifestRaw = entries.get('package.json'); assert(manifestRaw);
  const manifest = json(manifestRaw);
  assert.equal(manifest.publisher + '.' + manifest.name, PRODUCT);
  assert.equal(manifest.version, expectedVersion); assert.equal(manifest.main, './dist/extension.js');
  assert(!Object.hasOwn(manifest, '__metadata'));
  for (const key of ['extensionDependencies', 'extensionPack']) assert(manifest[key] === undefined || Array.isArray(manifest[key]) && manifest[key].length === 0);
  const runtimes = [...entries].filter(([name]) => /^dist\/[a-z0-9-]+\.js$/.test(name)).map(([relative, raw]) => ({ relative, bytes: raw.length, sha256: sha(raw) }))
    .sort((left, right) => left.relative.localeCompare(right.relative));
  assert.equal(runtimes.length, runtimeCount);
  assert(entries.has('dist/extension.js'));
  return { manifest, manifestRaw, manifestSha256: sha(manifestRaw), runtimes, entries, payloadUncompressedBytes };
}
function verifySource(proof) {
  assert.equal(proof.status, 'FROZEN_F32_INPUTS_NOT_TEST_OR_NATIVE_ACCEPTANCE');
  assert.equal(proof.sourceParent, '4f5154c4c646f057f8bf6518572586cf5a9dad8d');
  assert.equal(proof.fileCount, proof.files.length);
  const paths = new Set();
  for (const row of proof.files) {
    assert(typeof row.path === 'string' && !path.isAbsolute(row.path) && !row.path.includes('\\'));
    const file = path.resolve(REPO, row.path); assert(inside(REPO, file));
    assert(!paths.has(row.path.toLowerCase())); paths.add(row.path.toLowerCase()); pin({ ...row, path: file });
  }
  for (const row of proof.scopedSource) {
    assert(proof.files.some(file => file.path === row.path && file.bytes === row.bytes && file.sha256 === row.sha256));
  }
  for (const row of proof.retainedF26a ?? []) pin({ ...row, path: path.join(REPO, row.path) });
}
function verifyVendor(vendor) {
  for (const row of vendor.vendorFacts) verifyFact(row);
  for (const item of vendor.playwright.packages) {
    parents(item.directory); const found = [], pending = [item.directory]; let bytes = 0;
    while (pending.length) {
      const directory = pending.pop();
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        assert(!entry.isSymbolicLink()); const file = path.join(directory, entry.name);
        assert(inside(item.directory, file));
        const stat = fs.lstatSync(file); assert(!stat.isSymbolicLink());
        if (stat.isDirectory()) pending.push(file);
        else { assert(stat.isFile() && stat.nlink === 1); found.push(file); bytes += stat.size;
          assert(found.length <= 4096 && bytes <= 134217728); }
      }
    }
    assert.deepEqual(found.sort(), item.completeInstalledFileGraph.map(row => row.path).sort(), 'Complete installed vendor package membership changed');
  }
}
function verifyClose(row) {
  const value = typeof row.path === 'string' ? pinnedJson(row) : row;
  for (const [key, expected] of Object.entries({ actualClose: true, exitCode: 0, signal: null,
    stdoutEOF: true, stderrEOF: true, overflow: false, streamError: false, deadlineExceeded: false, signalsRequested: 0 })) assert.equal(value[key], expected, key);
  if (typeof row.path === 'string') for (const stream of value.streams) {
    assert(['stdout', 'stderr'].includes(stream.name));
    const streamFile = row.path.replace(/owned-close\.json$/, stream.name + '.bin');
    assert.notEqual(streamFile, row.path); pin({ path: streamFile, bytes: stream.bytes, sha256: stream.sha256 });
    assert.equal(stream.observedBytes, stream.bytes);
  }
  return value;
}
function reviewedAdmission(admissionFile, expectedSha) {
  assert.equal(process.platform, 'win32'); canonical(admissionFile); assert(HASH.test(expectedSha));
  assert(same(path.dirname(admissionFile), __dirname), 'Admission must be a direct child of this exact evidence directory');
  const raw = readFile(admissionFile, 2 * 1024 * 1024); assert.equal(sha(raw), expectedSha);
  const a = json(raw);
  assert.equal(a.schemaVersion, 1); assert.equal(a.feature, 'F32');
  assert.equal(a.status, 'ROOT_REVIEWED_F32_INSTALLED_ROUND01_FINAL_INPUTS');
  assert.equal(a.normalRound, 1); assert.equal(a.maxNormalRounds, 3);
  assert.equal(a.syntheticOnly, true); assert.equal(a.signalsRequested, 0);
  assert.equal(a.permissionScope, 'LOCAL_SYNTHETIC_INSTALLED_LIFECYCLE_LOOPBACK_ONLY_NO_F26A');
  assert(/^D:\\SoterAI-Lite-test-profiles\\f32-installed-[0-9TZ]+-[a-f0-9]{8}$/.test(a.runRoot)); canonical(a.runRoot);
  assert(same(path.dirname(a.runRoot), BASE)); parents(BASE); assert(fs.lstatSync(BASE).isDirectory());
  assert(!fs.existsSync(a.runRoot), 'Never reuse an installed fixture root');
  assert.equal(a.productVersion, '0.7.0');
  assert.equal(a.oldVsix.bytes, 4446653); assert.equal(a.oldVsix.sha256, OLD_SHA);
  for (const row of Object.values(a.fixtures)) { assert(same(path.dirname(row.path), __dirname)); pin(row); }
  assert(same(a.fixtures.runner.path, __filename));
  for (const [key, filename] of Object.entries({ launch: 'installed-launch-contract-proposed-03.cjs',
    manifest: 'installed-manifest-admission-proposed-02.cjs', observer: 'installed-observer-proposed-03.cjs',
    oldObserver: 'installed-upgrade-old-observer-proposed-02.cjs', observerManifest: 'installed-observer-package-proposed-01.json',
    renderer: 'installed-renderer-proposed-02.cjs', custody: 'installed-owner-custody-proposed-04.ps1',
    brokerObservation: 'installed-broker-observation-proposed-03.cjs', brokerCustody: 'installed-broker-custody-proposed-01.ps1' })) {
    assert.equal(a.fixtures[key].path, path.join(__dirname, filename));
  }
  const helper = path.resolve(__dirname, '../20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs');
  assert.equal(sha(readFile(helper, 65536)), OWNED_SHA);
  const proof = pinnedJson(a.sourceProof); verifySource(proof);
  assert(a.expectedInputCount >= 1110 && a.expectedScopedSourceCount >= 28 && a.expectedTestFileCount >= 357);
  assert.equal(proof.fileCount, a.expectedInputCount); assert.equal(proof.scopedSource.length, a.expectedScopedSourceCount);
  const full = pinnedJson(a.fullAcceptance);
  assert.equal(full.status, 'PASS_F32_CURRENT_ALL_FROZEN_TEST_FILES');
  assert.equal(full.sourceProofSha256, a.sourceProof.sha256); assert.equal(full.fileCount, a.expectedTestFileCount);
  assert.equal(full.counts.fail, 0); assert.equal(full.counts.cancelled, 0); assert.equal(full.counts.todo, 0);
  assert.equal(full.counts.tests, full.counts.pass + full.counts.skipped);
  const coveredTests = full.shards.flatMap(shard => shard.files);
  assert.equal(new Set(coveredTests).size, coveredTests.length);
  assert.deepEqual([...coveredTests].sort(), proof.files.filter(row => row.path.startsWith('packages/vscode-extension/src/__tests__/') && row.path.endsWith('.test.ts')).map(row => row.path).sort());
  assert.equal(coveredTests.length, full.fileCount);
  const aggregate = { tests: 0, pass: 0, fail: 0, cancelled: 0, skipped: 0, todo: 0 };
  for (const shard of full.shards) {
    const closePath = path.join(path.dirname(a.fullAcceptance.path), shard.name + '-owned-close.json');
    verifyClose(fact(closePath));
    const stdout = readFile(closePath.replace(/owned-close\.json$/, 'stdout.bin'), 8 * 1024 * 1024).toString('utf8');
    for (const key of Object.keys(aggregate)) {
      const matches = [...stdout.matchAll(new RegExp('^# ' + key + ' (\\d+)\\r?$', 'gm'))];
      assert.equal(matches.length, 1); assert.equal(Number(matches[0][1]), shard.counts[key]); aggregate[key] += shard.counts[key];
    }
  }
  assert.deepEqual(aggregate, full.counts);
  const qualification = pinnedJson(a.finalQualification);
  assert.equal(qualification.feature, 'F32'); assert.equal(qualification.status, 'FINAL_SOURCE_FULL_COMPILER_VSIX_CONTENT_BACKEND_REVIEWED_NATIVE_PENDING');
  assert.equal(qualification.sourceProofSha256, a.sourceProof.sha256);
  assert.deepEqual(qualification.vsix, a.currentVsix);
  assert.equal(qualification.fullAcceptanceSha256, a.fullAcceptance.sha256);
  assert.equal(qualification.notificationAwaitRegressionSha256, a.notificationAwaitRegression.sha256);
  assert.equal(qualification.currentVendorReceiptSha256, a.vendorReceipt.sha256);
  for (const key of ['compiler', 'content', 'backend']) assert.equal(qualification.checks[key], 'PASS_EXACT_CURRENT');
  const regression = pinnedJson(a.notificationAwaitRegression);
  assert.equal(regression.feature, 'F32'); assert.equal(regression.status, 'PASS_CURRENT_NATIVE_NOTIFICATION_RETURN_CONTRACT');
  assert.equal(regression.sourceProofSha256, a.sourceProof.sha256);
  assert.equal(regression.failed, 0); assert(regression.passed >= 1);
  for (const row of qualification.ownedCloseReceipts) verifyClose(row);
  const vendor = pinnedJson(a.vendorReceipt);
  assert.equal(vendor.feature, 'F32'); assert.equal(vendor.twoStableObservations, true);
  assert.equal(vendor.currentHost.version, '1.144.1');
  assert.equal(vendor.currentHost.commit, '261c84cb1eddf11235f9e2c921425e9663fbe556');
  assert.equal(vendor.currentHost.appRoot, 'C:\\Users\\USER\\AppData\\Local\\Programs\\Microsoft VS Code\\261c84cb1e\\resources\\app');
  assert(vendor.vendorFacts.length >= 100);
  const review = pinnedJson(a.vendorReview);
  assert.equal(review.feature, 'F32'); assert.equal(review.status, 'CURRENT_VENDOR_SIGNATURE_CLI_METADATA_AND_ATTACH_TRANSPORT_REVIEWED');
  assert.equal(review.vendorReceiptSha256, a.vendorReceipt.sha256);
  for (const key of ['currentCodeSigner', 'localCliNoDownload', 'exactInstallerMetadataSerialization', 'playwrightAttachDisconnectOnly', 'completePlaywrightGraph']) assert.equal(review.checks[key], 'PASS_STATIC_REVIEW');
  const vendorPaths = new Set();
  for (const row of vendor.vendorFacts) { assert(!vendorPaths.has(row.path.toLowerCase())); vendorPaths.add(row.path.toLowerCase()); }
  verifyVendor(vendor);
  assert(same(process.execPath, vendor.node.path)); verifyFact(vendor.node);
  for (const row of [vendor.currentHost.executable, vendor.currentHost.codeCli, vendor.currentHost.cliProcessMain, vendor.systemPowerShell]) verifyFact(row);
  assert(vendor.playwright.packages.every(item => item.version === '1.61.1'));
  assert.equal(a.playwrightEntry, vendor.playwright.entry);
  assert(vendorPaths.has(a.playwrightEntry.toLowerCase()));
  assert(Array.isArray(a.debugPorts) && a.debugPorts.length === 8 && new Set(a.debugPorts).size === 8);
  for (const port of a.debugPorts) assert(Number.isInteger(port) && port >= 1024 && port <= 65535);
  assert(Number.isSafeInteger(a.configuredBrokerPort) && a.configuredBrokerPort >= 1024 && a.configuredBrokerPort <= 65535 &&
    a.configuredBrokerPort !== 47321 && !a.debugPorts.includes(a.configuredBrokerPort));
  assert(/^SOTERAI_F32_SYNTHETIC_[A-Z0-9_]{8,80}$/.test(a.syntheticCanary));
  const current = inspectVsix(a.currentVsix, a.productVersion, 4), old = inspectVsix(a.oldVsix, '0.6.3', 3);
  assert.equal(current.manifestSha256, qualification.payload.manifestSha256);
  assert.deepEqual(current.runtimes, [...qualification.payload.runtimes].sort((left, right) => left.relative.localeCompare(right.relative)));
  assert.equal(current.payloadUncompressedBytes, qualification.payload.payloadUncompressedBytes);
  assert.equal(qualification.payload.targetPlatform, 'win32-x64');
  // Pinned current vendor local-VSIX ExtensionKey ignores the XML platform and
  // serializes its default STRING 'undefined' in __metadata for both versions.
  // This is separate from current archive's admitted win32-x64 target above.
  assert.equal(a.installerMetadataTargetPlatform, 'undefined');
  return { admission: a, admissionFact: { path: admissionFile, bytes: raw.length, sha256: expectedSha }, proof, vendor, helper, current, old };
}
function psLiteral(value) { assert(typeof value === 'string' && !/[\x00\r\n]/.test(value)); return "'" + value.replaceAll("'", "''") + "'"; }
function inventory(raw, expectedVersion) {
  const lines = new TextDecoder('utf-8', { fatal: true }).decode(raw).replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line !== '');
  for (const line of lines) assert(/^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9-]*@[0-9A-Za-z.+-]+$/i.test(line), 'Unrecognized CLI output cannot prove an inventory');
  assert.equal(new Set(lines.map(line => line.toLowerCase())).size, lines.length);
  assert.deepEqual(lines, expectedVersion ? [PRODUCT + '@' + expectedVersion] : []);
  return { registered: lines, productExtraInstallCount: lines.filter(line => !line.startsWith(PRODUCT + '@')).length };
}
async function run(admissionFile, expectedSha) {
  const admitted = reviewedAdmission(admissionFile, expectedSha);
  const { admission: a, vendor, current, old } = admitted;
  const launch = require(a.fixtures.launch.path), { phase } = require(admitted.helper);
  const { admitInstalledManifest } = require(a.fixtures.manifest.path);
  // Only test-owned helpers are required. The installed product is never loaded.
  activeRoot = a.runRoot;
  const consumeFile = path.join(__dirname, 'installed-normal-round-01-consumed.json');
  for (const number of ['01', '02', '03']) assert(!fs.existsSync(path.join(__dirname, 'installed-normal-round-' + number + '-consumed.json')), 'A recorded round forbids implicit retry');
  write(consumeFile, { schemaVersion: 1, feature: 'F32', status: 'CONSUMED_ONE_NORMAL_ROUND_NO_RETRY',
    consumedAt: new Date().toISOString(), normalRound: 1, maxNormalRounds: 3, admission: admitted.admissionFact,
    runRoot: a.runRoot, fixtureRunner: a.fixtures.runner, syntheticOnly: true, signalsRequested: 0 });
  fs.mkdirSync(activeRoot); parents(activeRoot);
  const marker = write(path.join(activeRoot, '.f32-owned-installed-root.json'), { feature: 'F32', schemaVersion: 1,
    admission: admitted.admissionFact, consumed: fact(consumeFile), syntheticOnly: true, signalsRequested: 0 });
  const paths = {
    assets: path.join(activeRoot, 'assets'), primaryProfile: path.join(activeRoot, 'profile-primary'),
    restrictedProfile: path.join(activeRoot, 'profile-restricted'), upgradeProfile: path.join(activeRoot, 'profile-upgrade'),
    primaryExtensions: path.join(activeRoot, 'extensions-primary'), upgradeExtensions: path.join(activeRoot, 'extensions-upgrade'),
    primaryWorkspace: path.join(activeRoot, 'workspace-primary'), upgradeWorkspace: path.join(activeRoot, 'workspace-upgrade'),
    receipts: path.join(activeRoot, 'receipts'), observer: path.join(activeRoot, 'observer-current'), oldObserver: path.join(activeRoot, 'observer-old'),
  };
  for (const directory of Object.values(paths)) mkdir(directory);
  const currentVsix = { ...copy(a.currentVsix, path.join(paths.assets, 'current-exact.vsix')), localOnly: true, extensionDependencies: [], extensionPack: [] };
  const oldVsix = { ...copy(a.oldVsix, path.join(paths.assets, 'prior-exact-0.6.3.vsix')), localOnly: true, extensionDependencies: [], extensionPack: [] };
  const manifests = {};
  for (const [name, payload] of [['current', current], ['old', old]]) {
    const file = path.join(paths.assets, name + '-original-package.json'); fs.writeFileSync(file, payload.manifestRaw, { flag: 'wx' }); manifests[name] = fact(file);
  }
  const renderer = copy(a.fixtures.renderer, path.join(paths.assets, 'renderer.cjs'));
  const custody = copy(a.fixtures.custody, path.join(paths.assets, 'custody.ps1'));
  const brokerCustody = copy(a.fixtures.brokerCustody, path.join(paths.assets, 'broker-custody.ps1'));
  for (const [directory, observer] of [[paths.observer, a.fixtures.observer], [paths.oldObserver, a.fixtures.oldObserver]]) {
    copy(a.fixtures.observerManifest, path.join(directory, 'package.json'));
    copy(observer, path.join(directory, 'observer.cjs'));
    copy(a.fixtures.manifest, path.join(directory, 'installed-manifest-admission-proposed-02.cjs'));
    if (directory === paths.observer) copy(a.fixtures.brokerObservation, path.join(directory, 'installed-broker-observation-proposed-03.cjs'));
  }
  const primaryRetained = seedWorkspace(paths.primaryWorkspace, 'primary');
  const upgradeRetained = seedWorkspace(paths.upgradeWorkspace, 'upgrade');
  const completed = [], active = new Set(), observations = new Map(), phaseObservations = [];
  const keep = setInterval(() => {}, 1000);
  let portIndex = 0, lastConfirmedAbsence, currentInstall, upgradeOldInstall, upgradeCurrentInstall;
  function seedWorkspace(workspace, name) {
    mkdir(path.join(workspace, '.soterai'));
    const content = {
      '.aiignore': 'ignored-only.txt\n', '.soterai/policy.json': JSON.stringify({ version: 1, protectedFiles: ['policy-only.txt'], sensitivePaths: [] }, null, 2) + '\n',
      'policy-only.txt': 'F32 synthetic policy-only fixture\n', 'ignored-only.txt': 'F32 synthetic ignore-only fixture\n',
      'denied.txt': 'F32 synthetic manual-deny fixture\n', 'upgrade-public.txt': 'F32 synthetic readable control fixture\n',
      '.env': 'API_KEY=' + a.syntheticCanary + '\n',
    };
    for (const [relative, text] of Object.entries(content)) fs.writeFileSync(path.join(workspace, relative), text, { flag: 'wx' });
    const files = ['.aiignore', '.soterai/policy.json'].map(relative => fact(path.join(workspace, relative)));
    return write(path.join(paths.receipts, name + '-retained-inputs.json'), { schemaVersion: 1, feature: 'F32', syntheticOnly: true, files });
  }
  function stable() {
    verifySource(admitted.proof); pin(admitted.admissionFact); pin(marker);
    for (const row of Object.values(a.fixtures)) pin(row);
    verifyVendor(vendor);
    pin(currentVsix); pin(oldVsix); pin(renderer); pin(custody); pin(brokerCustody);
    pin(primaryRetained); pin(upgradeRetained);
  }
  function binding(profile, extensions, workspace, phaseName, payload = current, vsix = currentVsix) {
    const gate = path.join(profile, 'F32Gate', phaseName); mkdir(gate);
    return {
      schemaVersion: 1, feature: 'F32', status: 'REVIEWED_ONE_NORMAL_ROUND',
      admission: 'FINAL_SOURCE_EXACT_VSIX_CURRENT_VENDOR_AND_OWNER_ABSENCE_REVIEWED', normalRound: 1,
      syntheticOnly: true, signalsRequested: 0, runRoot: activeRoot, profile, extensions, workspace, gate,
      phase: phaseName, observerRoot: phaseName === 'upgrade-old' ? paths.oldObserver : paths.observer,
      product: { id: PRODUCT, version: payload.manifest.version, manifest: manifests[payload === old ? 'old' : 'current'],
        runtimes: payload.runtimes, targetPlatform: a.installerMetadataTargetPlatform, payloadUncompressedBytes: payload.payloadUncompressedBytes },
      vsix, codeCli: vendor.currentHost.codeCli, productDevelopmentPath: undefined, productBootstrap: undefined,
      promptInterception: false, deniedFile: path.join(workspace, 'denied.txt'), envFile: path.join(workspace, '.env'),
      upgradePublicFile: path.join(workspace, 'upgrade-public.txt'), syntheticCanary: a.syntheticCanary,
      configuredBrokerPort: a.configuredBrokerPort,
      retainedInputsPath: (workspace === paths.upgradeWorkspace ? upgradeRetained : primaryRetained).path,
      retainedGeneratedPath: path.join(paths.receipts, workspace === paths.upgradeWorkspace ? 'upgrade-retained-generated.json' : 'primary-retained-generated.json'),
      restartExpectedPath: path.join(paths.receipts, workspace === paths.upgradeWorkspace ? 'upgrade-restart-expected.json' : 'primary-restart-expected.json'),
      vendorReceipt: a.vendorReceipt, rootMarker: marker,
    };
  }
  function own(name, executable, args, b, deadlineMs = 600000, alreadyVerifiedImmediately = false) {
    if (!alreadyVerifiedImmediately) stable();
    const promise = phase({ executable, args, cwd: b.workspace, env: launch.environment(b, b.bindingFile ?? '', false),
      run: b.gate, name, profile: b.profile, deadlineMs });
    active.add(promise); promise.then(() => active.delete(promise), () => active.delete(promise));
    return promise;
  }
  async function accept(promise, name, b) {
    const result = await promise; verifyClose(result.close);
    const close = fact(path.join(b.gate, name + '-owned-close.json')); verifyClose(close);
    completed.push({ name, close }); stable(); return { result, close };
  }
  async function powershell(b, name, functionName, outputName) {
    assert(['Write-F32InitialOwnerAbsence', 'Write-F32ListenerCustody', 'Write-F32OwnerAbsence', 'Watch-F32OwnedBrokerLifetime'].includes(functionName));
    const bindingFile = path.join(b.gate, name + '-binding.json'); write(bindingFile, b);
    const output = path.join(b.gate, outputName), script = path.join(b.gate, name + '-readonly.ps1');
    const code = "$ErrorActionPreference='Stop'\r\n. " + psLiteral(custody.path) + '\r\n' +
      (functionName === 'Watch-F32OwnedBrokerLifetime' ? '. ' + psLiteral(brokerCustody.path) + '\r\n' : '') +
      functionName + ' -BindingPath ' + psLiteral(bindingFile) + ' -OutputPath ' + psLiteral(output) + ' | ConvertTo-Json -Depth 6\r\n';
    fs.writeFileSync(script, code, { flag: 'wx' });
    const outcome = await accept(own(name, vendor.systemPowerShell.path,
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script], b,
      functionName === 'Watch-F32OwnedBrokerLifetime' ? 240000 : 90000), name, b);
    return { output: fact(output, 2 * 1024 * 1024), close: outcome.close };
  }
  async function initialAbsence(b, name) {
    const observed = await powershell(b, name, 'Write-F32InitialOwnerAbsence', name + '-observations.json');
    const data = pinnedJson(observed.output);
    assert.equal(data.feature, 'F32'); assert.equal(data.profile, b.profile); assert.equal(data.signalsRequested, 0);
    assert.equal(data.observations.length, 2);
    for (const row of data.observations) assert.equal(row.exactSyntheticProfileOwnerCount, 0);
    return observed.output;
  }
  async function cli(b, name, operation, expectedVersion) {
    stable();
    b.bindingFile = path.join(b.gate, name + '-cli-binding.json'); write(b.bindingFile, b);
    const startedWallMs = Date.now(), startedMono = performance.now();
    const promise = phase({ executable: vendor.currentHost.executable.path, args: launch.cliArgs(b, operation), cwd: b.workspace,
      env: launch.environment(b, b.bindingFile, true), run: b.gate, name, profile: b.profile, deadlineMs: 180000 });
    active.add(promise); promise.then(() => active.delete(promise), () => active.delete(promise));
    const result = await accept(promise, name, b), completedWallMs = Date.now(), elapsedMs = performance.now() - startedMono;
    const summary = { operation, startedWallMs, completedWallMs, elapsedMs, close: result.close };
    if (operation === 'list') {
      summary.inventory = inventory(fs.readFileSync(path.join(b.gate, name + '-stdout.bin')), expectedVersion);
      assert.equal(summary.inventory.productExtraInstallCount, 0);
    }
    write(path.join(b.gate, name + '-cli-summary.json'), summary); return summary;
  }
  function installedBrokerScript(b) {
    const expected = b.product.runtimes.filter(row => row.relative === 'dist/local-ai-broker.js'); assert.equal(expected.length, 1);
    const candidates = [], children = fs.readdirSync(b.extensions, { withFileTypes: true }); assert(children.length <= 32);
    for (const child of children) {
      assert(!child.isSymbolicLink()); if (!child.isDirectory()) continue;
      const directory = path.join(b.extensions, child.name); parents(directory);
      const manifestFile = path.join(directory, 'package.json'); if (!fs.existsSync(manifestFile)) continue;
      const installed = json(readFile(manifestFile, 1024 * 1024));
      if (installed.publisher + '.' + installed.name !== PRODUCT || installed.version !== b.product.version) continue;
      admitInstalledManifest({ original: b.product.manifest, installedPath: manifestFile,
        installStartedWallMs: b.installStartedWallMs, installCompletedWallMs: b.installCompletedWallMs,
        targetPlatform: b.product.targetPlatform, payloadUncompressedBytes: b.product.payloadUncompressedBytes });
      const script = fact(path.join(directory, expected[0].relative));
      assert.equal(script.bytes, expected[0].bytes); assert.equal(script.sha256, expected[0].sha256); candidates.push(script);
    }
    assert.equal(candidates.length, 1, 'One exact current CLI-installed broker payload is required'); return candidates[0];
  }
  async function native(b, install, trustChoice, upgrade) {
    stable(); assert(portIndex < a.debugPorts.length);
    b.installStartedWallMs = install.startedWallMs; b.installCompletedWallMs = install.completedWallMs;
    if (b.phase === 'restart') b.expectedBrokerScript = installedBrokerScript(b);
    b.endpoint = 'http://127.0.0.1:' + a.debugPorts[portIndex++] + '/';
    b.playwrightEntry = a.playwrightEntry;
    b.rendererPins = [...vendor.playwright.packages.flatMap(item => item.completeInstalledFileGraph), renderer];
    if (trustChoice) b.trustChoice = trustChoice;
    if (upgrade) b.upgrade = upgrade;
    b.prelaunchOwnerAbsence = await initialAbsence(b, b.phase + '-prelaunch-absence');
    stable();
    b.launchWallMs = Date.now(); b.launchMonotonicMs = performance.now();
    b.bindingFile = path.join(b.gate, b.phase + '-observer-binding.json'); write(b.bindingFile, b);
    const codeName = b.phase + '-code';
    // Intentionally start without awaiting: real Code and its pipes remain owned
    // while read-only custody is gathered and the attach-only renderer operates.
    const codePromise = own(codeName, vendor.currentHost.executable.path, launch.windowArgs(b, b.phase, Number(new URL(b.endpoint).port)), b, 600000, true);
    const startFile = path.join(b.gate, codeName + '-owned-start.json');
    const startDeadline = Date.now() + 30000;
    while (!fs.existsSync(startFile) && Date.now() < startDeadline) await wait(80);
    assert(fs.existsSync(startFile), 'No witnessed owned-start; retain Code ownership and stop');
    b.ownerReceipt = fact(startFile); const start = pinnedJson(b.ownerReceipt);
    assert.equal(start.status, 'STARTED_NOT_COMPLETED'); assert(Number.isInteger(start.pid) && start.pid > 0);
    assert.equal(start.signalsRequested, 0); b.codePid = start.pid;
    const listener = await powershell(b, b.phase + '-listener-custody', 'Write-F32ListenerCustody', b.phase + '-listener-custody.json');
    b.listenerCustody = listener.output;
    const custodyValue = pinnedJson(listener.output);
    assert.equal(custodyValue.rootCodePid, b.codePid); assert.equal(custodyValue.signals, 0);
    assert.equal(custodyValue.localAddress, '127.0.0.1'); assert.equal(custodyValue.localPort, Number(new URL(b.endpoint).port));
    const custodyWallMs = Date.parse(custodyValue.observedAt);
    assert(Number.isFinite(custodyWallMs) && custodyWallMs >= b.launchWallMs && Date.now() >= custodyWallMs && Date.now() - custodyWallMs <= 30000,
      'Fresh witnessed listener custody is required immediately before attach');
    b.bindingFile = path.join(b.gate, b.phase + '-renderer-binding.json'); write(b.bindingFile, b);
    const rendererName = b.phase + '-renderer';
    const rendererPromise = own(rendererName, vendor.node.path, [renderer.path, b.bindingFile], b, 600000, true);
    const brokerMonitor = b.phase === 'restart'
      ? powershell(b, 'restart-broker-lifetime-monitor', 'Watch-F32OwnedBrokerLifetime', 'restart-broker-lifetime-result.json') : undefined;
    // allSettled retains both ownership promises even if one reported a failure.
    const pending = [accept(rendererPromise, rendererName, b), accept(codePromise, codeName, b)];
    if (brokerMonitor) pending.push(brokerMonitor);
    const settled = await Promise.allSettled(pending);
    for (const result of settled) assert.equal(result.status, 'fulfilled', 'A native child failed; no next phase');
    b.ownerClose = settled[1].value.close;
    let brokerLifetime;
    if (brokerMonitor) {
      brokerLifetime = settled[2].value.output;
      const verified = pinnedJson(brokerLifetime);
      assert.equal(verified.feature, 'F32'); assert.equal(verified.status, 'BROKER_LIFETIME_CUSTODY_AND_ABSENCE_OBSERVED');
      assert.equal(verified.signalsRequested, 0);
    }
    const absence = await powershell(b, b.phase + '-postclose-absence', 'Write-F32OwnerAbsence', b.phase + '-owner-absence.json');
    const absent = pinnedJson(absence.output);
    assert.equal(absent.rootCodePid, b.codePid); assert.equal(absent.signalsRequested, 0);
    assert.equal(absent.observations.length, 2);
    for (const row of absent.observations) {
      assert.equal(row.exactSyntheticProfileOwnerCount, 0); assert.equal(row.capturedPidsAbsent, true);
    }
    lastConfirmedAbsence = absence.output;
    const resultFile = path.join(b.gate, b.phase + '-observer-results.json');
    assert(!fs.existsSync(path.join(b.gate, b.phase + '-observer-failure.json')));
    const resultFact = fact(resultFile, 2 * 1024 * 1024), result = pinnedJson(resultFact);
    assert.equal(result.feature, 'F32'); assert.equal(result.phase, b.phase);
    assert.equal(result.failed, 0); assert.equal(result.notRun, 0); assert.equal(result.signalsRequested, 0);
    assert.equal(result.status, b.phase === 'upgrade-old' ? 'PASS_SCOPED_OLD_INSTALLED_SEED' : 'PASS_SCOPED_OBSERVER_API');
    assert.equal(result.passed, result.observations.length);
    const renderedFact = fact(path.join(b.gate, b.phase + '-renderer-results.json'), 2 * 1024 * 1024);
    const rendered = pinnedJson(renderedFact); assert.equal(rendered.status, 'OBSERVED_REAL_KEYBOARD');
    assert.equal(rendered.productPromptInterception, false); assert.equal(rendered.productApiReplacement, false);
    for (const row of result.observations) { assert.equal(row.status, 'PASS'); assert(/^(I\d\d|U\d\d|O01|B0[12])$/.test(row.id));
      if (!observations.has(row.id)) observations.set(row.id, { ...row, firstObservedPhase: b.phase }); }
    const observedAdminTextCount = rendered.observations.filter(row => /administrator|elevat|\buac\b/i.test(row.contains ?? '')).length;
    phaseObservations.push({ phase: b.phase, observerCount: result.observations.length, observerIds: result.observations.map(row => row.id),
      observedWorkbenchAdminPromptTextCount: observedAdminTextCount, fixtureHelperElevation: custodyValue.fixtureHelperElevation,
      codeRootElevation: custodyValue.codeRootElevation, renderer: renderedFact });
    const phaseFact = write(path.join(b.gate, b.phase + '-phase-scoped-result.json'), {
      feature: 'F32', phase: b.phase, status: 'PASS_SCOPED_API_UI_AND_DECLARED_ROOT_CLOSURE',
      observer: resultFact, renderer: renderedFact, codeClose: b.ownerClose, listenerCustody: listener.output,
      ...(brokerLifetime ? { brokerLifetime } : {}),
      ...(brokerLifetime ? { independentRawBrokerPipeEOF: 'NOT_EXPOSED_PUBLIC_API_NO_PRODUCT_INTERCEPTION',
        brokerCloseAuthority: 'PINNED_PRODUCT_PUBLIC_STOPPED_CONJUNCTION_PLUS_ACTUAL_PID_SCRIPT_CUSTODY_AND_TWICE_ABSENCE' } : {}),
      ownerAbsence: absence.output, elapsedOwnedWindowMs: performance.now() - b.launchMonotonicMs,
      unadmittedDescendantCount: custodyValue.unadmittedDescendantCount,
      observedWorkbenchAdminPromptTextCount: observedAdminTextCount,
      adminPromptsOutsideWorkbench: 'UNVERIFIED_NOT_IN_WORKBENCH_CDP_SCOPE', nestedVendorBothEOF: 'NOT_INFERRED_FROM_ROOT_CODE_CLOSE', signalsRequested: 0,
    });
    return { result: resultFact, codeClose: b.ownerClose, phase: phaseFact, binding: b };
  }
  try {
    // Each new profile is prepared once. Restarts preserve real product settings.
    for (const profile of [paths.primaryProfile, paths.restrictedProfile, paths.upgradeProfile]) {
      const workspace = profile === paths.upgradeProfile ? paths.upgradeWorkspace : paths.primaryWorkspace;
      const extensions = profile === paths.upgradeProfile ? paths.upgradeExtensions : paths.primaryExtensions;
      const b = binding(profile, extensions, workspace, 'primary'); launch.prepareUserSettings(b);
      for (const relative of ['Home', 'AppData/Roaming', 'AppData/Local', 'XdgConfig', 'XdgData', 'Temp']) mkdir(path.join(profile, relative));
    }
    const primary = binding(paths.primaryProfile, paths.primaryExtensions, paths.primaryWorkspace, 'primary');
    await initialAbsence(primary, 'primary-before-cli-absence');
    await cli(primary, 'primary-inventory-before', 'list', undefined);
    currentInstall = await cli(primary, 'primary-install-current', 'install');
    await cli(primary, 'primary-inventory-installed', 'list', a.productVersion);
    await native(primary, currentInstall, 'Yes, I trust the authors');
    await native(binding(paths.primaryProfile, paths.primaryExtensions, paths.primaryWorkspace, 'restart'), currentInstall);
    await native(binding(paths.restrictedProfile, paths.primaryExtensions, paths.primaryWorkspace, 'untrusted'), currentInstall, "No, I don't trust the authors");
    await native(binding(paths.primaryProfile, paths.primaryExtensions, paths.primaryWorkspace, 'disabled'), currentInstall);
    const uninstalled = binding(paths.primaryProfile, paths.primaryExtensions, paths.primaryWorkspace, 'uninstalled');
    await initialAbsence(uninstalled, 'primary-before-uninstall-absence');
    await cli(uninstalled, 'primary-uninstall-current', 'uninstall');
    await cli(uninstalled, 'primary-inventory-uninstalled', 'list', undefined);
    await native(uninstalled, currentInstall);

    const upgradeOld = binding(paths.upgradeProfile, paths.upgradeExtensions, paths.upgradeWorkspace, 'upgrade-old', old, oldVsix);
    await initialAbsence(upgradeOld, 'upgrade-before-cli-absence');
    await cli(upgradeOld, 'upgrade-inventory-before', 'list', undefined);
    upgradeOldInstall = await cli(upgradeOld, 'upgrade-install-real-063', 'install');
    await cli(upgradeOld, 'upgrade-inventory-real-063', 'list', '0.6.3');
    const seed = await native(upgradeOld, upgradeOldInstall, 'Yes, I trust the authors');
    const upgradeCurrent = binding(paths.upgradeProfile, paths.upgradeExtensions, paths.upgradeWorkspace, 'upgrade-current');
    await initialAbsence(upgradeCurrent, 'upgrade-before-current-install-absence');
    upgradeCurrentInstall = await cli(upgradeCurrent, 'upgrade-install-current', 'install');
    await cli(upgradeCurrent, 'upgrade-inventory-current', 'list', a.productVersion);
    const upgrade = { seedResult: seed.result, oldCodeClose: seed.codeClose,
      oldInstallClose: upgradeOldInstall.close, currentInstallClose: upgradeCurrentInstall.close };
    const upgraded = await native(upgradeCurrent, upgradeCurrentInstall, undefined, upgrade);
    await native(binding(paths.upgradeProfile, paths.upgradeExtensions, paths.upgradeWorkspace, 'upgrade-restart'), upgradeCurrentInstall, undefined,
      { ...upgrade, upgradedCodeClose: upgraded.codeClose });
    assert.equal(portIndex, 8, 'Eight independently owned real Code windows are expected');
    for (const id of Array.from({ length: 28 }, (_, index) => 'I' + String(index + 1).padStart(2, '0'))) assert(observations.has(id), 'Missing required lifecycle assertion ' + id);
    for (const id of Array.from({ length: 13 }, (_, index) => 'U' + String(index + 1).padStart(2, '0'))) assert(observations.has(id), 'Missing genuine upgrade assertion ' + id);
    assert(observations.has('O01'), 'Minimal actual native onboarding observation is required');
    for (const id of ['B01', 'B02']) assert(observations.has(id), 'Actual fresh owned broker start/stop observation is required');
    assert.equal(observations.size, 44, 'Repeated identity checks never inflate unique assertion count');
    assert.equal(phaseObservations.reduce((sum, row) => sum + row.observerCount, 0), 59);
    stable();
    // No new human/admin gate. Normal shell:false spawn never requests RunAs.
    // Workbench renderer observations do not measure the OS secure desktop.
    // Keep that metric UNVERIFIED until actual reviewed token/UI evidence exists.
    write(path.join(paths.receipts, 'installed-round-01-result.json'), {
      schemaVersion: 1, feature: 'F32', status: 'SCOPED_AUTOMATED_LIFECYCLE_RECORDED_FINAL_GATES_PENDING',
      admission: admitted.admissionFact, sourceProof: a.sourceProof, currentVsix: a.currentVsix, oldVsix: a.oldVsix,
      currentVendorReceipt: a.vendorReceipt, runRoot: activeRoot, rootMarker: marker, completed,
      uniqueObservations: [...observations.values()], uniqueObservationCount: observations.size,
      phaseObservations, totalPhaseObservations: phaseObservations.reduce((sum, row) => sum + row.observerCount, 0),
      privilegeObservation: { elevationRequestsIssuedByRunner: 0, spawnMechanism: 'OWNED_SHELL_FALSE_NO_RUNAS',
        observedWorkbenchAdminPromptTextCount: phaseObservations.reduce((sum, row) => sum + row.observedWorkbenchAdminPromptTextCount, 0),
        installationScope: 'EXACT_LOCAL_VSIX_IN_ISOLATED_USER_EXTENSIONS_DIRECTORY',
        osSecureDesktopAdminPrompts: 'UNVERIFIED_NOT_IN_WORKBENCH_CDP_SCOPE', productAndCliTokenElevation: 'UNVERIFIED_WITHOUT_REVIEWED_TOKEN_OBSERVATION' },
      lastConfirmedOwnerAbsence: lastConfirmedAbsence,
      declaredCodeWindowCount: portIndex, normalRound: 1, maxNormalRounds: 3,
      nestedVendorBothEOF: 'NOT_PROVED_BY_CODE_ROOT_CLOSE', releaseReady: false,
      limitations: ['Only actual declared roots and captured exact-profile Code owners have closure/absence evidence',
        'Broker private stdout/stderr pipe capture and exit code are not exposed by the public API; source-bound stopped state and actual custody/absence are retained',
        'Live Disable/Reload UI is not covered by launch-disabled observation', 'No independent human/different-vendor final evidence',
        'Old ciphertext is retained without decryption or raw-secret restore', 'F26a remains user-skipped INCOMPLETE and unsupported',
        'OriginalL6 HUMAN-ACTIONS STOP remains mandatory'], signalsRequested: 0,
    });
  } catch (error) {
    // Wait every already-spawned owner to its actual natural close. The helper's
    // deadline writes STOP_UNCONFIRMED without signalling; no next phase starts.
    write(path.join(paths.receipts, 'installed-round-01-failure.json'), {
      feature: 'F32', status: 'FAIL_OR_INCOMPLETE_RETAIN_OWNERSHIP_NO_RETRY_NO_NEXT_PHASE',
      errorName: error instanceof Error ? error.name : 'UnknownFailure', completed,
      lastConfirmedOwnerAbsence: lastConfirmedAbsence ?? null, signalsRequested: 0,
    });
    await Promise.allSettled([...active]); throw error;
  } finally { await Promise.allSettled([...active]); clearInterval(keep); }
}
if (require.main === module) {
  if (process.argv.length !== 4) {
    process.stderr.write('INERT: exact root-reviewed admission path and SHA256 are required.\n'); process.exitCode = 1;
  } else run(process.argv[2], process.argv[3]).catch(error => {
    process.stderr.write(JSON.stringify({ feature: 'F32', status: 'FAIL_OR_INCOMPLETE_NO_RETRY',
      errorName: error instanceof Error ? error.name : 'UnknownFailure', signalsRequested: 0 }) + '\n'); process.exitCode = 1;
  });
}
module.exports = { run, reviewedAdmission, inspectVsix, inventory, json, psLiteral };
