'use strict';
const fs=require('node:fs'),path=require('node:path');
let s=fs.readFileSync(path.join(__dirname,'prepare-index-02.cjs'),'utf8').replace("const parent='318bf8", "const catalogPath='docs/soterai-lite/LITE-CATALOG.json';\nconst parent='318bf8");
s=s.replace('## STEP RECEIPT F18-INDEX / Windows argv repair','## STEP RECEIPT F18-INDEX03 / missing helper constant corrected').replace('Acceptance01 all actual gates PASS and saved before index preparation hit Windows spawn E2BIG on 638 explicit ls-files paths.','Acceptance01 actual gates unchanged PASS. Index02 stopped before collection because its catalogPath helper constant was missing; that failed raw receipt is retained. Earlier index preparation hit Windows spawn E2BIG on 638 explicit ls-files paths.');
fs.writeFileSync(path.join(__dirname,'prepare-index-03.cjs'),s,{flag:'wx'});
s=fs.readFileSync(path.join(__dirname,'close-source-02.ps1'),'utf8').replaceAll('index-preparation-02','index-preparation-03').replaceAll('prepare-index-02.cjs','prepare-index-03.cjs');fs.writeFileSync(path.join(__dirname,'close-source-03.ps1'),s,{flag:'wx'});
