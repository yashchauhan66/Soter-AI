'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const prior=path.resolve(__dirname,'../20261019-f19-claude-89c1e602');
function create(name,value){fs.writeFileSync(path.join(__dirname,name),value,{flag:'wx'});}
function template(name){return fs.readFileSync(path.join(prior,name),'utf8');}
function replace(value,from,to){assert(value.includes(from),'Missing template anchor: '+from);return value.replace(from,to);}
create('evidence-lib-01.cjs',template('evidence-lib-01.cjs'));
let source=template('verify-source-02.cjs').replaceAll('f19-','f20a-mcp-').replaceAll("feature:'F19'","feature:'F20A-MCP'");
create('verify-component-source-01.cjs',source);
let index=template('prepare-index-06.cjs');
index=replace(index,"const parent='c6c78c9d71fdb09cc0790faa4671999f4a911c4b'","const parent='6e98442f025c3a839428f4eafff23c3e8e4f3086'");
index=replace(index,"const ownSources=new Set(read(path.join(__dirname,'implementation-progress-03.json')).sources.map(row=>row.path));",`const ownSources=new Set([
 'packages/vscode-extension/src/extension.ts',
 'packages/vscode-extension/src/adapters/CodexCliAdapter.ts',
 'packages/vscode-extension/src/adapters/CodexCliAdapterPolicy.ts',
 'packages/vscode-extension/src/adapters/CodexHttpBridge.ts',
 ...['codexCliAdapterPolicy','codexHttpBridge','codexHttpReadiness.review','codexCliAdapterLifecycle','codexCliAdapterRegistration','codexCliOwnerRecovery.review','codexNativeMetadata.review','codexStorageUri.review','codexDeleteOwnership.review'].map(n=>'packages/vscode-extension/src/__tests__/'+n+'.test.ts'),
 'packages/vscode-extension/package.json','packages/soterai-lite/package.json',
 'packages/vscode-extension/README.md','packages/soterai-lite/README.md',
 'docs/vscode-extension-readiness.md','docs/soterai-lite/FEATURE-QUEUE.json'
]);`);
index=index.split(/\r?\n/).filter(line=>!line.startsWith("for(const name of ['packages/vscode-extension/src/__tests__/gatewayPolicyManager")&&!line.startsWith("for(const name of ['packages/vscode-extension/src/__tests__/fixtures/claude-")&&!line.startsWith('fs.appendFileSync(')).join('\n');
index=replace(index,"assert(/\\/(?:Claude|claude)[^/]*\\.(?:ts|test\\.ts)$/.test(name)||/\\/fixtures\\/claude-(?:tools|protocol)-2\\.1\\.301-01\\.json$/.test(name)","assert(ownSources.has(name)");
index=replace(index,"const previous='docs/soterai-lite/evidence/20261018-f18-cline-46a8c902'","const previous='docs/soterai-lite/evidence/20261019-f19-claude-89c1e602'");
index=index.replaceAll('generated-runtime-inputs-04','generated-runtime-inputs-01').replaceAll('focused-02','focused-04').replaceAll('f19-','f20a-mcp-');
index=replace(index,"scope:'F19 exact pinned Claude native CLI/editor owner adapter, every packaged runtime input, affected tests/fixtures/docs and retained failures/successes; unrelated changes excluded.'","scope:'F20A restricted safe-reader component checkpoint only. F20/F20A remain ACTIVE for Responses integration; all runtime input bytes, tests, fixtures, docs and retained failures included; unrelated changes excluded.'");
create('prepare-component-index-01.cjs',index);
console.log(JSON.stringify({status:'PASS_PREPARED_HELPERS',files:3}));
