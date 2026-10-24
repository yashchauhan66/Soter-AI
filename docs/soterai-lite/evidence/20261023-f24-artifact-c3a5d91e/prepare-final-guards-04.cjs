'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8'),put=(name,text)=>fs.writeFileSync(path.join(__dirname,name),text,{flag:'wx'});
let transition=read('commit-transition-02.cjs');
const guard=`function checkSourceWorkingBytes(){
 require('./check-inputs-02.cjs');
 const source=e.read(e.base+'/f24-source-byte-verification-01.json');assert.equal(source.status,'PASS');
 assert.equal(source.revision,membership.parent);assert.equal(source.mismatches.length,0);
 for(const row of source.records){if(row.path==='docs/soterai-lite/ledger.md'||row.path==='docs/soterai-lite/FEATURE-QUEUE.json')continue;assert.deepEqual(e.fact(row.path),{path:row.path,bytes:row.bytes,sha256:row.sha256},'Final transition source working bytes');}
 assert.equal(e.fact(source.retainedArtifact.path).sha256,source.retainedArtifact.sha256);
}
`;
const anchor='const frozen=';assert(transition.includes(anchor));transition=transition.replace(anchor,guard+'checkSourceWorkingBytes();\n'+anchor);
const end='const proof={status:';assert(transition.includes(end));transition=transition.replace(end,'checkSourceWorkingBytes();\n'+end);put('commit-transition-03.cjs',transition);
let binding=read('verify-acceptance-bindings-01.cjs');
const closure=`function actualSinkClosure(resultPath){
 const dir=path.posix.dirname(resultPath),file=dir+'/owned-editor-close.json',value=e.read(file);
 assert.equal(value.observedExit,true);assert.equal(value.exitCode,0);assert.equal(value.stdoutEOF,true);assert.equal(value.stderrEOF,true);assert.equal(value.signalsRequested,0);assert(Number.isSafeInteger(value.pid)&&value.pid>0);
 const streams=['stdout.txt','stderr.txt'].map(name=>{const relative=dir+'/'+name;const text=fs.readFileSync(abs(relative),'utf8');assert(!text.startsWith('INCOMPLETE: stdout drain'));assert(!text.startsWith('INCOMPLETE: stderr drain'));return e.fact(relative);});
 return {closure:e.fact(file),streams};
}
const functionalClosure=actualSinkClosure(functionalPath),securityClosure=actualSinkClosure(securityPath);
for(const id of ['H09','H10'])assert.equal(functional.observations.filter(row=>row.id===id&&row.status==='PASS').length,1);
`;
assert(binding.includes('const durable=[];'));binding=binding.replace('const durable=[];',closure+'const durable=[];');
assert(binding.includes('functionalSecurity:{freeze:'));binding=binding.replace('functionalSecurity:{freeze:','functionalSecurity:{functionalClosure,securityClosure,freeze:');
put('verify-acceptance-bindings-02.cjs',binding);
console.log(JSON.stringify({status:'PREPARED_NOT_EXECUTED_FINAL_TRANSITION_AND_SINK_EOF_GUARDS',sourceRecapture:'pre-add and post-commit, intentional queue/ledger changes excepted',actualSinkClosures:2}));
