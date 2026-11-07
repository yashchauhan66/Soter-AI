const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),src=path.join(repo,'packages/vscode-extension/src');
const bytes=fs.readFileSync(path.join(src,'__tests__/preCommitHookText.test.ts'));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
if(fs.existsSync(path.join(src,'history-hooks/PreCommitHookText.ts')))throw Error('Launcher already implemented before baseline');
fs.writeFileSync(path.join(__dirname,'preCommitHookText.pre-production-01.test.ts'),bytes,{flag:'wx'});
fs.writeFileSync(path.join(__dirname,'pre-commit-hook-text-freeze-01.json'),JSON.stringify({time:new Date().toISOString(),status:'FROZEN_BEFORE_PRODUCTION_NOT_EXECUTED',tests:12,path:'packages/vscode-extension/src/__tests__/preCommitHookText.test.ts',bytes:bytes.length,sha256:sha(bytes),contract:'parseHookClientPin(rawBuffer) strict canonical public Ed25519/root/generation/artifact/path metadata; buildPreCommitHookText(originalBuffer|undefined,pinBuffer) fixed absolute env.exe -i before pinned Electron Node; original LF /bin/sh body/arguments/exit preserved exactly after inserted prefix; no shell execution in these fixtures.'},null,2)+'\n',{flag:'wx'});
for(const name of ['PreCommitProtocol','PreCommitScan','PreCommitGitProcess','CheckedHookIndex'])fs.writeFileSync(path.join(__dirname,name+'.before-next-components-01.ts'),fs.readFileSync(path.join(src,'history-hooks',name+'.ts')),{flag:'wx'});
console.log(JSON.stringify({launcherTests:12,sha256:sha(bytes)}));
