'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),prior=path.resolve(__dirname,'../20261019-f20a-responses-45ae291c');
const read=name=>fs.readFileSync(path.join(prior,name),'utf8'),write=(name,text)=>fs.writeFileSync(path.join(__dirname,name),text,{flag:'wx'});
const oldParent='a138631fb1c10570b478c66b127e7f0e5438c8cf',parent='c0c9dce010c90c0b419c7979d65ace2677c87c8f';
const ownSources=[
 'apps/local-ai-broker/src/CodexResponsesSchema.ts','packages/vscode-extension/src/broker/BrokerManager.ts',
 'packages/vscode-extension/src/adapters/CodexIdeAdapter.ts','packages/vscode-extension/src/adapters/CodexIdeAdapterPolicy.ts',
 'packages/vscode-extension/src/extension.ts','packages/vscode-extension/package.json','packages/soterai-lite/package.json',
 'packages/vscode-extension/README.md','packages/soterai-lite/README.md','docs/vscode-extension-readiness.md','docs/soterai-lite/FEATURE-QUEUE.json',
 'packages/vscode-extension/src/__tests__/codexIdeAdapterPolicy.test.ts','packages/vscode-extension/src/__tests__/codexIdeAdapterRegistration.test.ts',
 'packages/vscode-extension/src/__tests__/codexIdeResponsesOwner.test.ts','packages/vscode-extension/src/__tests__/codexIdeAdapterLifecycle.test.ts',
 'packages/vscode-extension/src/__tests__/codexIdeResponsesSchema.test.ts','packages/vscode-extension/src/__tests__/codexIdeArtifact.test.ts',
 'packages/vscode-extension/src/__tests__/codexIdeRuntimeDrift.review.test.ts','packages/vscode-extension/src/__tests__/codexIdeCapabilityFlags.review.test.ts',
 'packages/vscode-extension/src/__tests__/codexResponsesManager.test.ts',
 'packages/vscode-extension/src/__tests__/fixtures/codex-ide-26.51007.21434-request-1.json',
 'packages/vscode-extension/src/__tests__/fixtures/codex-ide-26.51007.21434-manifest.json',
 'packages/vscode-extension/src/__tests__/fixtures/codex-ide-26.51007.21434-runtime-package.json'
];
let index=read('prepare-index-01.cjs').replaceAll(oldParent,parent).replaceAll('f20a-responses','f20b').replaceAll('F20A scoped native text Responses and safe-reader integration','F20B separately pinned IDE native text Responses and F04 integration');
const start=index.indexOf('const ownSources='),end=index.indexOf('const modified=',start);assert(start>0&&end>start);index=index.slice(0,start)+'const ownSources=new Set('+JSON.stringify(ownSources)+');\n'+index.slice(end);
const focusedStart=index.indexOf('const focused='),focusedEnd=index.indexOf('const hosts=',focusedStart);assert(focusedStart>0&&focusedEnd>focusedStart);
index=index.slice(0,focusedStart)+"// Include every tracked full-suite test/fixture in the byte index, plus the new IDE controls above.\nfor(const name of lines(git('ls-files','--','packages/vscode-extension/src/__tests__')))if(fs.existsSync(inside(repo,name)))names.add(name);\n"+index.slice(focusedEnd);
index=index.replaceAll('20261019-f20-codex-cli-17b8e403','20261019-f20a-responses-45ae291c');
index=index.replace('json|txt|md|ps1|cjs|ts|js','json|txt|md|ps1|cjs|ts|js|log');
write('prepare-index-01.cjs',index);
write('verify-source-01.cjs',read('verify-source-01.cjs').replaceAll('f20a-responses','f20b').replaceAll('F20A-RESPONSES','F20B'));
let close=read('close-source-01.ps1').replaceAll('f20a-responses','f20b').replaceAll('F20A byte barrier','F20B byte barrier');
close=close.replace('feat(lite): route pinned Codex CLI text Responses through owned gateway','feat(lite): add separately pinned Codex IDE safe-read and text gateway');
close=close.replace('docs(lite): verify Codex CLI bytes and activate separate IDE card','docs(lite): verify Codex IDE bytes and activate separate Gemini card');
write('close-source-01.ps1',close);
