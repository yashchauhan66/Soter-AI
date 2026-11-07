'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const base=__dirname, manifest=JSON.parse(fs.readFileSync(path.join(base,'file-list.json'),'utf8')), digest=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const r of manifest.files){assert(!path.isAbsolute(r.path)&&!r.path.split('/').some(s=>s==='..'||s==='.'));const f=path.join(base,r.path);let p=f;while(p!==base){const s=fs.lstatSync(p);assert(!s.isSymbolicLink());if(p===f)assert(s.isFile()&&s.nlink===1);p=path.dirname(p);}const b=fs.readFileSync(f);assert.equal(b.length,r.bytes,r.path);assert.equal(digest(b),r.sha256,r.path);}
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.relative(base,path.join(p,e.name)).replaceAll('\\','/')]);
assert.deepEqual(walk(base).sort(),[...manifest.files.map(r=>r.path),'file-list.json'].sort());
console.log(JSON.stringify({status:'PASS_EXACT_PACKET_FILE_BYTES_ONLY',files:manifest.files.length,identity:JSON.parse(fs.readFileSync(path.join(base,'object-identity.json'),'utf8')),nativeTestsRun:0,independentVerdict:'NOT_PROVIDED'}));
