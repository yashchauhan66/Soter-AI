const e=require('./scoped-git-lib-01.cjs');
const paths=['docs/soterai-lite/MASTER-PROMPT-20261016.txt','docs/soterai-lite/LITE-CATALOG.json'];
const result=e.verify(paths.map(file=>'HEAD:'+file),paths.map(e.fact));
console.log(JSON.stringify({status:'PASS_ACTUAL_COMMITTED_BYTE_READER',files:result.length,paths:result.map(row=>row.path)}));
