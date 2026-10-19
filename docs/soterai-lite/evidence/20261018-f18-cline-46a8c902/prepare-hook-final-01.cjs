'use strict';
const fs=require('node:fs'),path=require('node:path');
const s=fs.readFileSync(path.join(__dirname,'test-generated-hook-03.ts'),'utf8').replace('vsix-inspection-03.json','vsix-inspection-08.json');
fs.writeFileSync(path.join(__dirname,'test-generated-hook-04.ts'),s,{flag:'wx'});
