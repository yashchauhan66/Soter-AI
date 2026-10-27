// Read-only local installed-source inspection; never loads a native addon.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const app='C:\\Users\\USER\\AppData\\Local\\Programs\\Microsoft VS Code\\e646868227\\resources\\app';
const archive=path.join(app,'node_modules.asar'),fd=fs.openSync(archive,'r'),prefix=Buffer.alloc(16);fs.readSync(fd,prefix,0,16,0);
const length=prefix.readUInt32LE(12);assert(length<16*1024*1024);const bytes=Buffer.alloc(length);fs.readSync(fd,bytes,0,length,16);
const header=JSON.parse(bytes.toString()),base=8+prefix.readUInt32LE(4),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const names=['package.json','lib/windowsTerminal.js','lib/windowsPtyAgent.js','lib/terminal.js'];const facts=[];
for(const name of names){let item=header;for(const part of ('node-pty/'+name).split('/'))item=item.files[part];assert(item.size<262144);
 let raw;if(item.unpacked)raw=fs.readFileSync(path.join(app,'node_modules.asar.unpacked','node-pty',name));else{raw=Buffer.alloc(item.size);assert.equal(fs.readSync(fd,raw,0,item.size,base+Number(item.offset)),item.size);}
 const destination=path.join(__dirname,'installed-node-pty-'+name.replaceAll('/','-')+'.txt');fs.writeFileSync(destination,raw,{flag:'wx'});facts.push({path:'node-pty/'+name,bytes:raw.length,sha256:sha(raw)});
}
fs.closeSync(fd);fs.writeFileSync(path.join(__dirname,'installed-pty-source-01.json'),JSON.stringify({status:'STATIC_ONLY_NATIVE_NOT_LOADED',facts},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(facts));
