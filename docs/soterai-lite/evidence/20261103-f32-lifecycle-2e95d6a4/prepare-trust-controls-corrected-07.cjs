'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const own=n=>path.join(__dirname,n);let s=fs.readFileSync(own('installed-trust-static-controls-corrected-06.test.cjs'),'utf8');
const before="const enabled = new Function('return function ' + enableSource)();";
assert.equal(s.split(before).length-1,1);
s=s.replace(before,()=>"assert(source.includes('var iEt=\\\"security.workspace.trust.enabled\\\"'));\nconst enabled = new Function('iEt', 'return function ' + enableSource)('security.workspace.trust.enabled');");
fs.writeFileSync(own('installed-trust-static-controls-corrected-07.test.cjs'),s,{flag:'wx'});
