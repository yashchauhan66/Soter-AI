'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),net=require('node:net');
const own=n=>path.join(__dirname,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fact=f=>{const b=fs.readFileSync(f);return{path:path.resolve(f),bytes:b.length,sha256:sha(b)}};
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
(async()=>{
 const prior=read(own('installed-admission-01.json')),a=structuredClone(prior);
 const runner=fact(own('run-installed-lifecycle-proposed-03.cjs'));assert.equal(runner.sha256,'8cf93c17776f81f5bf90ed59005e46cf5899af8bb5d3d7061420a5b773008ff8');
 a.status='ROOT_REVIEWED_F32_INSTALLED_ROUND02_FINAL_INPUTS';a.normalRound=2;a.fixtures.runner=runner;
 a.previousRound={consumed:fact(own('installed-normal-round-01-consumed.json')),admission:fact(own('installed-admission-01.json')),failure:fact(path.join(prior.runRoot,'receipts/installed-round-01-failure.json')),initialAbsenceClose:fact(path.join(prior.runRoot,'profile-primary/F32Gate/primary/primary-before-cli-absence-owned-close.json')),rootResult:fact(own('installed-native-01.txt.result.json'))};
 const servers=[],ports=[];try{for(let i=0;i<9;i++){const s=net.createServer();await new Promise((res,rej)=>{s.once('error',rej);s.listen(0,'127.0.0.1',res);});servers.push(s);const p=s.address().port;assert(p!==47321);ports.push(p);}}finally{await Promise.all(servers.map(s=>new Promise(res=>s.close(res))));}assert.equal(new Set(ports).size,9);
 a.debugPorts=ports.slice(0,8);a.configuredBrokerPort=ports[8];a.syntheticCanary='SOTERAI_F32_SYNTHETIC_'+crypto.randomBytes(8).toString('hex').toUpperCase();
 a.runRoot='D:\\SoterAI-Lite-test-profiles\\f32-installed-'+new Date().toISOString().replace(/[-:.]/g,'').replace(/\d{3}Z$/,'Z')+'-'+crypto.randomBytes(4).toString('hex');assert(!fs.existsSync(a.runRoot));
 const file=own('installed-admission-02.json');fs.writeFileSync(file,JSON.stringify(a,null,2)+'\n',{flag:'wx'});const output=fact(file);
 require(runner.path).reviewedAdmission(output.path,output.sha256);
 fs.writeFileSync(own('installed-prelaunch-review-02.json'),JSON.stringify({feature:'F32',status:'PASS_EXPLICIT_SECOND_NORMAL_ROUND_ADMISSION_NATIVE_NOT_RUN',observedAt:new Date().toISOString(),admission:output,runner,previousRound:a.previousRound,root:a.runRoot,retainedFailure:'ROUND01_BEFORE_CLI_PRODUCT_NO_REGRADING',safetyFix:'Copy exact public vendor receipt to D assets; strict reparse refusal unchanged',signalsRequested:0},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:'PASS_EXPLICIT_SECOND_NORMAL_ROUND_ADMISSION_NATIVE_NOT_RUN',admission:output,runner,runRoot:a.runRoot}));
})().catch(e=>{console.error(e);process.exitCode=1;});
