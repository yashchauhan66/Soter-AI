'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
let source=fs.readFileSync(path.join(__dirname,'record-progress-07.cjs'),'utf8');
const before='assert.equal(functional.functional.failed,0);assert.equal(functional.functional.passed,10);';assert(source.includes(before));
source=source.replace(before,"assert.equal(functional.failed,0);assert.equal(functional.passed,10);assert.equal(functional.syntheticOnly,true);assert.equal(functional.observations.length,10);assert(functional.observations.every(row=>row.status==='PASS'));for(const id of ['H09','H10'])assert.equal(functional.observations.filter(row=>row.id===id&&row.status==='PASS').length,1);");
source=source.replace("independence:'LOW',observedAt:","diagnosticCorrection:'Progresshelper07 refused mistaken nested functional count schema before any receipt/ledger write; successor08 validates actual top-level passed/failed plus all10PASS/H09/H10. Original raw failure retained; no test oracle changed.',independence:'LOW',observedAt:");
new vm.Script(source);fs.writeFileSync(path.join(__dirname,'record-progress-08.cjs'),source,{flag:'wx'});console.log('Prepared corrected read-only progress08 helper; original07 retained.');
