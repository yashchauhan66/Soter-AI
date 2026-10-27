const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let text=fs.readFileSync(path.join(__dirname,'adapt-native-journal-04.cjs'),'utf8');
text=text.replace("fs.writeFileSync(path.join(__dirname,'litePSReadLineHistory-host-before-journal04.ts.txt'),before,{flag:'wx'});","assert(before.equals(fs.readFileSync(path.join(__dirname,'litePSReadLineHistory-host-before-journal04.ts.txt'))));");
const start=text.indexOf("next=next.replace('    const update ="),end=text.indexOf("assert(!/\\bSTATE",start);assert(start>=0&&end>start);
text=text.slice(0,start)+`next=next.replace(/    const update = context\\.globalState\\.update;\\r?\\n    patch\\(context\\.globalState, "update",[^\\n]+\\r?\\n/,'');\n`+text.slice(end);
fs.writeFileSync(path.join(__dirname,'adapt-native-journal-04b.cjs'),text,{flag:'wx'});
