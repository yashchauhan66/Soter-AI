'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),net=require('node:net');
const own=n=>path.join(__dirname,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),fact=f=>{const b=fs.readFileSync(f);return{path:path.resolve(f),bytes:b.length,sha256:sha(b)}},read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
(async()=>{
 const prior=read(own('installed-admission-02.json')),a=structuredClone(prior);
 for(const[key,name,digest]of [
 ['runner','run-installed-lifecycle-proposed-04.cjs','e856d33533a35258792f73f30384ff0e466d9cf05271fbf897579b099909c743'],
 ['observer','installed-observer-proposed-04.cjs','19ef9200e87682591e06524ee95ef1a100fc5f0179deacbdcb0867b5288d0530'],
 ['oldObserver','installed-upgrade-old-observer-proposed-03.cjs','af2835f75b54faa152f8d8dad7e87b62a68beae219b7fd969e9e67d497b1bb55'],
 ['renderer','installed-renderer-proposed-03.cjs','2839106c69f8f1b83b6dd319332d4bf76bb02b054f07626d698438d625a003c5']]){const r=fact(own(name));assert.equal(r.sha256,digest);a.fixtures[key]=r;}
 a.status='ROOT_REVIEWED_F32_INSTALLED_ROUND03_FINAL_INPUTS';a.normalRound=3;
 a.previousRound02={consumed:fact(own('installed-normal-round-02-consumed.json')),admission:fact(own('installed-admission-02.json')),failure:fact(path.join(prior.runRoot,'receipts/installed-round-02-failure.json')),codeClose:fact(path.join(prior.runRoot,'profile-primary/F32Gate/primary/primary-code-owned-close.json')),listenerClose:fact(path.join(prior.runRoot,'profile-primary/F32Gate/primary/primary-listener-custody-owned-close.json')),rootResult:fact(own('installed-native-02.txt.result.json'))};
 a.installerSizeQualification=fact(own('vendor-installed-size-qualification-02.json'));
 const servers=[],ports=[];try{for(let i=0;i<9;i++){const s=net.createServer();await new Promise((res,rej)=>{s.once('error',rej);s.listen(0,'127.0.0.1',res);});servers.push(s);const p=s.address().port;assert(p!==47321);ports.push(p);}}finally{await Promise.all(servers.map(s=>new Promise(res=>s.close(res))));}assert.equal(new Set(ports).size,9);
 a.debugPorts=ports.slice(0,8);a.configuredBrokerPort=ports[8];a.syntheticCanary='SOTERAI_F32_SYNTHETIC_'+crypto.randomBytes(8).toString('hex').toUpperCase();a.runRoot='D:\\SoterAI-Lite-test-profiles\\f32-installed-'+new Date().toISOString().replace(/[-:.]/g,'').replace(/\d{3}Z$/,'Z')+'-'+crypto.randomBytes(4).toString('hex');assert(!fs.existsSync(a.runRoot));
 const file=own('installed-admission-03.json');fs.writeFileSync(file,JSON.stringify(a,null,2)+'\n',{flag:'wx'});const output=fact(file);require(a.fixtures.runner.path).reviewedAdmission(output.path,output.sha256);
 fs.writeFileSync(own('installed-prelaunch-review-03.json'),JSON.stringify({feature:'F32',status:'PASS_EXPLICIT_THIRD_NORMAL_ROUND_ADMISSION_NATIVE_NOT_RUN',observedAt:new Date().toISOString(),admission:output,runner:a.fixtures.runner,previousRound02:a.previousRound02,installerSizeQualification:a.installerSizeQualification,root:a.runRoot,unchangedOriginalAssertions:44,unchangedPhaseObservations:59,signalsRequested:0},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:'PASS_EXPLICIT_THIRD_NORMAL_ROUND_ADMISSION_NATIVE_NOT_RUN',admission:output,runner:a.fixtures.runner,runRoot:a.runRoot}));
})().catch(e=>{console.error(e);process.exitCode=1;});
