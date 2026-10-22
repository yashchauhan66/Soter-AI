'use strict';
const h=require('./evidence-lib-01.cjs'),{fs,own,assert}=h;
const seed=fs.readFileSync(own('run-current-affected-suite-03.ps1'),'utf8');assert.equal((seed.match(/-run-03/g)||[]).length,10);assert(seed.includes('affected-suite-summary-03.json'));
const text=seed.replaceAll('-run-03','-run-04').replace('affected-suite-summary-03.json','affected-suite-summary-04.json');
assert(!fs.existsSync(own('run-current-affected-suite-04.ps1')));fs.writeFileSync(own('run-current-affected-suite-04.ps1'),text,{flag:'wx'});
console.log(JSON.stringify({status:'PREPARED_NOT_EXECUTED',scope:'Only output receipt names changed; current candidate03/compiled03/all launchers02/assertions/budgets unchanged.',file:'run-current-affected-suite-04.ps1'}));
