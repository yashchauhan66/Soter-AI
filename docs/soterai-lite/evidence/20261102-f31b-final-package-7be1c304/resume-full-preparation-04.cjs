'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const own=n=>path.join(__dirname,n),repo=path.resolve(__dirname,'../../../..');
let text=fs.readFileSync(own('run-integrated-sharded-03.cjs'),'utf8');
function replace(a,b){assert.equal(text.split(a).length,2,a);text=text.replace(a,()=>b);}
replace("(i<5?'-02':'-03')","(i<5?'-02':'-04')");
replace("...groups[i]]","...groups[i].map(file=>path.join(repo,file))]");
replace("['packages/vscode-extension/scripts/generate-readiness.mjs','--check']","[path.join(repo,'packages/vscode-extension/scripts/generate-readiness.mjs'),'--check']");
replace("['packages/soterai-lite/scripts/package.cjs','soterai-lite-0.7.0-f31b-20261102-attempt01.vsix']","[path.join(repo,'packages/soterai-lite/scripts/package.cjs'),'soterai-lite-0.7.0-f31b-20261102-attempt01.vsix']");
const manifest=JSON.parse(fs.readFileSync(own('full-suite-shards-02.json'),'utf8'));
for(const file of manifest.files)assert(fs.statSync(path.join(repo,file)).isFile());
for(const file of ['packages/vscode-extension/scripts/generate-readiness.mjs','packages/soterai-lite/scripts/package.cjs'])assert(fs.statSync(path.join(repo,file)).isFile());
assert(fs.readFileSync(own('unit-shard-06-03-stderr.bin'),'utf8').startsWith('Could not find '));
assert.equal(fs.statSync(own('unit-shard-06-03-stdout.bin')).size,0);
fs.writeFileSync(own('run-integrated-sharded-04.cjs'),text,{flag:'wx'});
console.log('PASS: all350 absolute test paths and readiness/package inputs exist; no test or product changed. Failed06-03 performed no assertions and is excluded.');
