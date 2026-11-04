'use strict';
// Generate a successor of the failed preparation without overwriting evidence.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const file=path.join(__dirname,'prepare-affected-proposed-01.cjs');let text=fs.readFileSync(file,'utf8');
function once(before,after){assert.equal(text.split(before).length,2,'Exactly one original preparation fragment required');text=text.replace(before,()=>after);}
once("const put=(name,value)=>{fs.writeFileSync(own(name),typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value,null,2)+'\\n',{flag:'wx'});return fact(own(name));};", "const put=(name,value)=>{const raw=Buffer.isBuffer(value)?value:Buffer.from(typeof value==='string'?value:JSON.stringify(value,null,2)+'\\n');if(fs.existsSync(own(name))){const s=fs.lstatSync(own(name));assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1);assert(fs.readFileSync(own(name)).equals(raw),'Existing preparation bytes differ: '+name);}else fs.writeFileSync(own(name),raw,{flag:'wx'});return fact(own(name));};");
once("const extraction=own('vsix-extracted-01');assert(!fs.existsSync(extraction));fs.mkdirSync(extraction);", "const extraction=own('vsix-extracted-01');if(fs.existsSync(extraction)){const s=fs.lstatSync(extraction);assert(s.isDirectory()&&!s.isSymbolicLink());}else fs.mkdirSync(extraction);");
once("fs.writeFileSync(output,raw,{flag:'wx'});", "if(fs.existsSync(output)){const s=fs.lstatSync(output);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1);assert(fs.readFileSync(output).equals(raw),'Existing extracted entry changed');}else fs.writeFileSync(output,raw,{flag:'wx'});");
once("oldVendors.forEach(pin);", "for(const row of oldVendors){if(row.path.toLowerCase()==='c:\\\\program files\\\\git\\\\cmd\\\\git.exe'){assert.equal(row.sha256,'da240fe9bc24895b3e04150a4990b8a6ff329ecabcd8f19684c2cc310da5ef3f');row.fileLinkCount=2;}pin(row);}");
fs.writeFileSync(path.join(__dirname,'prepare-affected-proposed-02.cjs'),text,{flag:'wx'});
console.log('Prepared successor02: reuse exact prewritten fixture bytes, specific existing public Git hardlink count2; no host, network or Git invocation.');
