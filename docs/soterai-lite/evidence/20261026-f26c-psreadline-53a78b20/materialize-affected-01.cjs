const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const own=n=>path.join(__dirname,n),repo=path.resolve(__dirname,'../../../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const fact=file=>{const raw=fs.readFileSync(file);return{path:path.relative(repo,file).replace(/\\/g,'/'),bytes:raw.length,sha256:sha(raw)}};
async function main(){
 const {guard}=require('./current-native-guard-04c.cjs');const binding=await guard(),bindingSha=sha(fs.readFileSync(own('native-binding-04.json'))),guardSha=sha(fs.readFileSync(own('current-native-guard-04c.cjs')));
 assert.equal(binding.fileCount,1005);assert.equal(binding.contentEntries.length,15);const provenance=read(own('affected-template-provenance-01.json'));assert.equal(provenance.outputs.length,28);
 const outputs=[];
 for(const row of provenance.outputs){assert.deepEqual(fact(path.join(repo,row.target.path)),row.target);if(!row.target.path.endsWith('.template.ps1'))continue;
  const before=fs.readFileSync(path.join(repo,row.target.path),'utf8');assert(before.includes('__F26C_AFFECTED_BOUND__'));const text=before.replaceAll('__F26C_AFFECTED_BOUND__','F26A_CURRENT_FACTS_BOUND');assert(!/__F26[A-Z_]?[A-Z0-9_]*__/.test(text));
  const filename=path.basename(row.target.path).replace('.template.ps1','.ps1');fs.writeFileSync(own(filename),text,{flag:'wx'});outputs.push(fact(own(filename)));
 }
 assert.equal(outputs.length,25);const template=own('affected-native-binding-01b.template.ps1');let common=fs.readFileSync(template,'utf8').replaceAll('__F26C_BINDING_SHA256__',bindingSha).replaceAll('__F26C_GUARD_SHA256__',guardSha);assert(!/__F26C_/.test(common));
 fs.writeFileSync(own('affected-native-binding-01.ps1'),common,{flag:'wx'});outputs.push(fact(own('affected-native-binding-01.ps1')));
 const source=read(own('native-driver-provenance-03.json'));assert.equal(source.drivers.length,21);assert(!source.drivers.some(row=>/precommit/i.test(row.path)));
 fs.writeFileSync(own('affected-materialization-01.json'),JSON.stringify({status:'MATERIALIZED_BOUND_NOT_EXECUTED',observedAt:new Date().toISOString(),binding:fact(own('native-binding-04.json')),guard:fact(own('current-native-guard-04c.cjs')),commonTemplate:fact(template),templateProvenance:fact(own('affected-template-provenance-01.json')),outputs,retainedInputs:provenance.outputs.filter(row=>!row.target.path.endsWith('.template.ps1')),native06:'EXCLUDED_USER_DEFERRED_NOT_RUN',limits:'Same25 accepted pipe-owning controls and same timeouts/oracles, new exact1005/full04/backend03/artifact03/all15entries/21drivers guard. No behavior PASS or previous result transfer; syntax parse still required.'},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({status:'MATERIALIZED_BOUND_NOT_EXECUTED',helpers:26,sourceInputs:1005,drivers:21,native06:'EXCLUDED_NOT_RUN'}));
}
main().catch(()=>{console.error('F26c affected materialization refused before any editor launch.');process.exitCode=1});
