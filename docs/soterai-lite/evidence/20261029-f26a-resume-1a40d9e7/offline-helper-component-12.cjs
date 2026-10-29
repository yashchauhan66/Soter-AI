'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),{own,sha}=require('./storage-current-admission-09.cjs');
const candidate=fs.readFileSync(own('precommit-offline-owner-12.cjs.txt'),'utf8'),old=fs.readFileSync(own('precommit-offline-owner-01.cjs'),'utf8');
const prefix=candidate.slice(0,candidate.indexOf('function main()'))+'\nmodule.exports={ordinary,fileHash,same};';
function load(statChange){const mock=Object.create(fs);if(statChange)mock.lstatSync=f=>{const value=fs.lstatSync(f);return statChange(f,value)||value;};const box={require:n=>n==='node:fs'?mock:require(n),module:{exports:{}},Buffer};vm.runInNewContext(prefix,box,{timeout:2000});return box.module.exports;}
const base=load(),git='C:\\Program Files\\Git\\cmd\\git.exe',code='C:\\Users\\USER\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe';let passed=0;
function test(name,work){work();passed++;console.log('PASS '+name);}
test('actual pinned installed Git two-link file accepted with exact SHA',()=>{assert.equal(base.ordinary(git).nlink,2);assert.equal(base.fileHash(git,1048576),'da240fe9bc24895b3e04150a4990b8a6ff329ecabcd8f19684c2cc310da5ef3f');});
const h29=path.resolve(__dirname,'../20261028-f29-protection-center-6c93e15a'),directory=fs.readdirSync(h29).find(x=>/^streamed-pin-fixture-08-/.test(x));assert(directory);
test('ordinary synthetic single-link file accepted',()=>assert.equal(base.ordinary(path.join(h29,directory,'synthetic-empty.bin')).nlink,1));
test('actual hard-linked synthetic file refused',()=>assert.throws(()=>base.ordinary(path.join(h29,directory,'synthetic-public.bin'))));
test('third installed Git link refused without modifying vendor file',()=>{const probe=load((f,s)=>base.same(f,git)?Object.assign(Object.create(s),{nlink:3}):undefined);assert.throws(()=>probe.ordinary(git));});
test('two links on another vendor path refused without modifying vendor file',()=>{const probe=load((f,s)=>base.same(f,code)?Object.assign(Object.create(s),{nlink:2}):undefined);assert.throws(()=>probe.ordinary(code));});
test('Git hash and read cap remain enforced',()=>{assert.throws(()=>assert.equal(base.fileHash(git,1048576),'0'.repeat(64)));assert.throws(()=>base.fileHash(git,32));});
test('entire actual Git spawn ownership and negative assertion suffix unchanged',()=>assert.equal(candidate.slice(candidate.indexOf('  const stdoutFile =')),old.slice(old.indexOf('  const stdoutFile ='))));
console.log(JSON.stringify({status:'PASS_OFFLINE_HELPER_ADMISSION_COMPONENTS_NOT_NATIVE',passed,gitOrCodeLaunched:false,signalsRequested:0,candidateSha256:sha(Buffer.from(candidate))}));
