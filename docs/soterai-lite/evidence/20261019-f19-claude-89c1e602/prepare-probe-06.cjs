'use strict';
const fs=require('node:fs'),path=require('node:path');
let s=fs.readFileSync(path.join(__dirname,'probe-vendor-05.cjs'),'utf8');
const anchor="'--system-prompt','You are a synthetic local verification agent. Use only the offered fixture tools.',";if(!s.includes(anchor))throw Error('Missing standard-system probe anchor');
s=s.replace(anchor,'').replaceAll('native-tool-schemas-05.json','native-tool-schemas-06.json').replaceAll('native-controls-05.json','native-controls-06.json').replaceAll('vendor-feasibility-05.json','vendor-feasibility-06.json').replaceAll('PASS_SCOPED_DEFAULT_TOOLSET_PUBLIC','PASS_SCOPED_DEFAULT_SYSTEM_AND_TOOLS_PUBLIC');
fs.writeFileSync(path.join(__dirname,'probe-vendor-06.cjs'),s,{flag:'wx'});
