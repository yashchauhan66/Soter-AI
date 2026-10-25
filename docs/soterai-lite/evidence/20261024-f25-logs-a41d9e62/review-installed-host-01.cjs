'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),priorFile=path.resolve(__dirname,'../20261023-f24-artifact-c3a5d91e/host-version-review-01.json');
const prior=JSON.parse(fs.readFileSync(priorFile,'utf8').replace(/^\uFEFF/,'')),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
assert.equal(process.argv[2],'1.143.1','Current executable product version differs; inspect new host before any launch');
const root=path.dirname(prior.currentHost.executable.path),facts=[];
for(const expected of [prior.currentHost.executable,...prior.currentHost.applicationFiles]){
 const actual=path.resolve(expected.path);assert(actual.toLowerCase().startsWith(root.toLowerCase()+path.sep));
 const stat=fs.lstatSync(actual);assert(stat.isFile()&&!stat.isSymbolicLink());const bytes=fs.readFileSync(actual);
 const fact={path:actual,bytes:bytes.length,sha256:sha(bytes)};assert.equal(fact.bytes,expected.bytes,actual);assert.equal(fact.sha256,expected.sha256,actual);facts.push(fact);
}
const packageFile=facts.find(row=>row.path.endsWith(path.sep+'package.json')),pkg=JSON.parse(fs.readFileSync(packageFile.path,'utf8'));assert.equal(pkg.version,process.argv[2]);
const source=fs.readFileSync(prior.apiReview.source.path,'utf8'),checks=prior.apiReview.checks.map(row=>{
 const offset=source.indexOf(row.exactWitness);assert(offset>=0,'Current installed API witness missing: '+row.api);
 return {api:row.api,status:'PRESENT_STATIC_ONLY',utf16Offset:offset,exactWitness:row.exactWitness,assessment:'Freshly observed installed source witness only; current F25 exact-artifact native evidence remains required.'};
});assert.equal(checks.length,20);
const value={schemaVersion:1,status:'REVIEWED_NEW_EDITOR_HOST_STATIC_ONLY_NATIVE_PENDING',currentFeature:'F25',independence:'LOW',
 scope:'Fresh read-only current Code executable/application byte inspection and20API witness searches. Exact expected reviewed1.143.1 pins match; no update/download/login/normal profile access or native behavior claim.',
 currentHost:{...prior.currentHost,executable:facts[0],applicationFiles:facts.slice(1),fileAndProductVersionObserved:process.argv[2]},
 priorReview:{path:path.relative(repo,priorFile).replaceAll('\\','/'),bytes:fs.readFileSync(priorFile).length,sha256:sha(fs.readFileSync(priorFile))},
 apiReview:{source:facts.find(row=>row.path===prior.apiReview.source.path),checks},nativeBehaviorVerified:false,observedAt:new Date().toISOString()};
fs.writeFileSync(path.join(__dirname,'host-version-review-01.json'),JSON.stringify(value,null,2),{flag:'wx'});console.log(JSON.stringify({status:value.status,currentFeature:'F25',version:pkg.version,files:facts.length,staticWitnesses:checks.length,executableSha256:facts[0].sha256}));
