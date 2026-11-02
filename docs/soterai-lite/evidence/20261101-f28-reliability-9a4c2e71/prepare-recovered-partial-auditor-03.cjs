'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const own=n=>path.join(__dirname,n);let s=fs.readFileSync(own('audit-affected-partial-02.cjs'),'utf8');
function replace(a,b){assert(s.includes(a),a);s=s.replaceAll(a,b);}
replace("require('./affected-current-admission-02.cjs')","require('./current-recovered-text-01.cjs')");replace("const receipt=read(own(name+'.txt.result.json'));","const canonicalFile=C.canonicalFile(name);const receipt=read(own(name+'.txt.result.json'));");replace("sha(fs.readFileSync(own(name+'.txt')))","sha(fs.readFileSync(canonicalFile))");replace("take(own(name+'.txt'));","take(canonicalFile);");
fs.writeFileSync(own('audit-affected-partial-03.cjs'),s,{flag:'wx'});console.log('Prepared exact-hash recovery-aware partial auditor; no native execution.');
