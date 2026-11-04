'use strict';
// Evidence-only authoring generator; no product/CLI/host/network/process query.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const input=path.join(__dirname,'run-installed-lifecycle-proposed-02.cjs');
const output=path.join(__dirname,'run-installed-lifecycle-proposed-03.cjs');
let source=fs.readFileSync(input,'utf8');
function replace(before,after,count=1){assert.equal(source.split(before).length-1,count,before);source=source.split(before).join(after);}
const guard=String.raw`function verifyPreviousRound(a) {
  const prior = a.previousRound;
  assert(prior && typeof prior === 'object', 'Explicit retained failed normalround01 is required');
  for (const [key, filename] of Object.entries({ consumed:'installed-normal-round-01-consumed.json',
    admission:'installed-admission-01.json', rootResult:'installed-native-01.txt.result.json' })) {
    assert.equal(prior[key].path, path.join(__dirname, filename));
  }
  const consumed = pinnedJson(prior.consumed), earlier = pinnedJson(prior.admission);
  assert.equal(consumed.feature, 'F32'); assert.equal(consumed.status, 'CONSUMED_ONE_NORMAL_ROUND_NO_RETRY');
  assert.equal(consumed.normalRound, 1); assert.equal(consumed.maxNormalRounds, 3); assert.equal(consumed.signalsRequested, 0);
  assert.deepEqual(consumed.admission, prior.admission); assert.equal(consumed.runRoot, earlier.runRoot);
  assert.equal(earlier.status, 'ROOT_REVIEWED_F32_INSTALLED_ROUND01_FINAL_INPUTS'); assert.equal(earlier.normalRound, 1);
  assert.equal(earlier.sourceProof.sha256, a.sourceProof.sha256); assert.deepEqual(earlier.currentVsix, a.currentVsix);
  assert.notEqual(a.runRoot.toLowerCase(), earlier.runRoot.toLowerCase(), 'New normalround02 never reuses failed root');
  assert.equal(prior.failure.path, path.join(earlier.runRoot, 'receipts', 'installed-round-01-failure.json'));
  const failure = pinnedJson(prior.failure);
  assert.equal(failure.feature, 'F32'); assert.equal(failure.status, 'FAIL_OR_INCOMPLETE_RETAIN_OWNERSHIP_NO_RETRY_NO_NEXT_PHASE');
  assert.deepEqual(failure.completed, []); assert.equal(failure.lastConfirmedOwnerAbsence, null); assert.equal(failure.signalsRequested, 0);
  assert.equal(prior.initialAbsenceClose.path, path.join(earlier.runRoot, 'profile-primary', 'F32Gate', 'primary', 'primary-before-cli-absence-owned-close.json'));
  const closed = pinnedJson(prior.initialAbsenceClose);
  for (const [key, expected] of Object.entries({ actualClose:true, exitCode:1, signal:null, stdoutEOF:true,
    stderrEOF:true, overflow:false, streamError:false, deadlineExceeded:false, signalsRequested:0 })) assert.equal(closed[key], expected);
  assert.equal(closed.streams.length, 2); assert.deepEqual(closed.streams.map(row=>row.name).sort(), ['stderr','stdout']);
  for (const stream of closed.streams) {
    assert.equal(stream.observedBytes, stream.bytes);
    pin({path:prior.initialAbsenceClose.path.replace(/owned-close\.json$/,stream.name+'.bin'),bytes:stream.bytes,sha256:stream.sha256});
  }
  const root = pinnedJson(prior.rootResult); assert.equal(root.exitCode, 1); assert.equal(root.file, 'node');
  assert.equal(path.resolve(REPO,root.output), path.join(__dirname,'installed-native-01.txt'));
  const raw = readFile(path.resolve(REPO,root.output),16*1024*1024); assert.equal(sha(raw),root.sha256.toLowerCase());
  assert.equal(root.arguments[1], prior.admission.path); assert.equal(root.arguments[2], prior.admission.sha256);
  assert.equal(path.resolve(REPO,root.arguments[0]), consumed.fixtureRunner.path); pin(consumed.fixtureRunner);
  return { consumed:prior.consumed, admission:prior.admission, failure:prior.failure, initialAbsenceClose:prior.initialAbsenceClose, rootResult:prior.rootResult };
}
`;
replace('function reviewedAdmission(admissionFile, expectedSha) {',guard+'function reviewedAdmission(admissionFile, expectedSha) {');
replace("assert(same(path.dirname(admissionFile), __dirname), 'Admission must be a direct child of this exact evidence directory');", "assert(same(path.dirname(admissionFile), __dirname), 'Admission must be a direct child of this exact evidence directory');\n  assert.equal(path.basename(admissionFile), 'installed-admission-02.json');");
replace('ROOT_REVIEWED_F32_INSTALLED_ROUND01_FINAL_INPUTS','ROOT_REVIEWED_F32_INSTALLED_ROUND02_FINAL_INPUTS');
replace('assert.equal(a.normalRound, 1);','assert.equal(a.normalRound, 2);');
replace('  return { admission: a, admissionFact:', '  verifyPreviousRound(a);\n  return { admission: a, admissionFact:');
replace("const consumeFile = path.join(__dirname, 'installed-normal-round-01-consumed.json');", "const consumeFile = path.join(__dirname, 'installed-normal-round-02-consumed.json');");
replace("for (const number of ['01', '02', '03']) assert(!fs.existsSync(path.join(__dirname, 'installed-normal-round-' + number + '-consumed.json')), 'A recorded round forbids implicit retry');", "verifyPreviousRound(a);\n  for (const number of ['02', '03']) assert(!fs.existsSync(path.join(__dirname, 'installed-normal-round-' + number + '-consumed.json')), 'A recorded current/future round forbids implicit retry');");
replace('normalRound: 1,','normalRound: 2,',3);
replace("'installed-round-01-result.json'","'installed-round-02-result.json'");
replace("'installed-round-01-failure.json'), {","'installed-round-02-failure.json'), {");
replace("const custody = copy(a.fixtures.custody, path.join(paths.assets, 'custody.ps1'));", "const custody = copy(a.fixtures.custody, path.join(paths.assets, 'custody.ps1'));\n  // Keep strict PS parent-reparse refusal: pass a byte-identical private D copy\n  // of the reviewed vendor receipt, while re-pinning the original at every barrier.\n  const copiedVendorReceipt = copy(a.vendorReceipt, path.join(paths.assets, 'vendor-observation.json'));");
replace('pin(currentVsix); pin(oldVsix); pin(renderer); pin(custody); pin(brokerCustody);','pin(currentVsix); pin(oldVsix); pin(renderer); pin(custody); pin(brokerCustody); pin(copiedVendorReceipt);');
replace('vendorReceipt: a.vendorReceipt, rootMarker: marker,','vendorReceipt: copiedVendorReceipt, rootMarker: marker,');
replace('module.exports = { run, reviewedAdmission, inspectVsix, inventory, json, psLiteral };','module.exports = { run, reviewedAdmission, verifyPreviousRound, inspectVsix, inventory, json, psLiteral };');
fs.writeFileSync(output,source,{flag:'wx'});
