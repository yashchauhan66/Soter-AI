'use strict';
const fs=require('node:fs'),path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const save=(name,text)=>fs.writeFileSync(path.join(__dirname,name),text,{flag:'wx'});
// dependencies() is synchronous. The diagnostic wrapper must preserve its
// return type; awaiting it internally changed the product's call contract.
const probe=read('product-probe-04.cjs').replace("'configuredFiles','dependencies'", "'configuredFiles'");
save('product-probe-05.cjs',probe);
save('run-product-probe-06.ps1',read('run-product-probe-05.ps1').replaceAll('product-probe-04.cjs','product-probe-05.cjs'));
