'use strict';
const fs=require('node:fs'),path=require('node:path');
let s=fs.readFileSync(path.join(__dirname,'probe-vendor-04.cjs'),'utf8');
const pairs=[
 ["permissions:{allow:['Read']}","alwaysThinkingEnabled:false,permissions:{defaultMode:'default',allow:['Read']}"],
 ["const settingsPath=path.join(profile,'settings.json')","const settingsPath=path.join(profile,'claude/settings.json')"],
 ["'--tools',name==='provider-public'?'':'Read','--settings',settingsPath",""],
 ["['provider-public','read-public','read-private','prompt-outage','read-hook-failure']","['provider-public']"],
 ['record.checks.length===5','record.checks.length===1'],
 ['PASS_SCOPED_VENDOR_FEASIBILITY','PASS_SCOPED_DEFAULT_TOOLSET_PUBLIC'],
 ['native-tool-schemas-04.json','native-tool-schemas-05.json'],
 ['native-controls-04.json','native-controls-05.json'],
 ['vendor-feasibility-04.json','vendor-feasibility-05.json'],
 ['fresh user setting source plus explicit private settings','fresh automatic user settings; manual permissions and ordinary default toolset']
];for(const[a,b]of pairs){if(!s.includes(a))throw Error('Missing unique probe anchor: '+a);s=s.split(a).join(b);}
fs.writeFileSync(path.join(__dirname,'probe-vendor-05.cjs'),s,{flag:'wx'});
