'use strict';
// Offline reassessment of retained OSV responses against the isolated lockfile.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const semver = require('semver');
const { fileFact } = require('./package.cjs');
const root = path.resolve(__dirname, '../..');
const json = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
function pinned(row) {
  const file = path.resolve(root, row.path), current = fileFact(file);
  assert.equal(current.sha256, row.sha256, 'Pinned file hash mismatch');
  assert.equal(current.bytes, row.bytes, 'Pinned file size mismatch');
  return file;
}
function inRange(version, range) {
  assert(semver.valid(version), 'Valid installed version required');
  assert.equal(range.type, 'SEMVER', 'Unsupported range type');
  assert(Array.isArray(range.events) && range.events.length, 'Missing range events');
  let lower = null, matched = false;
  for (const event of range.events) {
    const keys = Object.keys(event);
    assert.equal(keys.length, 1, 'Ambiguous range event');
    const key = keys[0], value = event[key];
    assert(['introduced', 'fixed', 'last_affected', 'limit'].includes(key), 'Unsupported range event');
    assert((key === 'introduced' && value === '0') || semver.valid(value), 'Invalid version boundary');
    if (key === 'introduced') {
      assert.equal(lower, null, 'Overlapping range intervals'); lower = value;
    } else {
      assert.notEqual(lower, null, 'Range end without introduction');
      assert(lower === '0' || semver.lte(lower, value), 'Unordered range endpoints');
      if ((lower === '0' || semver.gte(version, lower)) && (key === 'last_affected' ? semver.lte(version, value) : semver.lt(version, value))) matched = true;
      lower = null;
    }
  }
  return matched || (lower !== null && (lower === '0' || semver.gte(version, lower)));
}
function affected(version, record) {
  return (record.versions || []).includes(version) || (record.ranges || []).some(range => inRange(version, range));
}
function installedInventory() {
  const lock = json(path.join(__dirname, 'package-lock.json'));
  assert.equal(lock.lockfileVersion, 3);
  const inventory = [], absentOptional = [], files = [];
  for (const [relative, expected] of Object.entries(lock.packages)) {
    if (!relative) continue;
    assert(relative.startsWith('node_modules/') && !relative.includes('..') && !expected.link, 'External dependency refused');
    const file = path.join(__dirname, relative, 'package.json');
    if (!fs.existsSync(file)) { assert(expected.optional, 'Required locked dependency missing: ' + relative); absentOptional.push(relative); continue; }
    const metadata = json(file);
    assert.equal(metadata.version, expected.version, 'Installed version differs from lockfile');
    assert(semver.satisfies(process.version, metadata.engines?.node || '*', { includePrerelease: true }), 'Unsupported Node engine: ' + metadata.name);
    const locationName = relative.slice(relative.lastIndexOf('node_modules/') + 'node_modules/'.length);
    assert.equal(metadata.name, locationName, 'Installed package identity mismatch');
    inventory.push({ name: metadata.name, version: metadata.version, location: relative, metadata: fileFact(file) });
  }
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(directory, entry.name);
      assert(!entry.isSymbolicLink(), 'Linked toolchain input refused');
      if (entry.isDirectory()) visit(file);
      else { assert(entry.isFile()); files.push(fileFact(file)); }
    }
  }
  visit(path.join(__dirname, 'node_modules'));
  const known = new Set(inventory.map(p => p.metadata.path));
  for (const row of files) {
    if (/\/node_modules\/(?:@[^/]+\/)?[^/]+\/package\.json$/.test(row.path)) assert(known.has(row.path), 'Untracked installed dependency: ' + row.path);
  }
  return { lock: fileFact(path.join(__dirname, 'package-lock.json')), inventory, absentOptional, files };
}
function assess(report, inventory) {
  assert.equal(report.records.length, 42, 'Original 42 advisory records required');
  assert.equal(new Set(report.records.map(r => r.id)).size, 42);
  return report.records.map(record => {
    const raw = json(pinned(record.rawResponse));
    assert.equal(raw.id, record.id);
    assert(!raw.withdrawn, 'Retained active advisory changed');
    const rows = raw.affected.filter(r => r.package?.ecosystem === 'npm');
    assert(rows.length > 0, 'npm affected ranges required');
    const names = [...new Set(rows.map(r => r.package.name))];
    const candidates = inventory.filter(p => names.includes(p.name));
    const matches = candidates.filter(p => rows.some(r => r.package.name === p.name && affected(p.version, r)));
    return { id: raw.id, severity: record.severityLabelAsSupplied, rawResponse: record.rawResponse,
      packages: names, installed: candidates, affected: matches,
      disposition: !candidates.length ? 'REMOVED_FROM_ISOLATED_TOOLCHAIN' : !matches.length ? 'FIXED_VERSION_IN_ISOLATED_TOOLCHAIN' : 'STILL_AFFECTED' };
  });
}
function run(reportFile, npmAuditFile, output) {
  output = path.resolve(output);
  const evidenceRoot = path.join(root, 'docs/soterai-lite/evidence/20261108-queue-completion');
  assert.equal(path.dirname(output), evidenceRoot, 'Expected evidence output directory');
  assert(!fs.existsSync(output), 'Existing evidence refused');
  const reportFact = fileFact(path.resolve(reportFile)), auditFact = fileFact(path.resolve(npmAuditFile));
  const report = json(reportFile), npmAudit = json(npmAuditFile), installed = installedInventory();
  assert.equal(npmAudit.auditReportVersion, 2); assert(!npmAudit.error);
  assert.equal(npmAudit.metadata.vulnerabilities.total, 0, 'Current npm audit has findings');
  assert.equal(Object.keys(npmAudit.vulnerabilities).length, 0);
  const records = assess(report, installed.inventory);
  assert(records.every(r => r.affected.length === 0), 'Known advisory still affects the isolated toolchain');
  const result = { status: 'PASS_ISOLATED_PACKAGER_RETAINED42_AND_CURRENT_NPM_AUDIT', observedAt: new Date().toISOString(),
    node: process.version, assessor: fileFact(__filename), packageManifest: fileFact(path.join(__dirname, 'package.json')),
    retainedReport: reportFact, npmAudit: auditFact, currentNpmReportedVulnerabilities: 0,
    ...installed, records, removedAssociations: records.filter(r => !r.installed.length).length,
    fixedVersionAssociations: records.filter(r => r.installed.length && !r.affected.length).length,
    currentCandidateHistoricalBuildAuditChanged: false, releaseReady: false,
    scope: 'This isolated packaging toolchain only. The retained candidate was built with the historical toolchain; its original 42 findings and other release gates are unchanged.' };
  pinned(reportFact); pinned(auditFact);
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  return { status: result.status, installedPackages: installed.inventory.length, retainedAdvisories: records.length,
    removed: result.removedAssociations, fixed: result.fixedVersionAssociations, currentNpmReportedVulnerabilities: 0, output: fileFact(output) };
}
module.exports = { inRange, affected, assess, installedInventory, run };
if (require.main === module) { try { assert.equal(process.argv.length, 5); console.log(JSON.stringify(run(...process.argv.slice(2)), null, 2)); } catch (e) { console.error(e); process.exitCode = 1; } }
