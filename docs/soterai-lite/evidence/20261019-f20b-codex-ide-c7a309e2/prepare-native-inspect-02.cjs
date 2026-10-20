'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');let source=fs.readFileSync(path.join(__dirname,'native-inspect-01.cjs'),'utf8').replaceAll('-01','-02').replace('installed-public-inputs-02.json','installed-public-inputs-01.json');
const anchor="const r=await run('bundled-appserver-eof-02',['app-server'],true);";assert(source.includes(anchor));source=source.replace(anchor,"await run('bundled-protocol-02',['app-server','generate-ts','--out',path.join(root,'protocol')]);const r=await run('bundled-appserver-eof-02',['-c','features.code_mode_host=true','app-server','--analytics-default-enabled'],true);");
fs.writeFileSync(path.join(__dirname,'native-inspect-02.cjs'),source,{flag:'wx'});
