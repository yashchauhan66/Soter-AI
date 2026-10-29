const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const H = __dirname;
const proof = file => { const raw = fs.readFileSync(file); return { path: file.replaceAll('\\','/'), bytes: raw.length, sha256: crypto.createHash('sha256').update(raw).digest('hex') }; };
const before = proof(path.join(H,'client-owner-focused-before-02.txt'));
const after = proof(path.join(H,'client-owner-main-after-05.txt'));
const receipt = JSON.parse(fs.readFileSync(path.join(H,'client-owner-main-after-05.txt.result.json'),'utf8').replace(/^\uFEFF/,''));
if(receipt.exitCode !== 0 || receipt.sha256.toLowerCase() !== after.sha256) throw Error('Canonical current receipt mismatch');
const current = fs.readFileSync(path.join(H,'client-owner-main-after-05.txt'),'utf8');
if(!/# tests 69\r?\n/.test(current) || !/# pass 69\r?\n/.test(current) || !/# fail 0\r?\n/.test(current) || !/# cancelled 0\r?\n/.test(current)) throw Error('Actual test totals mismatch');
const tests = ['prePushClient.test.ts','prePushOwnerService.test.ts','pushRootSnapshot.test.ts','prePushClientMain.test.ts'];
const dependencies = ['PrePushClient.ts','PrePushOwnerService.ts','PrePushWire.ts','PrePushProtocol.ts','PushRootSnapshot.ts','CheckedPushRefs.ts','preCommitClientMain.ts','PreCommitClient.ts','PreCommitHookText.ts','PreCommitProtocol.ts'];
const result = {
  version:1, status:'COMPONENT69_PASS_NOT_FEATURE_ACCEPTANCE', observedAt:new Date().toISOString(),
  tests:69, pass:69, fail:0, cancelled:0, skipped:0, durationMilliseconds:23327.0061,
  currentEvidence:after, canonicalReceipt:proof(path.join(H,'client-owner-main-after-05.txt.result.json')),
  retainedBaselines:[proof(path.join(H,'client-owner-transport-before-01.txt')),before,proof(path.join(H,'client-owner-main-before-04.txt'))],
  earlierAfter59:proof(path.join(H,'client-owner-focused-after-03.txt')),
  ownedFiles:tests.map(file=>proof(path.join('packages/vscode-extension/src/__tests__',file))),
  dependencyObservations:dependencies.map(file=>proof(path.join('packages/vscode-extension/src/history-hooks',file))),
  scope:{
    actual:['Ed25519 signing and verification','ordinary artifact and directory identity checks','genuine checked Git metadata without any Git child','numeric IPv4 loopback HTTP client/service framing','esbuild-emitted actual production main executed by installed Node with exact stdin and both output EOF observations'],
    explicitSeams:['unit client request injection except actual-transport cases','owner scanner and prepareRefs returning genuine synthetic metadata','emitted-main synthetic signing HTTP owner without Git or scanner'],
    notClaimed:['packaged VSIX or Code integration','actual Git push','native09 authorization or execution','full-suite or compiler gate','feature DONE or final protection rating'],
    safety:'Synthetic retained D: fixtures only; no external traffic, signals, deletion, secrets, normal profiles, downloads or OS changes'
  },
  defectsIdentified:[{issue:'Copied /pre-commit literals prevented default pre-push HTTP admission',baseline:'client-owner-transport-before-01.txt',productionFixOwner:'/root',verifiedAfter:'client-owner-main-after-05.txt'}]
};
fs.writeFileSync(path.join(H,'client-owner-result-06.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({status:result.status, tests:69, receipt:proof(path.join(H,'client-owner-result-06.json'))})+'\n');
