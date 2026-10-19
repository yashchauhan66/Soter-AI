'use strict';
const fs=require('node:fs'),path=require('node:path');
let s=fs.readFileSync(path.join(__dirname,'probe-vendor-03.cjs'),'utf8').replaceAll('native-tool-schemas-02.json','native-tool-schemas-04.json').replaceAll('native-tool-schemas-03.json','native-tool-schemas-04.json').replaceAll('native-controls-03.json','native-controls-04.json').replaceAll('vendor-feasibility-03.json','vendor-feasibility-04.json');
s=s.replace("}catch{record.providerFailure=true;","}catch(error){record.providerFailure=true;record.providerFailureKind={name:error.name,code:error.code};");
fs.writeFileSync(path.join(__dirname,'probe-vendor-04.cjs'),s,{flag:'wx'});
