'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm'),own=n=>path.join(__dirname,n);
let verifier=fs.readFileSync(own('verify-affected-01.cjs'),'utf8');
function replace(a,b){assert.equal(verifier.split(a).length,2,a);verifier=verifier.replace(a,()=>b);}
replace("chain=read(own('affected-chain-result-01.json'))","chain=read(own('affected-chain-result-02.json'))");
replace("assert.equal(chain.status,'F31B_AFFECTED4_AND_FUNCTIONAL_SECURITY_CLOSED_ROOT_AGGREGATION_PENDING')","assert.equal(chain.status,'F31B_REMAINING_RETAINED_FUNCTIONAL_SECURITY_MCP_ROUND02_CLOSED_ROOT_AGGREGATION_PENDING')");
replace("assert.deepEqual(chain.results.map(r=>r.name),[...b.families.map(f=>'affected-'+f.id+'-f31b-01'),'affected-functional-security-f31b-01'])","assert.deepEqual(chain.results.map(r=>r.name),['affected-retained-f31b-02','affected-functional-security-f31b-02','affected-mcp-f31b-02']);const originalFailure=read(own('affected-chain-failure-01.json'));assert.deepEqual(originalFailure.results.slice(0,2).map(r=>r.name),['affected-ps51-f31b-01','affected-editor-f31b-01']);assert(originalFailure.results.slice(0,2).every(r=>r.status==='PASS_CLOSED_WRAPPER_ROOT_AGGREGATION_PENDING'))");
replace("wrapper('affected-'+f.id+'-f31b-01')","wrapper('affected-'+f.id+'-f31b-'+(['ps51','editor'].includes(f.id)?'01':'02'))");
replace("wrapper('affected-functional-security-f31b-01')","wrapper('affected-functional-security-f31b-02')");
replace("['native-binding-01.json','native-materialization-01.json','affected-chain-consumption-01.json','affected-chain-result-01.json','prior-owner-absence-01.json']","['native-binding-01.json','native-materialization-01.json','affected-chain-consumption-01.json','affected-chain-failure-01.json','affected-chain-consumption-02.json','affected-chain-result-02.json','affected-continuation-02.json','prior-owner-absence-01.json','prior-owner-absence-02.json']");
new vm.Script(verifier);fs.writeFileSync(own('verify-affected-02.cjs'),verifier,{flag:'wx'});
const observer=fs.readFileSync(own('observe-prior-owner-02.ps1'),'utf8').replaceAll('prior-owner-absence-02.json','post-owner-absence-01.json');fs.writeFileSync(own('observe-post-owner-01.ps1'),observer,{flag:'wx'});
console.log('PREPARED: actual successful prior2 plus bounded continuation3 wrappers; no failed MCP reuse, no native execution.');
