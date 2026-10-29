'use strict';
// Actual HP03 callback, explicit API seams; not a real editor or owner acceptance.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test'),ts=require('typescript');
const input=process.env.SOTERAI_F26B_WORKSPACE_SOURCE||'native-prepush-03.host.ts.txt';assert(['native-prepush-03.host.ts.txt','native-prepush-04.host.ts.txt'].includes(input));
const text=fs.readFileSync(path.join(__dirname,input),'utf8'),tree=ts.createSourceFile(input+'.ts',text,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
let callback;function visit(node){if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='add'&&ts.isStringLiteral(node.arguments[0])&&node.arguments[0].text==='Workspace setting cannot enable the machine owner route'){assert(!callback);callback=node.arguments[1].getText(tree);}ts.forEachChild(node,visit);}visit(tree);assert(callback);
const emitted=ts.transpileModule('const work='+callback+';work;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const nls=JSON.parse(fs.readFileSync('C:/Users/USER/AppData/Local/Programs/Microsoft VS Code/2c33b50b16/resources/app/out/nls.messages.json','utf8'));
assert.equal(nls[29530],'Unable to write {0} to Workspace Settings. This setting can be written only into User settings.');
async function execute(options={}){
 let calls=0;const expectedKey='soterai.lite.historyHooks.prePush';
 const refusal=Object.assign(new Error(options.message??nls[29530].replace('{0}',expectedKey)),{name:options.errorName??'CodeExpectedError'});
 const scope={assert,Error,FLAG:'lite.historyHooks.prePush',vscode:{ConfigurationTarget:{Workspace:2}},configuration:{
  update:async(key,value,target)=>{assert.equal(key,'lite.historyHooks.prePush');assert.equal(value,true);assert.equal(target,2);if(!options.updateResolves)throw refusal;},
  get:()=>options.flag??false,inspect:()=>({workspaceValue:options.workspaceValue})},idle:async()=>{},call:async name=>{assert.equal(name,'installPrePushGuard');calls++;return{status:options.ownerStatus??'UNAVAILABLE'};}};
 const work=vm.runInNewContext(emitted,scope,{timeout:1000});await work();assert.equal(calls,1);
}
test('HP03 accepts the installed-host-specific denied workspace write and verifies owner remains disabled',()=>execute());
test('HP03 rejects an unrelated generic API error',()=>assert.rejects(execute({errorName:'Error'})));
test('HP03 rejects a refusal for a different setting',()=>assert.rejects(execute({message:nls[29530].replace('{0}','some.other.setting')})));
test('HP03 rejects an unrelated CodeExpectedError message',()=>assert.rejects(execute({message:'Synthetic unrelated API failure'})));
test('HP03 rejects an unexpectedly successful workspace write',()=>assert.rejects(execute({updateResolves:true})));
test('HP03 rejects an enabled effective flag',()=>assert.rejects(execute({flag:true})));
test('HP03 rejects a retained workspace value',()=>assert.rejects(execute({workspaceValue:true})));
test('HP03 rejects an unexpectedly live owner result',()=>assert.rejects(execute({ownerStatus:'LIVE'})));
