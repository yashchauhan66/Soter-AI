const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const old=fs.readFileSync(path.join(__dirname,'prepare-installed-admission-01.cjs'),'utf8');
// The complete exact current vendor snippet was already verified immediately
// before this redundant token. Minifier emits a literal TAB, not backslash+t.
const token="'JSON.stringify(s,null,\"\\\\t\")',";
assert.equal(old.split(token).length,2);
const next=old.replace(token,'');
assert.equal(next.replace("'installedTimestamp:Date.now(),targetPlatform:e.targetPlatform',", "'installedTimestamp:Date.now(),targetPlatform:e.targetPlatform',"+token),old);
fs.writeFileSync(path.join(__dirname,'prepare-installed-admission-02.cjs'),next,{flag:'wx'});
console.log('One redundant escaped-TAB witness removed; preceding exact full snippet and hash checks unchanged. No admission/native executed.');
