'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const put=(name,text)=>fs.writeFileSync(path.join(__dirname,name),text,{flag:'wx'});
const checks="for(const row of records)assert.deepEqual(e.fact(row.path),{path:row.path,bytes:row.bytes,sha256:row.sha256},'Frozen membership working bytes');";
function commit(before,after,member){
 let text=read(before);
 const point=member==='source'?'pathspec=path.join':'spec=path.join';
 const anchor='const paths=[...membership.records.map(row=>row.path),e.base+\'/'+member+'-membership-01.json\'].sort(),'+point;
 assert(text.includes(anchor));
 text=text.replace(anchor,"const frozen=[...membership.records,e.fact(e.base+'/"+member+"-membership-01.json')].sort((a,b)=>a.path.localeCompare(b.path));\nconst paths=frozen.map(row=>row.path),"+point);
 assert(text.includes('const records=paths.map(e.fact);'));
 text=text.replace('const records=paths.map(e.fact);','const records=paths.map(file=>frozen.find(row=>row.path===file));'+checks);
 const end='assert.equal(e.cached().length,0);';
 const last=text.lastIndexOf(end);assert(last>=0);
 text=text.slice(0,last)+end+checks+text.slice(last+end.length);
 put(after,text);
}
commit('commit-source-02.cjs','commit-source-03.cjs','source');
commit('commit-transition-01.cjs','commit-transition-02.cjs','transition');
let text=read('prepare-transition-01.cjs');
const anchor="e.verify(proof.records.map(row=>proof.revision+':'+row.path),proof.records);";assert(text.includes(anchor));
text=text.replace(anchor,anchor+"for(const row of proof.records)assert.deepEqual(e.fact(row.path),{path:row.path,bytes:row.bytes,sha256:row.sha256},'Source proof working bytes before transition');");
put('prepare-transition-02.cjs',text);
console.log(JSON.stringify({status:'PREPARED_NOT_EXECUTED_HARDENED_F24_BYTE_TOOLS',frozenMembership:'Expected pre-add bytes retained through index and commit; post-add/post-commit working recapture; pre-transition complete source working-byte recapture.'}));
