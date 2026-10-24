'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),e=require('./input-lib-01.cjs');
const names=fs.readdirSync(path.join(__dirname,'prebuilt-native-hosts-01')).sort();
assert.equal(names.length,13);
assert.deepEqual(fs.readdirSync(path.join(__dirname,'prebuilt-native-hosts-02')).sort(),names);
const rows=names.map(name=>{
 const before=e.sha(fs.readFileSync(path.join(__dirname,'prebuilt-native-hosts-01',name)));
 const after=e.sha(fs.readFileSync(path.join(__dirname,'prebuilt-native-hosts-02',name)));
 const equal=before===after;
 assert.equal(equal,name!=='lite-artifact-host.js',name);
 return {name,before,after,equal};
});
const result={status:'PASS_ONLY_NATIVE_ARTIFACT_DRIVER_CHANGED',unchangedDrivers:12,rows};
fs.writeFileSync(path.join(__dirname,'native-rebuild-comparison-02.json'),JSON.stringify(result,null,2),{flag:'wx'});
console.log(JSON.stringify({status:result.status,unchangedDrivers:12}));
