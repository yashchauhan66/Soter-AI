'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const file=path.join(__dirname,'prepare-acceptance-tools-01.cjs');
let code=fs.readFileSync(file,'utf8');
assert(code.includes("['earlier failed history18PASS3FAIL','earlier failed artifact20PASS1FAIL']"));
code=code.replace("['earlier failed history18PASS3FAIL','earlier failed artifact20PASS1FAIL']","['Earlier failed history18PASS3FAIL','Earlier failed artifact20PASS1FAIL']");
code=code.replace("const put=(name,text)=>fs.writeFileSync(path.join(__dirname,name),text,{flag:'wx'});","const put=(name,text)=>{const target=path.join(__dirname,name);if(fs.existsSync(target)){assert.equal(fs.readFileSync(target,'utf8'),text,'Retained partial output bytes');return;}fs.writeFileSync(target,text,{flag:'wx'});};");
const Module=require('node:module');const taskModule=new Module(path.join(__dirname,'acceptance-tools-fixed-preparation-02.cjs'),module);taskModule.filename=path.join(__dirname,'acceptance-tools-fixed-preparation-02.cjs');taskModule.paths=module.paths;taskModule._compile(code,taskModule.filename);
