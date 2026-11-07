// Content inspection is a PowerShell gate; never mislabel it as a Node gate.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {gate,fact,json,own,sha}=require('./post-full04-contract.cjs');
module.exports=function currentGate(name){
 if(name!=='content-inspection-02')return gate(name);
 const rawFile=own(name+'.txt'),receiptFile=own(name+'.txt.result.json'),value=json(receiptFile),raw=fs.readFileSync(rawFile);
 assert.equal(value.exitCode,0);assert.equal(value.file,'powershell');assert.equal(path.resolve(value.output).toLowerCase(),rawFile.toLowerCase());assert.equal(value.sha256.toLowerCase(),sha(raw));assert(!raw.includes(0));
 const args=value.arguments;assert.equal(args[0],'-NoProfile');assert.equal(args[1],'-ExecutionPolicy');assert.equal(args[2],'Bypass');assert.equal(args[3],'-File');assert.equal(path.basename(args[4]),'inspect-vsix-02.ps1');
 return {receipt:fact(receiptFile),raw:fact(rawFile),value,text:raw.toString('utf8')};
};
