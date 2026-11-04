'use strict';
// Inert evidence-only authoring of explicit final normal round03.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let source=fs.readFileSync(path.join(__dirname,'run-installed-lifecycle-proposed-03.cjs'),'utf8');
function replace(before,after,count=1){assert.equal(source.split(before).length-1,count,before);source=source.split(before).join(after)}
replace("assert.equal(path.basename(admissionFile), 'installed-admission-02.json');","assert.equal(path.basename(admissionFile), 'installed-admission-03.json');");
replace("assert.equal(a.status, 'ROOT_REVIEWED_F32_INSTALLED_ROUND02_FINAL_INPUTS');","assert.equal(a.status, 'ROOT_REVIEWED_F32_INSTALLED_ROUND03_FINAL_INPUTS');");
replace('assert.equal(a.normalRound, 2);','assert.equal(a.normalRound, 3);');
replace("'installed-normal-round-02-consumed.json'","'installed-normal-round-03-consumed.json'");
replace("for (const number of ['02', '03'])","for (const number of ['03'])");
replace('normalRound: 2,','normalRound: 3,',3);
replace("'installed-round-02-result.json'","'installed-round-03-result.json'");
replace("'installed-round-02-failure.json'","'installed-round-03-failure.json'");
replace("observer: 'installed-observer-proposed-03.cjs'","observer: 'installed-observer-proposed-04.cjs'");
replace("oldObserver: 'installed-upgrade-old-observer-proposed-02.cjs'","oldObserver: 'installed-upgrade-old-observer-proposed-03.cjs'");
replace("renderer: 'installed-renderer-proposed-02.cjs'","renderer: 'installed-renderer-proposed-03.cjs'");
replace('const seen = new Set(), entries = new Map(); let payloadUncompressedBytes = 0;', 'const seen = new Set(), entries = new Map(); let payloadUncompressedBytes = 0, archiveXml;');
replace('    if (name.startsWith(\'extension/\') && !name.endsWith(\'/\')) {',"    if (name === 'extension.vsixmanifest') { assert(!archiveXml); archiveXml={bytes:raw.length,sha256:sha(raw)}; }\n    if (name.startsWith('extension/') && !name.endsWith('/')) {");
replace('  return { manifest, manifestRaw, manifestSha256: sha(manifestRaw), runtimes, entries, payloadUncompressedBytes };','  assert(archiveXml && archiveXml.bytes > 0);\n  return { manifest, manifestRaw, manifestSha256: sha(manifestRaw), runtimes, entries, payloadUncompressedBytes, archiveXml, vendorInstalledSize:payloadUncompressedBytes+archiveXml.bytes };');
replace('payloadUncompressedBytes: payload.payloadUncompressedBytes },','payloadUncompressedBytes: payload.vendorInstalledSize },');
const extra=String.raw`function verifyPreviousRound02(a) {
  const prior=a.previousRound02;
  assert(prior && typeof prior==='object');
  for(const [key,name] of Object.entries({consumed:'installed-normal-round-02-consumed.json',admission:'installed-admission-02.json',rootResult:'installed-native-02.txt.result.json'})) assert.equal(prior[key].path,path.join(__dirname,name));
  const consumed=pinnedJson(prior.consumed),earlier=pinnedJson(prior.admission),failure=pinnedJson(prior.failure);
  assert.equal(consumed.feature,'F32');assert.equal(consumed.status,'CONSUMED_ONE_NORMAL_ROUND_NO_RETRY');assert.equal(consumed.normalRound,2);assert.equal(consumed.maxNormalRounds,3);assert.equal(consumed.signalsRequested,0);
  assert.deepEqual(consumed.admission,prior.admission);assert.equal(consumed.runRoot,earlier.runRoot);
  assert.equal(earlier.status,'ROOT_REVIEWED_F32_INSTALLED_ROUND02_FINAL_INPUTS');assert.equal(earlier.normalRound,2);
  assert.equal(earlier.sourceProof.sha256,a.sourceProof.sha256);assert.deepEqual(earlier.currentVsix,a.currentVsix);
  assert.notEqual(a.runRoot.toLowerCase(),earlier.runRoot.toLowerCase());
  assert.equal(prior.failure.path,path.join(earlier.runRoot,'receipts','installed-round-02-failure.json'));
  assert.equal(failure.feature,'F32');assert.equal(failure.status,'FAIL_OR_INCOMPLETE_RETAIN_OWNERSHIP_NO_RETRY_NO_NEXT_PHASE');assert.equal(failure.signalsRequested,0);
  assert.deepEqual(failure.completed.map(row=>row.name),['primary-before-cli-absence','primary-inventory-before','primary-install-current','primary-inventory-installed','primary-prelaunch-absence']);
  for(const row of failure.completed)verifyClose(row.close);
  const gate=path.join(earlier.runRoot,'profile-primary','F32Gate','primary');
  assert.equal(prior.codeClose.path,path.join(gate,'primary-code-owned-close.json'));verifyClose(prior.codeClose);
  assert.equal(prior.listenerClose.path,path.join(gate,'primary-listener-custody-owned-close.json'));
  const closed=pinnedJson(prior.listenerClose);
  for(const [key,value]of Object.entries({actualClose:true,exitCode:1,signal:null,stdoutEOF:true,stderrEOF:true,overflow:false,streamError:false,deadlineExceeded:false,signalsRequested:0}))assert.equal(closed[key],value);
  assert.equal(closed.streams.length,2);assert.deepEqual(closed.streams.map(row=>row.name).sort(),['stderr','stdout']);
  for(const stream of closed.streams){assert.equal(stream.observedBytes,stream.bytes);pin({path:prior.listenerClose.path.replace(/owned-close\.json$/,stream.name+'.bin'),bytes:stream.bytes,sha256:stream.sha256})}
  const root=pinnedJson(prior.rootResult);assert.equal(root.exitCode,1);assert.equal(root.file,'node');
  assert.equal(path.resolve(REPO,root.output),path.join(__dirname,'installed-native-02.txt'));
  assert.equal(sha(readFile(path.resolve(REPO,root.output),16*1024*1024)),root.sha256.toLowerCase());
  assert.equal(root.arguments[1],prior.admission.path);assert.equal(root.arguments[2],prior.admission.sha256);
  assert.equal(path.resolve(REPO,root.arguments[0]),consumed.fixtureRunner.path);pin(consumed.fixtureRunner);
  return prior;
}
function verifyInstallerSize(a,current,old) {
  const qualified=pinnedJson(a.installerSizeQualification);
  assert.equal(qualified.feature,'F32');assert.equal(qualified.status,'PASS_CURRENT_VENDOR_INSTALLED_SIZE_INCLUDES_EXACT_VSIXMANIFEST');
  assert.equal(qualified.vendorReceiptSha256,a.vendorReceipt.sha256);assert.equal(qualified.currentVsixSha256,a.currentVsix.sha256);assert.equal(qualified.oldVsixSha256,a.oldVsix.sha256);
  for(const [key,payload]of [['current',current],['old',old]]){
    assert.deepEqual(qualified[key].archiveXml,payload.archiveXml);
    assert.equal(qualified[key].payloadUncompressedBytes,payload.payloadUncompressedBytes);
    assert.equal(qualified[key].vendorInstalledSize,payload.vendorInstalledSize);
  }
  return qualified;
}
`;
replace('function reviewedAdmission(admissionFile, expectedSha) {',extra+'function reviewedAdmission(admissionFile, expectedSha) {');
replace('  verifyPreviousRound(a);','  verifyPreviousRound(a); verifyPreviousRound02(a);',2);
replace("  assert.equal(a.installerMetadataTargetPlatform, 'undefined');","  assert.equal(a.installerMetadataTargetPlatform, 'undefined');\n  verifyInstallerSize(a,current,old);");
replace('module.exports = { run, reviewedAdmission, verifyPreviousRound, inspectVsix, inventory, json, psLiteral };','module.exports = { run, reviewedAdmission, verifyPreviousRound, verifyPreviousRound02, verifyInstallerSize, inspectVsix, inventory, json, psLiteral };');
fs.writeFileSync(path.join(__dirname,'run-installed-lifecycle-proposed-04.cjs'),source,{flag:'wx'});
