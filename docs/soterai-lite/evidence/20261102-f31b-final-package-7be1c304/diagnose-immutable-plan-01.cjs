'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const helper=path.resolve(__dirname,'../20261027-f27-self-hygiene-8c16e402/native-owned-phase-01.cjs');
assert.equal(sha(fs.readFileSync(helper)),'c3ca6d3b159ecbd825a0e917a40e5c24cb9aa3aeaa76d67a3fa0fc18113dea4f');
const {phase}=require(helper),keep=setInterval(()=>{},1000);
const test=path.join(repo,'packages/vscode-extension/src/__tests__/public-workspace.test.ts');
Promise.all([['root',repo],['lite',path.join(repo,'packages/soterai-lite')]].map(async([label,cwd])=>{
 const name='immutable-plan-'+label+'-before-01';
 assert(!fs.existsSync(path.join(__dirname,name+'-owned-start.json')));
 const result=await phase({executable:process.execPath,args:['--import','tsx','--test','--test-name-pattern=manifest copies and mutations',test],cwd,env:{...process.env,TEMP:'D:\\SoterAI-Lite-test-profiles\\f03-unit-temp',TMP:'D:\\SoterAI-Lite-test-profiles\\f03-unit-temp'},run:__dirname,name,profile:'F31B_COMPONENT_DIAGNOSTIC_ONLY_NO_NATIVE',deadlineMs:120000});
 console.log(JSON.stringify({label,result}));
})).catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>clearInterval(keep));
