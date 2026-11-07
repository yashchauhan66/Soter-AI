'use strict';
// Builds the VS Code 1.145.0 successor evidence for the single extra06 attempt:
//   current-package-qualification-02.json  (re-verifies unchanged source/VSIX/package chain against the new vendor receipt)
//   current-vendor-review-02.json          (signer, CLI/installer, Playwright graph, window.dialogStyle witness)
// Read-only. No host launch, no process or listener query, no network.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../..'), own = n => path.join(__dirname, n);
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const fact = f => { const b = fs.readFileSync(f); return { path: path.resolve(f), bytes: b.length, sha256: sha(b) }; };
const read = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
function hashFile(file) {
  const fd = fs.openSync(file, 'r'), chunk = Buffer.alloc(65536), digest = crypto.createHash('sha256'); let total = 0;
  try { for (;;) { const n = fs.readSync(fd, chunk, 0, chunk.length, null); if (!n) break; total += n; digest.update(chunk.subarray(0, n)); } }
  finally { fs.closeSync(fd); }
  return { bytes: total, sha256: digest.digest('hex') };
}
function pin(row) {
  const file = path.isAbsolute(row.path) ? row.path : path.join(repo, row.path), stat = fs.lstatSync(file);
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1, file);
  const h = hashFile(file); assert.equal(h.bytes, row.bytes, file); assert.equal(h.sha256, row.sha256, file);
}
function write(name, value) { fs.writeFileSync(own(name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); return fact(own(name)); }
(() => {
  const vendorFact = fact(own('public-vendor-observation-03.json')), vendor = read(vendorFact.path), oldVendor = read(own('public-vendor-observation-02.json'));
  assert.equal(vendor.currentHost.version, '1.145.0'); assert.equal(vendor.currentHost.commit, 'a717861c07586a53d83b80d742cd3f59b20a6273');
  assert.equal(vendor.twoStableObservations, true); assert.equal(vendor.vendorFacts.length, 180);
  // Third observation: every receipt row against the bytes on disk right now.
  for (const row of vendor.vendorFacts) {
    const stat = fs.lstatSync(row.path); assert(stat.isFile() && !stat.isSymbolicLink() && stat.size === row.bytes, row.path);
    assert.equal(hashFile(row.path).sha256, row.sha256, row.path);
  }
  // What changed between the 1.144.1 receipt and this one.
  const oldRoot = oldVendor.currentHost.appRoot.toLowerCase(), newRoot = vendor.currentHost.appRoot, byPath = new Map(vendor.vendorFacts.map(r => [r.path.toLowerCase(), r]));
  const unchanged = [], changed = [];
  for (const r of oldVendor.vendorFacts) {
    const p = r.path.toLowerCase().startsWith(oldRoot) ? newRoot + r.path.slice(oldRoot.length) : r.path, n = byPath.get(p.toLowerCase());
    assert(n, 'row missing from current receipt: ' + p);
    (n.sha256 === r.sha256 && n.bytes === r.bytes ? unchanged : changed).push(p);
  }
  const playwrightFiles = vendor.playwright.packages.flatMap(item => item.completeInstalledFileGraph.map(r => r.path.toLowerCase()));
  assert(playwrightFiles.length >= 150);
  for (const p of playwrightFiles) assert(unchanged.map(x => x.toLowerCase()).includes(p), 'Playwright file changed between receipts: ' + p);
  for (const p of [vendor.node.path, vendor.systemPowerShell.path]) assert(unchanged.map(x => x.toLowerCase()).includes(p.toLowerCase()), p);
  const signatures = fact(own('current-signature-observation-03.json')), sig = read(signatures.path);
  assert.equal(sig.vendorReceiptSha256, vendorFact.sha256); assert(sig.rows.length === 3 && sig.rows.every(r => r.status === 'Valid'));
  assert(/Microsoft Corporation/.test(sig.rows[0].signerSubject)); assert.equal(sig.rows[0].sha256, vendor.currentHost.executable.sha256);
  const size = fact(own('vendor-installed-size-qualification-03.json')), sizeValue = read(size.path);
  assert.equal(sizeValue.status, 'PASS_CURRENT_VENDOR_INSTALLED_SIZE_INCLUDES_EXACT_VSIXMANIFEST'); assert.equal(sizeValue.vendorReceiptSha256, vendorFact.sha256);
  assert.equal(sizeValue.cliInstalls, 2); assert.equal(sizeValue.guiWindows, 0); assert.equal(sizeValue.signalsRequested, 0);
  // window.dialogStyle witness from the exact pinned workbench bundle.
  const workbenchRow = vendor.currentHost.applicationFiles.find(r => r.path.endsWith('out\\vs\\workbench\\workbench.desktop.main.js')); assert(workbenchRow);
  assert.equal(hashFile(workbenchRow.path).sha256, workbenchRow.sha256);
  const wb = fs.readFileSync(workbenchRow.path, 'utf8');
  const at = wb.indexOf('"window.dialogStyle":{type:"string",enum:["native","custom"],default:"native"'); assert(at >= 0);
  const useAt = wb.indexOf('get useCustomDialog(){return this.configurationService.getValue("window.dialogStyle")==="custom"'); assert(useAt >= 0);
  // Package chain: unchanged source, VSIX and prior component evidence re-pinned right now.
  const priorQualification = fact(own('current-package-qualification-01.json')), q = read(priorQualification.path);
  const proof = read(own('full-inputs-04.json')); assert.equal(proof.files.length, 1110); assert.equal(q.sourceProofSha256, fact(own('full-inputs-04.json')).sha256);
  proof.files.forEach(pin); pin(q.vsix);
  for (const row of [q.inspection, q.backend, ...q.ownedCloseReceipts]) pin(row);
  const reverifiedAt = new Date().toISOString();
  const qualification = { ...q, observedAt: reverifiedAt, currentVendorReceiptSha256: vendorFact.sha256,
    supersedes: priorQualification, vendorChange: { from: { version: oldVendor.currentHost.version, commit: oldVendor.currentHost.commit },
      to: { version: vendor.currentHost.version, commit: vendor.currentHost.commit } },
    reverification: { at: reverifiedAt, sourceFilesRepinned: proof.files.length, vsixRepinned: q.vsix.sha256, referencedEvidenceRepinned: 2 + q.ownedCloseReceipts.length,
      note: 'No source, VSIX, compiler, backend or package evidence changed since the 4 Nov qualification; only the pinned vendor receipt differs.' } };
  const qualificationFact = write('current-package-qualification-02.json', qualification);
  const transport = fact(own('local-cdp-transport-review-02.json'));
  const review = { feature: 'F32', status: 'CURRENT_VENDOR_SIGNATURE_CLI_METADATA_AND_ATTACH_TRANSPORT_REVIEWED', observedAt: reverifiedAt,
    vendorReceiptSha256: vendorFact.sha256, vendor: { version: vendor.currentHost.version, commit: vendor.currentHost.commit, appRoot: vendor.currentHost.appRoot },
    signatures, installerContract: size, transport,
    launcher: fact(own('installed-launch-contract-proposed-04.cjs')),
    vendorDelta: { unchangedRows: unchanged.length, changedRows: changed.length, changedPaths: changed, playwrightGraphFilesUnchanged: playwrightFiles.length,
      nodeAndSystemPowerShellUnchanged: true },
    dialogStyleWitness: { file: workbenchRow, setting: 'window.dialogStyle', enum: ['native', 'custom'], default: 'native', settingOffset: at, useCustomDialogOffset: useAt,
      meaning: 'Windows default renders extension modal messages as OS dialogs outside the workbench DOM; launch contract 04 sets custom so the unmodified product modal renders as .monaco-dialog-box.' },
    checks: { currentCodeSigner: 'PASS_STATIC_REVIEW', localCliNoDownload: 'PASS_STATIC_REVIEW', exactInstallerMetadataSerialization: 'PASS_STATIC_REVIEW',
      playwrightAttachDisconnectOnly: 'PASS_STATIC_REVIEW', completePlaywrightGraph: 'PASS_STATIC_REVIEW' },
    basis: { currentCodeSigner: 'Authenticode Valid, Microsoft Corporation, Code.exe hash equals receipt (three observations: 4 Nov twice, 6 Nov)',
      localCliNoDownload: 'Real pinned CLI installed both exact local VSIX files with --do-not-sync and no extension dependency; no network authority was granted; one stderr line per install is retained',
      exactInstallerMetadataSerialization: 'Real CLI output of both VSIX files admitted by the exact-serialization function (size = payload + extension.vsixmanifest)',
      playwrightAttachDisconnectOnly: 'Playwright 1.61.1 package files byte-identical to the receipt reviewed in local-cdp-transport-review-02.json',
      completePlaywrightGraph: 'Complete installed graph equals receipt membership; every file unchanged since the reviewed receipt' },
    scope: 'Read-only exact current vendor, local CLI behavior for two exact VSIX files and static package review; no universal network fence or native GUI coverage inference',
    independence: 'LOW_SAME_LINEAGE_SOURCE_REVIEW', nativeLaunches: 0, guiWindows: 0, signalsRequested: 0 };
  const reviewFact = write('current-vendor-review-02.json', review);
  console.log(JSON.stringify({ status: 'PASS_EXTRA06_VENDOR_AND_PACKAGE_EVIDENCE_BUILT', vendorFact, rowsVerified: vendor.vendorFacts.length, unchanged: unchanged.length, changed: changed.length,
    qualification: qualificationFact, review: reviewFact, signatures, size }, null, 1));
})();
