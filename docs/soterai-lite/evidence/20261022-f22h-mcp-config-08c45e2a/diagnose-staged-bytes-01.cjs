'use strict';
const e=require('./evidence-lib-01.cjs'),index=e.read(e.own('f22h-evidence-index-01.json')),rows=[];
e.assert.equal(e.git('rev-parse','HEAD').toString('utf8').trim(),index.parent);e.git.preload('',index.entries.map(row=>row.path));
const folder=e.own('staged-drift-before-01');e.assert(!e.fs.existsSync(folder));e.fs.mkdirSync(folder);
for(const row of index.entries){const current=e.bytes(e.path.join(e.repo,row.path)),staged=e.git('show',':'+row.path);e.current(row);if(e.sha(staged)===row.sha256&&staged.length===row.bytes)continue;
 e.assert(!row.path.startsWith(e.base+'/'));e.assert.equal(staged.toString('utf8').replace(/\r\n/g,'\n'),current.toString('utf8').replace(/\r\n/g,'\n'),'Semantic staged difference refused: '+row.path);
 const target=e.inside(folder,row.path+'.txt');e.fs.mkdirSync(e.path.dirname(target),{recursive:true});e.fs.writeFileSync(target,staged,{flag:'wx'});
 rows.push({expected:row,staged:{bytes:staged.length,sha256:e.sha(staged)},snapshot:e.fact(target),classification:'EOL_ONLY_INDEX_LF_WORKING_CRLF'});
}
e.assert.equal(rows.length,19);
const report={status:'PASS_DIAGNOSED19_EOL_ONLY_STAGED_DRIFT_NOT_COMMITTED',parent:index.parent,index:e.fact(e.own('f22h-evidence-index-01.json')),rows,scope:'All indexed working bytes still match1955-entry prepared index. Exactly19 task-owned files retain LF in index versus tested CRLF working representations; normalized text identical. Explicit Git add had retained existing cached tracked entries. Archive staged LF bytes; force scoped rehash with core.autocrlf=false, no working-file edits or source/test/runtime changes. Failed staged verification and aggregate preserved.'};
e.write('staged-byte-diagnostics-01.json',report);e.fs.writeFileSync(e.own('staged-rehash-allowlist-01.txt'),rows.map(row=>row.expected.path).sort().join('\n')+'\n',{flag:'wx'});
console.log(JSON.stringify({status:report.status,paths:rows.length}));
