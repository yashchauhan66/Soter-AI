'use strict';
// Fixture admission only. Retain every exact-byte/stat/path/link guard while
// bounding the verification buffer. Inventory callers never consume raw bytes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {root,inside,ordinaryFile}=require('./accessibility-binding-01.cjs');
function verifyStreamedPin(row,options={}){
 assert(row&&typeof row.path==='string'&&Number.isSafeInteger(row.bytes)&&row.bytes>=0&&/^[a-f0-9]{64}$/.test(row.sha256),'Exact file pin required.');
 const filename=path.isAbsolute(row.path)?path.resolve(row.path):path.resolve(root,row.path);if(!path.isAbsolute(row.path))assert(inside(root,filename),'Relative input escapes workspace.');
 const before=ordinaryFile(filename,options.maximum,options.singleLink!==false);assert.equal(before.size,row.bytes);
 const same=s=>{for(const k of ['ino','dev','size','mtimeMs','ctimeMs','nlink'])assert.equal(s[k],before[k],'File changed during streamed pin: '+k);assert(s.isFile()&&!s.isSymbolicLink());};
 const fd=fs.openSync(filename,'r'),hash=crypto.createHash('sha256'),buffer=Buffer.allocUnsafe(Math.min(65536,row.bytes+1));let count=0;
 try{const opened=fs.fstatSync(fd);for(const k of ['ino','size','mtimeMs','ctimeMs','nlink'])assert.equal(opened[k],before[k],'Opened descriptor differs: '+k);assert(opened.isFile());for(;;){const n=fs.readSync(fd,buffer,0,Math.min(buffer.length,row.bytes+1-count),null);if(n===0)break;count+=n;assert(count<=row.bytes,'File grew beyond exact pin.');hash.update(buffer.subarray(0,n));}const ended=fs.fstatSync(fd);for(const k of ['ino','dev','size','mtimeMs','ctimeMs','nlink'])assert.equal(ended[k],opened[k],'Descriptor changed: '+k);}finally{fs.closeSync(fd);}
 same(ordinaryFile(filename,options.maximum,options.singleLink!==false));assert.equal(count,row.bytes);assert.equal(hash.digest('hex'),row.sha256,'Exact file hash differs.');
 return{filename,bytes:count,sha256:row.sha256,maximumReadBuffer:buffer.length};
}
module.exports={verifyStreamedPin};
