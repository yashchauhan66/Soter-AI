const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),e=require('./input-lib-01.cjs');
const frozen=JSON.parse(fs.readFileSync(path.join(__dirname,'source-inputs-03.json'),'utf8'));
assert.deepEqual([...e.inventory(),'docs/vscode-extension-readiness.md'].sort(),frozen.records.map(row=>row.path).sort());for(const row of frozen.records)assert.deepEqual(e.fact(row.path),row,row.path);
console.log(JSON.stringify({status:'EXACT_CURRENT_INPUTS',files:frozen.records.length}));
