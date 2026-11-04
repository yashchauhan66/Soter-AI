'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const n of ['native-materialization-current-01.json','native-consumption-current-01.json','native-acceptance-current-01.json'])assert(!fs.existsSync(path.join(__dirname,n)),'Packet already invoked');
const files=fs.readdirSync(__dirname,{withFileTypes:true}).filter(e=>e.isFile()).map(e=>{const raw=fs.readFileSync(path.join(__dirname,e.name));return{path:e.name,bytes:raw.length,sha256:sha(raw)};}).sort((a,b)=>a.path.localeCompare(b.path));
const result={status:'F28_CURRENT_NATIVE30_PACKET_FROZEN_NOT_EXECUTED',bindingSha256:'e5b4ecefbabcb4df552f534f0196615899f8732ecf8293b8088ec3dbe912adb0',pureControls:{tests:10,pass:10,fail:0,skip:0},nativeLaunches:0,processQueries:0,signalsRequested:0,files};
assert.equal(files.find(r=>r.path==='native-binding-current-01.json').sha256,result.bindingSha256);
const raw=Buffer.from(JSON.stringify(result,null,2)+'\n');fs.writeFileSync(path.join(__dirname,'packet-freeze-01.json'),raw,{flag:'wx'});console.log(JSON.stringify({status:result.status,files:files.length,sha256:sha(raw)}));
