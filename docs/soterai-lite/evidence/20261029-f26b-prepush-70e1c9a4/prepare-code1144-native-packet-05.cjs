'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const put=(n,s)=>fs.writeFileSync(own(n),s,{flag:'wx'}),save=(n,v)=>put(n,JSON.stringify(v,null,2)+'\n');
const fact=(file,base=__dirname)=>{const bytes=fs.readFileSync(file);return{path:path.relative(base,file).replaceAll('\\','/'),bytes:bytes.length,sha256:sha(bytes)};};
const old=read(own('native-launch-binding-04.json')),host=read(own('host-version-review-code1144-01.json'));
assert.equal(host.currentHost.version,'1.144.0');assert.equal(host.currentHost.executable.sha256,'9f33ede68f3317402280fa997bc8963f93e67f2905e416d6bb092c03d60a37eb');
assert(fs.existsSync(own('native-launch-consumption-04.json'))&&!fs.existsSync(own('native-launch-consumption-05.json')));
assert.equal(read(own('native-component-04-owned-close.json')).exitCode,1);
const oldCandidate=fs.readFileSync(own('native-launch-candidate-10.ps1'),'utf8');
const beforeBuiltin=/const jsonBuiltinPins = \[[\s\S]*?\];/.exec(oldCandidate);assert(beforeBuiltin);
const afterBuiltin='const jsonBuiltinPins = '+JSON.stringify(host.jsonBuiltinPins,null,4)+';';
const substitutions=[
 ['native-launch-admission-07.ps1','native-launch-admission-08.ps1'],
 ['native-launch-materialization-04.json','native-launch-materialization-05.json'],
 ['native-launch-consumption-04.json','native-launch-consumption-05.json'],
 ['325fb30ba28d17fa6ba4df58043727b2469aca9d641793a65e413721b2110ec6',host.currentHost.executable.sha256],
 ['238249784',String(host.currentHost.executable.bytes)],['1.143.1','1.144.0'],['e646868227','2c33b50b16']
];
let candidate=oldCandidate.replace(beforeBuiltin[0],afterBuiltin);
for(const [from,to]of substitutions){assert(candidate.includes(from));candidate=candidate.replaceAll(from,to);}
let reversal=candidate;for(const[from,to]of [...substitutions].reverse())reversal=reversal.replaceAll(to,from);
reversal=reversal.replace(afterBuiltin,beforeBuiltin[0]);assert.equal(reversal,oldCandidate,'Only explicit host metadata and new consumption filenames may change.');
put('native-launch-candidate-11.ps1.txt',candidate);put('native-launch-candidate-11.ps1',candidate);
const admission=fs.readFileSync(own('native-launch-admission-07.ps1'),'utf8');put('native-launch-admission-08.ps1.txt',admission);put('native-launch-admission-08.ps1',admission);
const physical=fs.readFileSync(own('native-physical-admission-13.cjs'),'utf8').replaceAll('native-launch-binding-04.json','native-launch-binding-05.json');put('native-physical-admission-14.cjs',physical);
const preflight=fs.readFileSync(own('native-preflight-04.ps1'),'utf8').replaceAll('native-launch-binding-04.json','native-launch-binding-05.json').replaceAll('native-launch-consumption-04.json','native-launch-consumption-05.json');put('native-preflight-06.ps1',preflight);
let outer=fs.readFileSync(own('run-native-component-04.cjs'),'utf8');
for(const[from,to]of [['native-launch-binding-04.json','native-launch-binding-05.json'],['native-launch-materialization-04.json','native-launch-materialization-05.json'],['native-launch-consumption-04.json','native-launch-consumption-05.json'],["name:'native-component-04'","name:'native-component-05'"],["'native-component-failure-04.json'","'native-component-failure-05.json'"]]){assert(outer.includes(from));outer=outer.replaceAll(from,to);}
put('run-native-component-05.cjs',outer);
const newRoot='C:\\Users\\USER\\AppData\\Local\\Programs\\Microsoft VS Code\\2c33b50b16\\resources\\app';
function refreshCodeRow(row){
 const isCode=row.path.toLowerCase()===host.currentHost.executable.path.toLowerCase();
 const isApplication=row.path.includes('Microsoft VS Code\\e646868227\\resources\\app');
 if(!isCode&&!isApplication)return row;
 const file=row.path.replace('e646868227','2c33b50b16'),bytes=fs.readFileSync(file);
 if(isCode){assert.equal(bytes.length,host.currentHost.executable.bytes);assert.equal(sha(bytes),host.currentHost.executable.sha256);}
 return{...row,path:file,bytes:bytes.length,sha256:sha(bytes)};
}
const extraBuiltin=host.jsonBuiltinPins.map(row=>({path:path.join(newRoot,'extensions/json-language-features',row.relative),bytes:row.bytes,sha256:row.sha256}));
const vendorFacts=[...old.vendorFacts.map(refreshCodeRow),...extraBuiltin];
const previousGuard=read(own(old.guard.path));
const guard={...previousGuard,status:'F26B_CURRENT03_CODE11440_PHYSICAL_ADMISSION_NATIVE36_NOT_RUN',observedAt:new Date().toISOString(),facts:[...previousGuard.facts.map(refreshCodeRow),...['host-version-review-code1144-01.json','progress-06.json','native-launch-candidate-11.ps1.txt','native-launch-candidate-11.ps1','native-launch-admission-08.ps1.txt','native-launch-admission-08.ps1','native-physical-admission-14.cjs','native-preflight-06.ps1','run-native-component-05.cjs'].map(n=>fact(own(n),repo)),...extraBuiltin]};
save('native-launch-guard-05.json',guard);
const binding={...old,observedAt:new Date().toISOString(),hostReview:fact(own('host-version-review-code1144-01.json'),repo),vendorFacts,guard:fact(own('native-launch-guard-05.json')),candidate:fact(own('native-launch-candidate-11.ps1')),admission:fact(own('native-launch-admission-08.ps1')),physicalAdmission:fact(own('native-physical-admission-14.cjs')),previousConsumedBinding:fact(own('native-launch-binding-04.json')),eligibleAttempt:2,actualPriorNativeAttempts:1,normalImprovementRound:1,classification:'Only explicit requested official Code host update and fresh one-attempt binding; source1070/VSIX/native36 driver and assertion bodies remain byte exact. Existing physical/link/hash policies unchanged; four builtin JSON files added to prespawn vendor custody.'};
delete binding.previousUnconsumedBinding;
save('native-launch-binding-05.json',binding);
const bindingFact=fact(own('native-launch-binding-05.json'));
const proposal='# F26b native36 component, Code 1.144.0, normal improvement round 1\n\nFirst actual component attempt04 failed at Code startup while the official updater was disk-full; all36 assertions NOT_RUN. Failure/owners/old binding retained. User explicitly requested the application update. Installed1.144.0 is now Microsoft-signed and exact-image verified; old updater and original owner absent. No new download/installer or process killing.\n\nThis new one-use packet changes only Code version/image/application-root and builtin JSON vendor pins plus unique consumption/binding filenames. The full1070 source proof, exact VSIX6c299712, original native driver/source and all30 primary+6 restart oracles remain unchanged. Reversal of all declared launcher metadata substitutions reproduces candidate10 byte-for-byte. Current source/full/content/provenance/physical admission is required before and after native phases.\n\nOne new synthetic D profile, numeric loopback only, no process signals, original deadlines/bootstrap control flow, actual child/Code natural closure + both EOF/two PID absence observations, explicit final restore/flag withdrawal. Direct installed pre-push wrapper invocation is a component route; no configured local/network Git push is authorized or run. F26a native09 remains explicitly deferred. Same-user enforcement, nested shell worker closure and independent review limitations remain. Required affected509+functional10/security17 and actual configured-push gates stay incomplete.\n\nBinding '+bindingFact.sha256+'; candidate '+binding.candidate.sha256+'; driver '+binding.driver.sha256+'; VSIX '+binding.vsix.sha256+'. Eligible attempt2 after one actual startup failure; first normal improvement, within existing at-most-three limit. No automatic retry. GUI/tool sandbox approval remains required.\n';
put('NATIVE36-COMPONENT-PROPOSAL05.md',proposal);
save('native-launch-materialization-05.json',{status:'ROOT_REVIEWED_F26B_NATIVE36_ONE_ISOLATED_COMPONENT_ATTEMPT',observedAt:new Date().toISOString(),allowedAttempts:1,bindingSha256:bindingFact.sha256,candidateSha256:binding.candidate.sha256,proposal:fact(own('NATIVE36-COMPONENT-PROPOSAL05.md')),configuredPushAuthorized:false,f26aNative09:'USER_DEFERRED_NOT_RUN',authorization:'Existing original isolated synthetic feature-test authorization within first normal improvement round; explicit requested official Code update applied. Not an extra-round approval or F26a09/push authority.',signalsRequested:0,previousConsumedMaterialization:'native-launch-materialization-04.json',eligibleAttempt:2,actualPriorNativeAttempts:1,normalImprovementRound:1});
save('code1144-native-packet-review-05.json',{status:'EXPLICIT_HOST_METADATA_SUBSTITUTIONS_REVERSED_BYTE_EXACT_NOT_NATIVE_PASS',observedAt:new Date().toISOString(),oldCandidate:fact(own('native-launch-candidate-10.ps1')),newCandidate:binding.candidate,substitutions,builtinBefore:beforeBuiltin[0],builtinAfter:afterBuiltin,reversalByteExact:true,driverUnchanged:binding.driver,driverSourceUnchanged:binding.driverSource,assertions:36,primary:30,restart:6,sourceProofUnchanged:binding.sourceProof,vsixUnchanged:binding.vsix,deadlinesUnchanged:true,bootstrapControlFlowUnchanged:true,physicalPoliciesUnchanged:true,binding:bindingFact,configuredGitPush:'NOT_AUTHORIZED_NOT_RUN',f26aNative09:'USER_DEFERRED_NOT_RUN'});
console.log(JSON.stringify({status:'CODE11440_NATIVE36_PACKET_PREPARED_NOT_LAUNCHED',binding:bindingFact,candidate:binding.candidate,normalImprovementRound:1}));
