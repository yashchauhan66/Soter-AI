'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const expected={path:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',bytes:454656,sha256:'8e8b07b3e7de55252ecc09dd7082542b6592afba8410e640acb7cda965a4ba16'};
// This one preinstalled Windows binary has two servicing hardlinks. No source,
// profile, evidence, driver or module receives this fixed-path exception.
function pinPowerShell(record){
 assert.deepEqual(record,expected);
 const before=fs.lstatSync(expected.path);assert(before.isFile()&&!before.isSymbolicLink());assert.equal(before.nlink,2);assert.equal(before.size,expected.bytes);assert.equal(fs.realpathSync(expected.path),expected.path);
 const fd=fs.openSync(expected.path,'r');let raw;
 try{const opened=fs.fstatSync(fd);for(const key of ['size','ino','nlink','mtimeMs','ctimeMs'])assert.equal(opened[key],before[key]);raw=fs.readFileSync(fd);}finally{fs.closeSync(fd);}
 assert.equal(raw.length,expected.bytes);assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),expected.sha256);
 const after=fs.lstatSync(expected.path);for(const key of ['size','ino','nlink','mtimeMs','ctimeMs'])assert.equal(after[key],before[key]);return expected;
}
module.exports={pinPowerShell};
if(require.main===module){pinPowerShell(expected);for(const bad of [{...expected,path:expected.path.toLowerCase()},{...expected,bytes:expected.bytes+1},{...expected,sha256:'0'.repeat(64)}])assert.throws(()=>pinPowerShell(bad));console.log(JSON.stringify({status:'PASS_FIXED_VENDOR_PIN_AND_THREE_RECORD_REFUSALS',checks:4,nlink:2,sha256:expected.sha256,sourceGuardException:false}));}
