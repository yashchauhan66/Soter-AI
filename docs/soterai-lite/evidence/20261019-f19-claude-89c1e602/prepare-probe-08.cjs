'use strict';
const fs=require('node:fs'),path=require('node:path');let s=fs.readFileSync(path.join(__dirname,'probe-vendor-06.cjs'),'utf8');
const pairs=[
 ["['provider-public']","['provider-public','read-public','read-private','prompt-outage','read-hook-failure']"],
 ['record.checks.length===1','record.checks.length===5'],
 ['PASS_SCOPED_DEFAULT_SYSTEM_AND_TOOLS_PUBLIC','PASS_SCOPED_DEFAULT_PROFILE_HOOKS'],
 ['native-tool-schemas-06.json','native-tool-schemas-08.json'],['native-controls-06.json','native-controls-08.json'],['vendor-feasibility-06.json','vendor-feasibility-08.json'],
 ['const row={phase:current,event,authenticated,cwdCurrent}','const row={phase:current,event,authenticated,cwdCurrent,fields:Object.keys(frame).sort(),toolName:frame.tool_name,inputFields:frame.tool_input?Object.keys(frame.tool_input).sort():undefined}'],
 ['fields:Object.keys(parsed).sort(),tools:','fields:Object.keys(parsed).sort(),publicHeaders:{beta:req.headers["anthropic-beta"],version:req.headers["anthropic-version"],app:req.headers["x-app"]},tools:']
];for(const[a,b]of pairs){if(!s.includes(a))throw Error('Missing native metadata anchor');s=s.split(a).join(b);}fs.writeFileSync(path.join(__dirname,'probe-vendor-08.cjs'),s,{flag:'wx'});
