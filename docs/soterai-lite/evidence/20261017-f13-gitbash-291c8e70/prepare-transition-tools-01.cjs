"use strict";
// Author evidence-only F13 -> F14 barriers before the source evidence freeze.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const old=path.resolve(__dirname,'../20261017-f12-cmd-74b6d291');
const names=['f12-transition-lib-01.cjs','prepare-transition-01.cjs','verify-transition-01.cjs','commit-transition-01.ps1'];
for(const name of names){
 let text=fs.readFileSync(path.join(old,name),'utf8').replaceAll('F13','F14').replaceAll('F12','F13').replaceAll('f12','f13');
 if(name==='f12-transition-lib-01.cjs'){
  text=text.replace('assert.equal(acceptance.checks.nativePs51.pass, 19);','assert.equal(acceptance.checks.nativeCmd.pass, 19); assert.equal(acceptance.checks.nativeCmd.distinct, 19); assert.equal(acceptance.checks.nativePs51.pass, 19);');
 }
 if(name==='prepare-transition-01.cjs'){
  text=text.replace("replace('F14-F32 and L2-L7','F14-F32 and L2-L7');","replace('F14-F32 and L2-L7','F15-F32 and L2-L7');");
  text=text.replace("replace('F01-F10 DONE; F11 optional unavailable/unimplemented NOT_TESTED/NOT_COVERED; F13 ACTIVE/test-first','F01-F10 and F13 DONE; F11 optional unavailable/unimplemented NOT_TESTED/NOT_COVERED; F14 ACTIVE/test-first');", "replace('F01-F10 and F12 DONE; F11 optional unavailable/unimplemented NOT_TESTED/NOT_COVERED; F13 ACTIVE/test-first','F01-F10 and F12-F13 DONE; F11 optional unavailable/unimplemented NOT_TESTED/NOT_COVERED; F14 ACTIVE/test-first');");
  text=text.replace("replace('F13 is the sole supported active behavior card; no F13 production before the F11 availability-disposition commit and its byte-verification-01.json PASS.','F13 scoped source bytes are verified. F14 is the sole supported active behavior card; no F14 production before the separate F13 transition commit and f13-transition-byte-verification-01.json PASS.');", "replace('F13 is the sole supported active behavior card; no F13 production before the separate F12 transition commit and f12-transition-byte-verification-01.json PASS.','F14 is the sole supported active behavior card; no F14 production before the separate F13 transition commit and f13-transition-byte-verification-01.json PASS.');");
  text=text.replace('F01-F10 and F13 DONE for exact scoped objects','F01-F10 and F12-F13 DONE for exact scoped objects');
  text=text.replace('Cmd19+affectedPS5119','GitBash19+affectedCmd19+PS5119').replace('Finite declared cmd with private safe-view type/find/set/copy','Finite declared Git Bash with private safe-data file/search/sed/awk/cp/env and shared staged Git backend; affected cmd BOM decoding preserves registered prefixes');
 }
 if(name==='verify-transition-01.cjs')text=text.replace('F01-F10 and F13 DONE;','F01-F10 and F12-F13 DONE;');
 assert.ok(!text.includes('20261017-f12-cmd-74b6d291'));
 fs.writeFileSync(path.join(__dirname,name.replace('f12','f13')),text,{flag:'wx'});
}
console.log(JSON.stringify({status:'AUTHORED_NOT_EXECUTED',files:names.map(n=>n.replace('f12','f13')),next:'F14'}));
