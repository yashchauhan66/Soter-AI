'use strict';
// Preparation only: retain prior prepared files and bind current facts later.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const put=(n,v)=>fs.writeFileSync(own(n),typeof v==='string'?v:JSON.stringify(v,null,2)+'\n',{flag:'wx'}),read=n=>JSON.parse(fs.readFileSync(own(n),'utf8').replace(/^\uFEFF/,''));
const fact=p=>{const raw=fs.readFileSync(p);return{path:path.relative(repo,p).replaceAll('\\','/'),bytes:raw.length,sha256:sha(raw)};};
const allowed=['01-02','02-02','03-02','04-02','05-02','06-04','07-04','08-04'].map(s=>'unit-shard-'+s);
let content=fs.readFileSync(own('run-content-01.cjs'),'utf8');
const bad='/^unit-shard-d{2}-02$/';assert(content.includes(bad));
content=content.replace('assert.match(shard.name,'+bad+')','assert('+JSON.stringify(allowed)+'.includes(shard.name))');
assert(!content.includes(bad));new vm.Script(content);put('run-content-02.cjs',content);
let guard=fs.readFileSync(own('current-native-admission-01.cjs'),'utf8');
const from='assert.match(shard.name,/^unit-shard-\\d{2}-02$/)';assert(guard.includes(from));guard=guard.replace(from,'assert('+JSON.stringify(allowed)+'.includes(shard.name))');
guard=guard.replaceAll("own('affected-scope-01.json')","own('affected-scope-02.json')");new vm.Script(guard);put('current-native-admission-02.cjs',guard);
let shared=fs.readFileSync(own('affected-native-binding-01.ps1'),'utf8');
shared=shared.replaceAll('current-native-admission-01.cjs','current-native-admission-02.cjs').replace('113d2315b37d171977fc90d9796f19e3a794065dec391467d525d66cb32be37e',sha(Buffer.from(guard)));
assert(shared.includes(sha(Buffer.from(guard))));put('affected-native-binding-02.ps1',shared);
const original=read('affected-scope-01.json'),outputs=[];
for(const name of [...original.families.map(f=>f.helper),'affected-functional10-01.ps1','affected-security17-01.ps1']){
 const raw=fs.readFileSync(own(name),'utf8'),changed=raw.replaceAll('affected-native-binding-01.ps1','affected-native-binding-02.ps1');
 assert.notEqual(changed,raw);assert.equal(changed.replaceAll('affected-native-binding-02.ps1','affected-native-binding-01.ps1'),raw);
 const next=name.replace('-01.ps1','-02.ps1');put(next,changed);outputs.push({source:fact(own(name)),target:fact(own(next)),assertionReversalByteExact:true});
}
const scope={...original,families:original.families.map(f=>({...f,helper:f.helper.replace('-01.ps1','-02.ps1')})),driverInventory:'affected-driver-provenance-01.json',driverBuild:'Fresh four selected drivers; exact original driver bytes and source/auxiliary graph verified unchanged. No native result inferred.',currentArtifact:'Current F31b unique artifact/content-01 required by fresh exact-object binding;18entries/fourruntimes/88machineflags.',deferred:{feature:'F26a',family:'precommit',status:'USER_SKIPPED_INCOMPLETE_UNSUPPORTED_NO_RETRY',originalAssertions:34,substitute:false,completionBlocked:true},componentGate:'Current full1088/actual complete sharded TAP/compiler/readiness/new VSIX/strict18entry content gates; no F28 native30 transfer.'};
put('affected-scope-02.json',scope);
const prior=path.resolve(__dirname,'../20261101-f28-reliability-9a4c2e71/affected-functional-security-01.ps1');
let functional=fs.readFileSync(prior,'utf8');
for(const[a,b]of [['affected-native-binding-01.ps1','affected-native-binding-02.ps1'],['affected-functional10-01.ps1','affected-functional10-02.ps1'],['affected-security17-01.ps1','affected-security17-02.ps1']])functional=functional.replaceAll(a,b);
let reverse=functional;for(const[a,b]of [['affected-native-binding-02.ps1','affected-native-binding-01.ps1'],['affected-functional10-02.ps1','affected-functional10-01.ps1'],['affected-security17-02.ps1','affected-security17-01.ps1']])reverse=reverse.replaceAll(a,b);
assert.equal(reverse,fs.readFileSync(prior,'utf8'));put('affected-functional-security-02.ps1',functional);outputs.push({source:fact(prior),target:fact(own('affected-functional-security-02.ps1')),assertionReversalByteExact:true});
const names=[...outputs.map(r=>path.basename(r.target.path)),'affected-native-binding-02.ps1','affected-preparation-pipe-ownership-01.ps1'];
put('affected-syntax-02.ps1',"$ErrorActionPreference='Stop'\n$taskTokens=$null;$taskErrors=$null\nforeach($taskName in @("+names.map(n=>"'"+n+"'").join(',')+")){[void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskName),[ref]$taskTokens,[ref]$taskErrors);if(@($taskErrors).Count -ne 0){throw 'Affected PowerShell syntax refused.'}}\nWrite-Output 'PASS: nine affected PowerShell files parsed; no native run.'\n");
put('affected-preparation-02.json',{status:'F31B_FIXED_UNEXECUTED_METADATA_PREPARATION_NO_NATIVE',observedAt:new Date().toISOString(),outputs,guard:fact(own('current-native-admission-02.cjs')),contentInspector:fact(own('run-content-02.cjs')),bindingHelper:fact(own('affected-native-binding-02.ps1')),scope:fact(own('affected-scope-02.json')),reason:'Exact accepted shard generations; escaped-regex defect in inert content01 fixed before execution. Retained original prepared scope01 had stale inherited F28 labels; scope02 names current F31b facts and owner skip. Assertions/drivers/deadlines unchanged.',nativeRuns:0});
console.log('PASS: F31b successor preparation; JS syntax, exact assertion reversal and shard-name admission checked. No native run.');
