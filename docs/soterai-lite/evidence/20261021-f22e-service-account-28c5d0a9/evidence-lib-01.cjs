'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),base=path.relative(repo,__dirname).replaceAll('\\','/');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),bytes=f=>fs.readFileSync(f),hash=f=>sha(bytes(f));
const read=f=>JSON.parse(bytes(f).toString('utf8').replace(/^\uFEFF/,''));
function inside(root,name){const file=path.resolve(root,name),rel=path.relative(root,file);assert.ok(rel&&!rel.startsWith('..')&&!path.isAbsolute(rel));return file;}
const own=name=>inside(__dirname,name),relative=f=>path.relative(repo,f).replaceAll('\\','/');
const fact=file=>{const stat=fs.lstatSync(file);assert.ok(stat.isFile()&&!stat.isSymbolicLink());return {path:relative(file),bytes:stat.size,sha256:hash(file)};};
const write=(name,value)=>fs.writeFileSync(own(name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const git=require('../20261018-f16-gateway-policy-6e9a31d4/git-batch-01.cjs').createGit(repo),lines=b=>b.toString('utf8').trim().split(/\r?\n/).filter(Boolean);
function current(entry){const file=inside(repo,entry.path);assert.equal(hash(file),entry.sha256,entry.path);assert.equal(fs.statSync(file).size,entry.bytes,entry.path);}
function receipt(name){const file=own(name),r=read(file+'.result.json');assert.equal(r.exitCode,0,name);assert.equal(r.sha256.toLowerCase(),hash(file),name);assert.equal(path.resolve(repo,r.output),file);return {...r,log:fact(file),receipt:fact(file+'.result.json')};}
function tap(name){const text=bytes(own(name)).toString('utf8'),counts={};for(const key of ['tests','pass','fail','skipped','cancelled','todo']){const m=[...text.matchAll(new RegExp('^# '+key+' (\\d+)\\r?$','gm'))];assert.equal(m.length,1,name+key);counts[key]=Number(m[0][1]);}assert.equal(counts.fail,0);assert.equal(counts.cancelled,0);assert.equal(counts.todo,0);assert.equal(counts.tests,counts.pass+counts.skipped);return counts;}
module.exports={fs,path,assert,repo,base,sha,bytes,hash,read,inside,own,relative,fact,write,git,lines,current,receipt,tap};
