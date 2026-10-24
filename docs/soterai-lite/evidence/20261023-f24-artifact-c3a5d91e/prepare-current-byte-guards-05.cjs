'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8'),put=(name,text)=>fs.writeFileSync(path.join(__dirname,name),text,{flag:'wx'});
let source=read('commit-source-03.cjs');
source=source.replace("require('./check-inputs-02.cjs');","require('./check-inputs-02.cjs');require('./current-acceptance-guard-01.cjs').check();");
assert(source.includes("const proof={status:'PASS'"));source=source.replace("const proof={status:'PASS'","require('./current-acceptance-guard-01.cjs').check();\nconst proof={status:'PASS'");put('commit-source-04.cjs',source);
let transition=read('commit-transition-03.cjs');assert(transition.includes(" require('./check-inputs-02.cjs');"));transition=transition.replace(" require('./check-inputs-02.cjs');"," require('./current-acceptance-guard-01.cjs').check();");put('commit-transition-04.cjs',transition);
let prepare=read('prepare-source-commit-02.cjs');prepare=prepare.replace("require('./check-inputs-02.cjs');","require('./check-inputs-02.cjs');require('./current-acceptance-guard-01.cjs').check();");put('prepare-source-commit-03.cjs',prepare);
console.log(JSON.stringify({status:'PREPARED_NOT_EXECUTED_ALL_INPUT_AND_ACCEPTANCE_FACT_RECAPTURE',source:'commit-source-04.cjs',transition:'commit-transition-04.cjs',membership:'prepare-source-commit-03.cjs'}));
