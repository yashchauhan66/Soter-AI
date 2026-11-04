'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const own=n=>path.join(__dirname,n);let s=fs.readFileSync(own('installed-trust-static-controls-proposed-05.test.cjs'),'utf8');
function replace(before,after){assert.equal(s.split(before).length-1,1);s=s.replace(before,()=>after)}
replace('function exactSlice(start, end) {','function exactSlice(start, end, expectedOccurrences=1) {');
replace("assert.equal(source.indexOf(start, from + start.length), -1);","assert.equal(source.split(start).length-1, expectedOccurrences);");
replace("'async confirm(e){');","'async confirm(e){',2);");
fs.writeFileSync(own('installed-trust-static-controls-corrected-06.test.cjs'),s,{flag:'wx'});
