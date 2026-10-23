'use strict';
const e=require('./evidence-lib-01.cjs'),revision='0ef608959e35ec72d2d490322cbfeef8884c6069',prior='docs/soterai-lite/evidence/20261021-f22g-editor-config-5d7a91c3',names=['verify-source-01.cjs','verify-transition-01.cjs','verify-authored-whitespace-02.cjs','verify-transition-whitespace-01.cjs'];e.git.preload(revision,names.map(name=>prior+'/'+name));const records=[];
for(const name of names){const source=e.git('show',revision+':'+prior+'/'+name);let text=source.toString('utf8').replaceAll('f22g-','f22h-').replaceAll("feature:'F22g'","feature:'F22h'").replaceAll("next:'F22h'","next:'F23'");
 if(name==='verify-authored-whitespace-02.cjs'){
  const marker="const names=lines(git('diff','--cached','--name-only'));";e.assert.equal(text.split(marker).length,2);text=text.replace(marker,"for(const row of read(own('host-template-snapshots-01.json')).snapshots){for(const field of ['observed','committed']){current(row[field]);excluded.add(row[field].path)}}\n"+marker).replace('three previously validated/unchanged executed copied harnesses','three current validated inherited execution harnesses');
 }
 new (require('node:vm').Script)(text,{filename:name});e.fs.writeFileSync(e.own(name),text,{flag:'wx'});records.push({revision,source:prior+'/'+name,sourceBytes:source.length,sourceSha256:e.sha(source),generated:e.fact(e.own(name))});
}
e.write('byte-verifier-inputs-01.json',{status:'PREPARED_NOT_EXECUTED',records,scope:'Reuse exhaustive staged/current/committed source and transition byte proofs from verified predecessor commit; rename only feature/next and exempt exact retained observed/committed template archives from authored-whitespace checks. Every archive remains included in exhaustive byte verification.'});
console.log(JSON.stringify({status:'PREPARED_NOT_EXECUTED',verifiers:records.length}));
