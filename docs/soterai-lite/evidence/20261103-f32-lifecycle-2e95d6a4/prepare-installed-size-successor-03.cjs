const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let text=fs.readFileSync(path.join(__dirname,'prepare-installed-size-successor-02.cjs'),'utf8');
const start=text.indexOf('change("\'vendor-installed-size-qualification-01.json\'"'),end=text.indexOf('fs.writeFileSync(',start);assert(start>0&&end>start);
text=text.slice(0,start)+`assert.equal(text.split('vendor-installed-size-qualification-01.json').length,3);text=text.replaceAll('vendor-installed-size-qualification-01.json','vendor-installed-size-qualification-02.json');\n`+text.slice(end);
fs.writeFileSync(path.join(__dirname,'prepare-installed-size-successor-corrected-03.cjs'),text,{flag:'wx'});
