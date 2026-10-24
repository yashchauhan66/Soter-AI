const fs=require('node:fs'),path=require('node:path'),e=require('./input-lib-01.cjs');
const records=e.inventory().map(e.fact);
fs.writeFileSync(path.join(__dirname,'source-inputs-01.json'),JSON.stringify({status:'FROZEN_CURRENT_SOURCE_TEST_BUILD_INPUTS',records},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'FROZEN',files:records.length}));
