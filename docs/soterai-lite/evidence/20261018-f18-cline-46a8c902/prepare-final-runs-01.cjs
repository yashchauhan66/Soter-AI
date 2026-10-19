'use strict';
const fs=require('node:fs'),path=require('node:path');
const base=__dirname;
function derive(from,to,pairs){let s=fs.readFileSync(path.join(base,from),'utf8');for(const[a,b]of pairs){if(!s.includes(a))throw Error('Missing fixture anchor: '+a);s=s.split(a).join(b);}fs.writeFileSync(path.join(base,to),s,{flag:'wx'});}
derive('product-matrix-01.cjs','product-matrix-02.cjs',[["if(scenario==='mcp-public'&&!records.requests.some(item=>item.scenario==='mcp-public'&&item.publicSeen))","if((scenario==='mcp-public'&&!records.requests.some(item=>item.scenario==='mcp-public'&&item.publicSeen))||(scenario==='mcp-env'&&!records.requests.some(item=>item.scenario==='mcp-env'&&item.envSchemaSeen))||(scenario==='editor-public'&&stageRequests<2))"]]);
derive('run-product-matrix-01.ps1','run-product-matrix-02.ps1',[['product-matrix-01.cjs','product-matrix-02.cjs']]);
derive('run-suites-02.ps1','run-suites-03.ps1',[['broker-typecheck-03','broker-typecheck-06'],['broker-tests-02','broker-tests-03'],['full-tests-02','full-tests-03'],['readiness-02','readiness-03']]);
console.log('Prepared versioned final suite and matrix fixtures; no test executed.');
