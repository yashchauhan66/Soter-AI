// Bind actual completed results only; no test execution or historical result reuse.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {fact,json,gate,own,repo,OUTPUT}=require('./post-full04-contract.cjs');
const target=own('post-full04-binding.json');assert(!fs.existsSync(target),'Immutable binding exists.');
const proof=json(own('full-inputs-04.json'));assert.equal(proof.fileCount,990);assert.equal(proof.files.length,990);
assert.equal(fact(own('full-inputs-04.json')).sha256,'49df8a06db5b5ae8f452b3608d5fd28fbf1d46132cddf00762b5f93a5504aeab');
for(const row of proof.files)assert.deepEqual(fact(path.join(repo,row.path)),row);
const compiler=gate('compiler-15'),full=gate('full-tests-03');assert(!full.raw.sha256.includes('UNBOUND'));
assert(!fs.readFileSync(own('full-tests-03.txt')).includes(0),'NUL raw refused.');
const summary={};
for(const key of ['tests','pass','fail','cancelled','skipped']){const rows=[...full.text.matchAll(new RegExp('^# '+key+' ([0-9]+)\\r?$','gm'))];assert.equal(rows.length,1,key);summary[key]=Number(rows[0][1]);}
assert.equal(summary.tests,4223);assert.equal(summary.pass,4219);assert.equal(summary.fail,0);assert.equal(summary.cancelled,0);assert.equal(summary.skipped,4);
const start=json(own('full-tests-start-03.json'));assert.equal(start.inputSha256,fact(own('full-inputs-04.json')).sha256);assert.equal(start.fileCount,990);
fs.writeFileSync(target,JSON.stringify({status:'CURRENT_FULL03_COMPILER15_INPUTS04_BOUND',fileCount:990,sourceProof:fact(own('full-inputs-04.json')),compilerReceipt:compiler.receipt,fullReceipt:full.receipt,expectedFullSummary:summary,outputVsix:OUTPUT,observedAt:new Date().toISOString(),limits:'Actual fresh component/full checks only. No native or prior-artifact result promotion.'},null,2)+'\n',{flag:'wx'});
const checked=require('./post-full04-contract.cjs').check();delete checked.sourceFiles;console.log(JSON.stringify(checked));
