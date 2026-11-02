'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const own=n=>path.join(__dirname,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),put=(n,v)=>fs.writeFileSync(own(n),typeof v==='string'?v:JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const s=fs.readFileSync(own('native-reliability-04.host.ts.txt'),'utf8'),prior=JSON.parse(fs.readFileSync(own('native-case-freeze-04.json'),'utf8')),count=6;
function successor(from,to,replacements){let value=fs.readFileSync(own(from),'utf8');for(const [a,b]of replacements){assert(value.includes(a),a);value=value.replaceAll(a,b);}put(to,value);}
successor('native-lifecycle-components-02.test.cjs','native-lifecycle-components-04.test.cjs',[['native-reliability-02','native-reliability-04']]);
const script=fs.readFileSync(own('prepare-workspace-events-04.cjs'),'utf8'),start=script.indexOf("successor('current-native-admission-04.cjs'");assert(start>0);eval(script.slice(start));
