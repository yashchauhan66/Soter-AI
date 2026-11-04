'use strict';
// Inert API: no import-time file write/listener/profile/approval/native action.
// Root supplies a fresh root and already reviewed numeric ports; no automatic
// probe, approval fabrication, consumption or native invocation is performed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const own=n=>path.join(__dirname,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fact=f=>{const b=fs.readFileSync(f);return{path:path.resolve(f),bytes:b.length,sha256:sha(b)}};
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
function makeAdmission({runRoot,debugPorts,configuredBrokerPort,syntheticCanary,extraApproval}){
 const prior=read(own('installed-admission-03.json')),a=structuredClone(prior);
 assert(/^D:\\SoterAI-Lite-test-profiles\\f32-installed-[0-9TZ]+-[a-f0-9]{8}$/.test(runRoot));
 assert(!fs.existsSync(runRoot));assert.notEqual(runRoot.toLowerCase(),prior.runRoot.toLowerCase());
 assert(Array.isArray(debugPorts)&&debugPorts.length===8&&new Set(debugPorts).size===8);
 for(const port of [...debugPorts,configuredBrokerPort])assert(Number.isSafeInteger(port)&&port>=1024&&port<=65535&&port!==47321);
 assert(!debugPorts.includes(configuredBrokerPort));assert(/^SOTERAI_F32_SYNTHETIC_[A-Z0-9_]{8,80}$/.test(syntheticCanary));
 a.status='ROOT_REVIEWED_F32_INSTALLED_EXTRA05_FINAL_INPUTS';a.extraAttempt='PROPOSAL05';
 a.runRoot=runRoot;a.debugPorts=debugPorts;a.configuredBrokerPort=configuredBrokerPort;a.syntheticCanary=syntheticCanary;
 for(const [key,name]of Object.entries({runner:'run-installed-lifecycle-proposed-05.cjs',observer:'installed-observer-proposed-05.cjs',oldObserver:'installed-upgrade-old-observer-proposed-04.cjs',renderer:'installed-renderer-proposed-04.cjs',guiHelper:'native-owned-gui-phase-proposed-05.cjs',trustDiagnostics:'installed-trust-diagnostics-proposed-05.cjs'}))a.fixtures[key]=fact(own(name));
 const gate=path.join(prior.runRoot,'profile-primary','F32Gate','primary');
 a.previousRound03={consumed:fact(own('installed-normal-round-03-consumed.json')),admission:fact(own('installed-admission-03.json')),
 failure:fact(path.join(prior.runRoot,'receipts','installed-round-03-failure.json')),rendererClose:fact(path.join(gate,'primary-renderer-owned-close.json')),
 observerFailure:fact(path.join(gate,'primary-observer-failure.json')),rootResult:fact(own('installed-native-03.txt.result.json'))};
 if(extraApproval){assert.equal(extraApproval.path,own('installed-extra05-user-approval.json'));a.extraApproval=extraApproval;}
 return a;
}
function prepareAdmission(options){
 const a=makeAdmission(options),target=own('installed-extra05-admission.json');
 fs.writeFileSync(target,JSON.stringify(a,null,2)+'\n',{flag:'wx'});
 const row=fact(target);require(a.fixtures.runner.path).reviewedAdmission(row.path,row.sha256);
 return{status:'PASS_STATIC_EXTRA05_ADMISSION_NATIVE_NOT_RUN',admission:row,extraApprovalPresent:!!a.extraApproval};
}
module.exports={makeAdmission,prepareAdmission};
