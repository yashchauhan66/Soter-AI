'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const original=fs.readFileSync(path.join(__dirname,'prepare-continuation-02.cjs'),'utf8');
const bad=".includes('renderer process gone (reason: oom')));",good=".includes('renderer process gone (reason: oom'));";
assert.equal(original.split(bad).length,2);const corrected=original.replace(bad,good);new vm.Script(corrected);
const target=path.join(__dirname,'prepare-continuation-03.generated.cjs');fs.writeFileSync(target,corrected,{flag:'wx'});require(target);
