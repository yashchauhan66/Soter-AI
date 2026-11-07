'use strict';
// Prepare fresh F05/F28 original-fixture successors only. No host/process launch.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict'), vm = require('node:vm');
const root = path.resolve(__dirname, '../../../../..'), old = path.join(root, 'docs/soterai-lite/evidence/20261104-final-gate-readiness'), output = path.join(root, 'docs/soterai-lite/evidence/20261106-editor-reliability-01'), common = path.join(root, 'docs/soterai-lite/evidence/20261106-v01-current-01');
const sha = b => crypto.createHash('sha256').update(b).digest('hex'), json = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const fact = p => { const b = fs.readFileSync(p); return { path: path.relative(root, p).replaceAll('\\', '/'), bytes: b.length, sha256: sha(b) }; };
assert(!fs.existsSync(output)); fs.mkdirSync(output); fs.mkdirSync(path.join(output, 'f28-current-01'));
const baseGatePath = path.join(common, 'v01-admission.cjs'), baseGate = require(baseGatePath), base = baseGate.binding(), vendor = baseGate.read(baseGate.pin(base.hostReview));
assert.equal(base.vsix.sha256, '011f96d19d42dbefc2e56eb5399bf5c7f16a09d6b71b8bae5be9d66b2f3769ec'); assert.equal(vendor.currentHost.version, '1.145.1');
const writes = [], deltas = [];
function write(p, content) { fs.writeFileSync(p, typeof content === 'string' || Buffer.isBuffer(content) ? content : JSON.stringify(content, null, 2) + '\n', { flag: 'wx' }); writes.push(fact(p)); }
function changed(content, a, b, file, expected) { const count = content.split(a).length - 1; assert(count > 0 && (expected === undefined || count === expected), file + ': unmatched replacement ' + a); deltas.push({ file, before: a, after: b, count }); return content.split(a).join(b); }
const commonText = `'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),gateFile=path.resolve(repo,${JSON.stringify(fact(baseGatePath).path)});
assert.equal(sha(fs.readFileSync(gateFile)),${JSON.stringify(fact(baseGatePath).sha256)});const G=require(gateFile);
function binding(){const b=G.binding();assert.equal(b.vsix.sha256,${JSON.stringify(base.vsix.sha256)});assert.equal(b.hostVersion,'1.145.1');return {...b,content:b.inspection};}
module.exports={...G,repo,own:n=>path.join(__dirname,n),location:r=>path.resolve(repo,r.path),binding};
`;
const commonAdapter = path.join(output, 'native-common-admission.cjs'); write(commonAdapter, commonText); const adapted = require(commonAdapter).binding();
// F05 preserves its accepted H01..H10 driver and provenance bytes exactly.
const f05Old = json(path.join(old, 'f05-current-binding-04.json')), f05 = structuredClone(f05Old);
let f05js = fs.readFileSync(path.join(old, 'run-f05-current-proposed-04.cjs'), 'utf8'), f05ps = fs.readFileSync(path.join(old, 'f05-current-proposed-04.ps1'), 'utf8');
f05js = changed(f05js, 'affected-current-admission-proposed-02.cjs', 'native-common-admission.cjs', 'f05-runner', 1);
f05js = changed(f05js, '4ed2dcecd94855806b4cf4dee239b8e51b9d1fb6d190229ae08b76f8174153dc', fact(commonAdapter).sha256, 'f05-runner', 1);
for (const [key, from] of [['f05-runner', f05js], ['f05-launcher', f05ps]]) {
  let next = changed(from, '1.145.0', '1.145.1', key);
  if (key === 'f05-runner') next = changed(next, 'a717861c07', '6bab64e2d1', key, 1);
  if (key === 'f05-runner') f05js = next; else f05ps = next;
}
write(path.join(output, 'run-f05-current-proposed-04.cjs'), f05js); write(path.join(output, 'f05-current-proposed-04.ps1'), f05ps);
write(path.join(output, 'affected-preparation-pipe-ownership-01.ps1'), fs.readFileSync(path.join(old, 'affected-preparation-pipe-ownership-01.ps1')));
for (const key of ['sourceProof','qualification','content','vsix','runtimes','hostReview','extractedRoot','frontendSha256']) f05[key] = adapted[key];
f05.code = vendor.currentHost.executable; f05.codeVersion = vendor.currentHost.version; f05.vendorJsonRoot = vendor.currentHost.appRoot; f05.vendorJsonPins = [vendor.currentHost.electronApplicationPackage, vendor.currentHost.product]; f05.gate = fact(commonAdapter); f05.affectedBinding = fact(path.join(common, 'binding.json'));
f05.fixtureInputs = f05.fixtureInputs.map(f => { const p = path.join(output, path.basename(f.path)); return fs.existsSync(p) ? fact(p) : f; });
f05.hostRebind = { priorBinding: fact(path.join(old, 'f05-current-binding-04.json')), originalAssertions: 'UNCHANGED_H01_H10_SAVE7_RELOAD3', previousCode: '1.145.0', currentCode: '1.145.1', currentArtifact: base.vsix, nativeLaunches: 0 };
write(path.join(output, 'f05-current-binding-04.json'), f05);
// F28 keeps original primary25/restart5/peer fixture bytes and refreshes only admission/host pins.
const f28dir = path.join(output, 'f28-current-01'), f28old = path.join(old, 'f28-current-01'), oldBinding = json(path.join(f28old, 'native-binding-current-02.json')), f28 = structuredClone(oldBinding);
for (const name of ['lite-reliability-host.js','native-reliability-04.host.ts.txt','native-case-freeze-04.json']) write(path.join(f28dir, name), fs.readFileSync(path.join(f28old, name)));
const relativeJsonFiles = ['package.json','client/dist/node/jsonClientMain.js','server/package.json','server/dist/node/jsonServerMain.js'];
const jsonFacts = relativeJsonFiles.map(name => { const p = path.join(vendor.currentHost.appRoot,'extensions/json-language-features',name), f = { ...fact(p), path: p }; baseGate.pin(f); return f; });
for (const name of ['current-admission-02.cjs','native-admission-current-02.ps1','native-launch-current-02.ps1','run-native-current-02.cjs']) {
  let content = fs.readFileSync(path.join(f28old, name), 'utf8');
  if (content.includes('affected-current-admission-proposed-02.cjs')) content = changed(content, 'affected-current-admission-proposed-02.cjs', 'native-common-admission.cjs', name, 1);
  if (content.includes('4ed2dcecd94855806b4cf4dee239b8e51b9d1fb6d190229ae08b76f8174153dc')) content = changed(content, '4ed2dcecd94855806b4cf4dee239b8e51b9d1fb6d190229ae08b76f8174153dc', fact(commonAdapter).sha256, name, 1);
  if (content.includes('1.145.0')) content = changed(content, '1.145.0', '1.145.1', name);
  if (content.includes('a717861c07')) content = changed(content, 'a717861c07', '6bab64e2d1', name);
  if (content.includes('f1e1d79be5f50a238681738f813c4b353aad69f4b05f068899ec98a2d1b74c32')) content = changed(content, 'f1e1d79be5f50a238681738f813c4b353aad69f4b05f068899ec98a2d1b74c32', vendor.currentHost.executable.sha256, name);
  if (content.includes('238751544')) content = changed(content, '238751544', String(vendor.currentHost.executable.bytes), name);
  if (content.includes('USER_SKIPPED_NO_MORE_NATIVE_RUNS')) content = changed(content, 'USER_SKIPPED_NO_MORE_NATIVE_RUNS', 'SEPARATE_F26A_NATIVE_PROGRAM_NOT_RUN_BY_THIS_F28_FIXTURE', name);
  if (content.includes('docs/soterai-lite/evidence/20261104-final-gate-readiness/f28-current-01/')) content = changed(content, 'docs/soterai-lite/evidence/20261104-final-gate-readiness/f28-current-01/', 'docs/soterai-lite/evidence/20261106-editor-reliability-01/f28-current-01/', name);
  if (name === 'native-launch-current-02.ps1') {
    const start = content.indexOf('const jsonBuiltinPins = ['), end = content.indexOf(';',start) + 1; assert(start >= 0 && end > start);
    content = changed(content, content.slice(start,end), 'const jsonBuiltinPins = ' + JSON.stringify(jsonFacts.map((f, i) => ({ relative: relativeJsonFiles[i], bytes: f.bytes, sha256: f.sha256 })), null, 2) + ';', name, 1);
  }
  write(path.join(f28dir, name), content);
}
for (const key of ['sourceProof','qualification','content','vsix','frontendSha256','extractedRoot','hostReview','runtimes']) f28[key] = adapted[key];
f28.f26aNative09 = 'SEPARATE_F26A_NATIVE_PROGRAM_NOT_RUN_BY_THIS_F28_FIXTURE'; f28.physicalRuntime = vendor.node; f28.jsonBuiltinAppRoot = vendor.currentHost.appRoot; f28.jsonBuiltinFacts = jsonFacts;
for (const key of ['guard','admission','candidate','driver','driverSource','caseFreeze']) f28[key] = fact(path.join(f28dir, path.basename(f28[key].path)));
f28.fixtureInputs = f28.fixtureInputs.map(f => fact(path.join(f28dir,path.basename(f.path))));
const provenance = json(path.join(f28old,'driver-provenance-current-02.json')); provenance.driver = f28.driver; provenance.source = f28.driverSource; provenance.caseFreeze = f28.caseFreeze; provenance.launcher = f28.candidate; provenance.jsonBuiltinAppRoot = f28.jsonBuiltinAppRoot; provenance.jsonBuiltinFacts = jsonFacts; provenance.onlyLauncherDeltas.push('Current011f96 artifact, Code1.145.1/exact four JSON builtin files, fresh execution directory; original30 assertions/driver unchanged'); provenance.priorCurrentBinding = fact(path.join(f28old,'native-binding-current-02.json'));
write(path.join(f28dir,'driver-provenance-current-02.json'),provenance); f28.driverProvenance = fact(path.join(f28dir,'driver-provenance-current-02.json'));
write(path.join(f28dir,'native-binding-current-02.json'),f28);
for (const f of writes.filter(f => f.path.endsWith('.cjs'))) new vm.Script(fs.readFileSync(path.join(root,f.path),'utf8'),{filename:f.path});
const f05Checked = require(path.join(output,'run-f05-current-proposed-04.cjs')).admission();
const f28BindingFact = fact(path.join(f28dir,'native-binding-current-02.json')); require(path.join(f28dir,'current-admission-02.cjs')).binding(f28BindingFact.sha256);
const receipt = { status: 'PASS_F05_F28_CURRENT_NATIVE_SUCCESSOR_PREPARATION_NOT_EXECUTED', observedAt:new Date().toISOString(), artifact:base.vsix, sourceProof:base.sourceProof, code:vendor.currentHost.executable, codeVersion:'1.145.1', commonGate:fact(baseGatePath), commonBinding:fact(path.join(common,'binding.json')), f05:{binding:fact(path.join(output,'f05-current-binding-04.json')),runner:fact(path.join(output,'run-f05-current-proposed-04.cjs')),checks:10,phases:[7,3],driverUnchanged: f05.driver.sha256 === f05Old.driver.sha256}, f28:{binding:f28BindingFact,runner:fact(path.join(f28dir,'run-native-current-02.cjs')),checks:30,phases:[25,5],peer:1,driverUnchanged:f28.driver.sha256 === oldBinding.driver.sha256}, deltas, files:writes, nativeLaunches:0, productWrites:0, independentReview:'LOW_BUILDER_PREPARATION_ONLY' };
write(path.join(output,'preparation.json'),receipt); console.log(JSON.stringify({status:receipt.status,f05:receipt.f05,f28:receipt.f28,receipt:fact(path.join(output,'preparation.json'))}));
