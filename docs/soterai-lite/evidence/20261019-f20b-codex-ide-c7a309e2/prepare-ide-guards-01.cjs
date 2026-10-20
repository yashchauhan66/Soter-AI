'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
let source=fs.readFileSync(path.resolve(__dirname,'../20261019-f20-codex-cli-17b8e403/matrix-guards-01.cjs'),'utf8');
const anchor='if(!allowed){records.deniedChildLaunches.push';assert(source.includes(anchor));source=source.replace(anchor,`const ideNative=path.resolve(root,'extensions/openai.chatgpt-26.51007.21434-win32-x64/bin/windows-x86_64/codex.exe');
 if(path.resolve(executable).toLowerCase()===ideNative.toLowerCase()&&!options.shell&&options.env&&path.resolve(options.env.CODEX_HOME||'').toLowerCase()===path.resolve(root,'code-home').toLowerCase()
 &&argv.join('|')==='-c|features.code_mode_host=true|app-server|--analytics-default-enabled'&&children.every(row=>row.role!=='codex-cli'))allowed=true;
`+anchor);fs.writeFileSync(path.join(__dirname,'ide-guards-01.cjs'),source,{flag:'wx'});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');fs.writeFileSync(path.join(__dirname,'ide-feasibility-freeze-01.json'),JSON.stringify({status:'FROZEN_NOT_EXECUTED',driverSha256:sha(fs.readFileSync(path.join(__dirname,'ide-feasibility-01.cjs'))),guardSha256:sha(Buffer.from(source)),scope:'Actual pinned IDE controller/client + native app-server; only exact observed native argv allowed; EOF withdrawal first proved offline; synthetic profile/provider only, no product/physical webview/auth/login claim.'},null,2)+'\n',{flag:'wx'});
