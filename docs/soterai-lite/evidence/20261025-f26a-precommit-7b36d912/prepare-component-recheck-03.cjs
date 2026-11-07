'use strict';
const fs=require('node:fs'),path=require('node:path');
const text=fs.readFileSync(path.join(__dirname,'run-component-gates-02.ps1'),'utf8').replaceAll('compiler-02.txt','compiler-03.txt').replaceAll('components-combined-02.txt','components-combined-03.txt');
fs.writeFileSync(path.join(__dirname,'run-component-gates-03.ps1'),text,{flag:'wx'});
console.log('New compiler03/combined03 retained names; compiler02 remains FAIL, combined02 NOT_RUN. Only descriptor typing and expected-environment annotation changed.');
