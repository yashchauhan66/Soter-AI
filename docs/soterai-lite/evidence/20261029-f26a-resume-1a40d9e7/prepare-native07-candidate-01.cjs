const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('./diagnostic-admission-07.cjs'),{own,read,fact,sha}=C;
const put=(n,s)=>fs.writeFileSync(own(n),s,{flag:'wx'});
(async()=>{
 const admission=await C.guard(),driver=admission.driver,provenance=fact(own('native-driver-provenance-07.json'));
 let host=fs.readFileSync(own('host-current-binding-01.ps1'),'utf8');
 host=host.replace('current-admission-01.cjs','diagnostic-admission-07.cjs');
 put('host-current-binding-07.ps1',host);
 const helper=fact(own('host-current-binding-07.ps1')),guard=fact(own('diagnostic-admission-07.cjs'));
 const original=fs.readFileSync(own('native06-candidate-02.ps1.txt'),'utf8');let candidate=original;
 const maps=[['899f01c8e699e613ac5d3fc2f8066e8997938e79ecc665dfe34af3e5c4e9090b',driver.sha256],['69664',String(driver.bytes)],['prebuilt-native-hosts-02/lite-precommit-guard-host.js','prebuilt-native-hosts-07/lite-precommit-guard-host.js'],['native-driver-provenance-02.json','native-driver-provenance-07.json'],['427befc36241649e54b9f87a9c5dc9232470dc7b78472a5594b832c57bc3fe89',provenance.sha256],['host-current-binding-01.ps1','host-current-binding-07.ps1'],["'f17d7add4c8b98c543cc15f82be93e93132c87bb08930f06ce58dcc28752e253' 552","'"+helper.sha256+"' "+helper.bytes],['native06-user-approval-01.json','native07-user-approval-01.json'],['EXPLICIT_USER_AUTHORIZATION_ONE_F26A_NATIVE06','EXPLICIT_USER_AUTHORIZATION_ONE_F26A_NATIVE07'],['NATIVE06-REFRESHED-PROPOSAL01.md','NATIVE07-DIAGNOSTIC-PROPOSAL01.md'],['native06-consumption-01.json','native07-consumption-01.json'],['SINGLE_APPROVED_F26A_NATIVE06_CONSUMED_NO_AUTO_RETRY','SINGLE_APPROVED_F26A_NATIVE07_CONSUMED_NO_AUTO_RETRY']];
 for(const[from,to]of maps){assert(candidate.includes(from),'Required exact candidate substitution '+from);candidate=candidate.split(from).join(to);}
 const anchor='# Additional exact helper custody before any helper invocation.';
 const inserted=`${anchor}\nAssert-F26AFile (Join-Path $taskRepo 'docs/soterai-lite/evidence/20261029-f26a-resume-1a40d9e7/diagnostic-admission-07.cjs') '${guard.sha256}' ${guard.bytes}`;
 candidate=candidate.replace(anchor,inserted);
 // Prove bootstrap (including environment/startup observers), all native
 // deadlines and the offline owner helper remain exactly unchanged.
 const bootstrap=s=>s.slice(s.indexOf("$taskBootstrap=@'"),s.indexOf("\n'@",s.indexOf("$taskBootstrap=@'"))+3);
 assert.equal(bootstrap(candidate),bootstrap(original));
 const deadlines=s=>[...s.matchAll(/WaitForExit\([^)]*\)|(?:TotalSeconds|TotalMilliseconds)\s*-lt\s*\d+/g)].map(r=>r[0]);assert.deepEqual(deadlines(candidate),deadlines(original));
 let reversed=candidate.replace(inserted,anchor);for(const[from,to]of [...maps].reverse())reversed=reversed.split(to).join(from);assert.equal(reversed,original);
 assert(!fs.existsSync(own('native07-user-approval-01.json')));assert(!fs.existsSync(own('native07-consumption-01.json')));
 put('native07-candidate-01.ps1.txt',candidate);
 put('native07-packet-review-01.json',JSON.stringify({status:'PREPARED_NATIVE07_NOT_AUTHORIZED_NOT_MATERIALIZED_NOT_RUN',observedAt:new Date().toISOString(),parent:fact(own('native06-candidate-02.ps1.txt')),candidate:fact(own('native07-candidate-01.ps1.txt')),driver,provenance,guard,helper,metadataMaps:maps,reversalExact:true,bootstrapByteExact:true,deadlinesUnchanged:true,offlineHelper:fact(own('precommit-offline-owner-01.cjs')),sourceCount:1036,oracles:34,productionChanges:0,explicitNewApprovalRequired:true,priorNative06ApprovalConsumed:true},null,2)+'\n');
 console.log(JSON.stringify({status:'NATIVE07_PROPOSAL_CANDIDATE_PREPARED_NOT_RUN',candidate:fact(own('native07-candidate-01.ps1.txt')),driver}));
})().catch(e=>{console.error(e);process.exitCode=1;});
