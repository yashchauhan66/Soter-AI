'use strict';
// Execute the real HP01 callback against the retained package metadata.
// VS Code APIs/privateClean are explicit seams; this is not native acceptance.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const test=require('node:test'),ts=require('typescript');
const sourceName=process.env.SOTERAI_F26B_METADATA_SOURCE||'native-prepush-02.host.ts.txt';
assert(['native-prepush-02.host.ts.txt','native-prepush-03.host.ts.txt'].includes(sourceName));
const source=fs.readFileSync(path.join(__dirname,sourceName),'utf8');
const tree=ts.createSourceFile(sourceName+'.ts',source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
let callback;
function visit(node){
 if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='add'&&ts.isStringLiteral(node.arguments[0])&&node.arguments[0].text==='Exact four runtimes/four commands/default-false restricted machine setting are present'){
  assert(!callback);callback=node.arguments[1].getText(tree);
 }
 ts.forEachChild(node,visit);
}
visit(tree);assert(callback);
const emitted=ts.transpileModule('const work = '+callback+'; work;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const original=JSON.parse(fs.readFileSync(path.join(__dirname,'f26b-prepush-native-20261029T163951Z-10b64401/original-manifest.json'),'utf8'));
const commands=['installPrePushGuard','resumePrePushGuard','restorePrePushGuard','prePushGuardStatus'];
async function execute(change=()=>{},options={}){
 const manifest=structuredClone(original);change(manifest);
 const scope={assert,configuration:{inspect:()=>({defaultValue:options.defaultValue??false})},FLAG:'lite.historyHooks.prePush',initialFlag:options.initialFlag,
  vscode:{commands:{getCommands:async()=>options.commands??commands.map(name=>'soterai.'+name)}},COMMANDS:commands,
  nativeRead:async()=>JSON.stringify(manifest),join:path.join,context:{extensionUri:{fsPath:__dirname}},privateClean:()=>{}};
 const work=vm.runInNewContext(emitted,scope,{timeout:1000});await work();
}
test('HP01 accepts the exact packaged false/machine/restricted-list metadata',()=>execute());
test('HP01 rejects a changed declared default',()=>assert.rejects(execute(m=>{m.contributes.configuration.properties['soterai.lite.historyHooks.prePush'].default=true;})));
test('HP01 rejects a workspace-scoped flag',()=>assert.rejects(execute(m=>{m.contributes.configuration.properties['soterai.lite.historyHooks.prePush'].scope='resource';})));
test('HP01 rejects absence from the actual VS Code restricted setting list',()=>assert.rejects(execute(m=>{m.capabilities.untrustedWorkspaces.restrictedConfigurations=m.capabilities.untrustedWorkspaces.restrictedConfigurations.filter(name=>name!=='soterai.lite.historyHooks.prePush');})));
test('HP01 rejects a missing manifest command',()=>assert.rejects(execute(m=>{m.contributes.commands=m.contributes.commands.filter(row=>row.command!=='soterai.restorePrePushGuard');})));
test('HP01 rejects a missing registered command',()=>assert.rejects(execute(()=>{},{commands:commands.slice(1).map(name=>'soterai.'+name)})));
test('HP01 rejects an unexpected enabled initial flag',()=>assert.rejects(execute(()=>{},{initialFlag:true})));
test('HP01 rejects an unexpected API default value',()=>assert.rejects(execute(()=>{},{defaultValue:true})));
