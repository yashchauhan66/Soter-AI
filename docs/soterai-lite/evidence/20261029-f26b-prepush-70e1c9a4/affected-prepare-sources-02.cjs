'use strict';
// Evidence-only fixture preparation. No build, host, Git, browser or listener.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),prior=path.resolve(__dirname,'../20261029-f26a-resume-1a40d9e7');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fact=p=>{const b=fs.readFileSync(p);return{path:path.relative(repo,p).replaceAll('\\','/'),bytes:b.length,sha256:sha(b)};};
const put=(n,v)=>fs.writeFileSync(own(n),typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const proof=fact(own('full-inputs-02.json'));assert.equal(proof.sha256,'355ec5a564da2e26c6fe8e6d2d08d433dd837dd08c97b67fe7fc9bdfe3bc3be2');assert.equal(read(own('full-inputs-02.json')).fileCount,1070);
const original=read(path.join(prior,'affected-scope-08.json'));
assert.equal(original.families.length,20);assert.equal(original.families.reduce((n,f)=>n+f.assertions,0),509);assert.equal(original.families.reduce((n,f)=>n+f.phases,0),37);
assert(original.families.every(f=>!f.driver.includes('precommit')&&!f.driver.includes('prepush')));
const scope={schemaVersion:1,status:'F26B_AFFECTED20_509_37_PREDECLARED_NOT_RUN',sourceProof:proof,
 families:original.families,assertions:509,phases:37,functional:10,security:17,
 driverInventory:'native-driver-provenance-02.json',driverBuild:'Common fresh25 = original24 nonprecommit F30 entrypoints + F26b native36; no separate affected build',
 currentArtifact:'Future exact F26b VSIX/content-inspection-02;87 restricted machine flags/four runtimes; no old artifact acceptance transfer',
 deferred:{feature:'F26a',family:'precommit',status:'USER_DEFERRED_UNVERIFIED',operations:['native09','offline owner Git helper','restart4'],substitute:false,completionBlocked:true},
 componentGate:'F26b native36 component acceptance with actual safe closure, separate from configured push',
 configuredPush:'NOT_AUTHORIZED_NOT_RUN',execution:'Prepared only; no launches by this author; serial each original helper with actualclose/bothEOF/no signals; root aggregation and policy-preserving withdrawal remain required'};
put('affected-scope-02.json',scope);
const names=new Set(scope.families.map(f=>f.helper));for(const n of ['affected-functional10-01.ps1','affected-security17-01.ps1','affected-functional-security-01.ps1','affected-preparation-pipe-ownership-01.ps1','affected-preparation-functional10-driver-01.js','affected-preparation-security17-driver-01.js'])names.add(n);
const copied=[];for(const n of names){const from=path.join(prior,n);put(n,fs.readFileSync(from));copied.push({source:fact(from),target:fact(own(n))});}
const closure=new Set();for(const r of copied.filter(r=>r.target.path.endsWith('.ps1'))){const text=fs.readFileSync(path.join(repo,r.target.path),'utf8');for(const m of text.matchAll(/Join-Path \$PSScriptRoot '([^']+\.(?:ps1|cjs|js))'/g)){closure.add(m[1]);assert(m[1]==='affected-native-binding-01.ps1'||fs.existsSync(own(m[1])),'Missing retained transitive helper '+m[1]);}}
const out={schemaVersion:1,status:'COPIED_ORIGINAL_HELPER_ASSERTIONS_PREPARED_NOT_BOUND_NOT_RUN',observedAt:new Date().toISOString(),sourceProof:proof,scope:fact(own('affected-scope-02.json')),families:20,assertions:509,phases:37,outputs:copied,transitiveHelperClosure:[...closure].sort(),bindingHelper:'Future current packet after exact content/commondrivers; no historical guard executable copied',sourceChecksRemoved:0,signalsRequested:0,precommit:'USER_DEFERRED_UNVERIFIED_NO_SUBSTITUTE',native:'NOT_RUN'};
put('affected-source-preparation-02.json',out);console.log(JSON.stringify({status:out.status,helpers:copied.length,families:20,assertions:509,phases:37}));
