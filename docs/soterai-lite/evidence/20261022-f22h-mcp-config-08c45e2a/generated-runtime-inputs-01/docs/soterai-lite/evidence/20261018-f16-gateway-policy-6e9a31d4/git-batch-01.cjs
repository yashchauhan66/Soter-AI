'use strict';
const cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
exports.createGit=repo=>{
 const cache=new Map(),run=(...args)=>cp.execFileSync('git',['-c','core.autocrlf=false',...args],{cwd:repo,maxBuffer:128*1024*1024,windowsHide:true});
 const git=(...args)=>args.length===2&&args[0]==='show'&&cache.has(args[1])?Buffer.from(cache.get(args[1])):run(...args);
 git.preload=(revision,names)=>{
  assert.ok(revision===''||/^[a-f0-9]{40}$/.test(revision));assert.ok(Array.isArray(names)&&names.length>0);
  const specs=[...new Set(names.map(name=>{assert.equal(typeof name,'string');assert.ok(name&&!/[\x00-\x1f\x7f:]/.test(name)&&!name.startsWith('/')&&!name.includes('\\')&&!name.split('/').includes('..'));return revision+':'+name;}))];
  const raw=cp.execFileSync('git',['-c','core.autocrlf=false','cat-file','--batch'],{cwd:repo,input:specs.join('\n')+'\n',maxBuffer:128*1024*1024,windowsHide:true});let cursor=0;
  for(const spec of specs){const end=raw.indexOf(10,cursor);assert.ok(end>=cursor);const header=/^([a-f0-9]{40}) blob ([0-9]+)$/.exec(raw.subarray(cursor,end).toString('ascii'));assert.ok(header,'Missing/nonblob batch object');const size=Number(header[2]);assert.ok(Number.isSafeInteger(size)&&size>=0);cursor=end+1;assert.ok(cursor+size<raw.length&&raw[cursor+size]===10);const bytes=Buffer.from(raw.subarray(cursor,cursor+size));assert.equal(crypto.createHash('sha1').update('blob '+size+'\0').update(bytes).digest('hex'),header[1]);cache.set(spec,bytes);cursor+=size+1;}
  assert.equal(cursor,raw.length);return specs.length;
 };
 return git;
};
