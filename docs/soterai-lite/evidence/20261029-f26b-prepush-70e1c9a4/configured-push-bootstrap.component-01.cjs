'use strict';
// Extract the actual prepared bootstrap function; fake VS Code/marker only. No process or push.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict'),test=require('node:test'),ts=require('typescript');
const selected=process.argv[2];assert(selected&&/^configured-push-launch-candidate-0[34][.]ps1[.]txt$/.test(selected));
const raw=fs.readFileSync(path.join(__dirname,selected),'utf8'),start=raw.indexOf("$taskBootstrap=@'\n")>=0?"$taskBootstrap=@'\n":"$taskBootstrap=@'\r\n",offset=raw.indexOf(start);assert(offset>=0);
const body=raw.slice(offset+start.length,raw.indexOf("\n'@",offset)).replace(/\r$/,'');
const tree=ts.createSourceFile('bootstrap.cjs',body,ts.ScriptTarget.ES2022,true,ts.ScriptKind.JS),fn=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='joinPinnedJsonBuiltin');assert(fn);
function initial(name){for(const s of tree.statements){if(!ts.isVariableStatement(s))continue;for(const d of s.declarationList.declarations)if(d.name.getText(tree)===name)return vm.runInNewContext(d.initializer.getText(tree));}throw Error('Missing fixture constant.');}
const pins=initial('jsonBuiltinPins'),appRoot=initial('jsonBuiltinAppRoot'),root='D:\\SoterAI-Lite-test-profiles\\f26b-configured-push-20261101T081622Z-c6f6d008\\workspace',sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function execute(options={}){
 const selectedRoot=options.root??root,profile=options.profile??path.join(path.dirname(selectedRoot),'profile'),vendor=path.join(appRoot,'extensions','json-language-features');let activated=0,reads=0;const stages=[],writes=[];
 const extension={id:'vscode.json-language-features',extensionUri:{scheme:'file'},extensionPath:vendor,packageJSON:{publisher:'vscode',name:'json-language-features',version:'10.0.0',main:'./client/dist/node/jsonClientMain'},isActive:false,async activate(){activated++;this.isActive=true;}};
 const scope={path,Error,profile,phase:'primary',evidence:'TEST_ONLY_SYNTHETIC_RESULT',sha,same:(a,b)=>typeof a==='string'&&typeof b==='string'&&path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase(),jsonBuiltinPins:pins,jsonBuiltinAppRoot:appRoot,
  vscode:{workspace:{workspaceFolders:options.multiple?[{uri:{scheme:'file',fsPath:selectedRoot}},{uri:{scheme:'file',fsPath:selectedRoot+'2'}}]:[{uri:{scheme:'file',fsPath:selectedRoot}}],isTrusted:!options.untrusted,getConfiguration:()=>({get:()=>!!options.download})},env:{remoteName:options.remote?'TEST_ONLY_REMOTE':undefined,appRoot},extensions:{getExtension:()=>extension}},
  fs:{async readFile(file,encoding){reads++;if(file===path.join(selectedRoot,'.synthetic-lite-f26b-prepush-host'))return options.marker??'synthetic-only-v1';const bytes=await fs.promises.readFile(file);return options.badVendor?Buffer.concat([bytes,Buffer.from('changed')]):bytes;},lstat:file=>fs.promises.lstat(file),realpath:file=>fs.promises.realpath(file)},startup:async stage=>stages.push(stage),writeJson:async(file,value)=>writes.push({file,value})};
 const call=vm.runInNewContext(fn.getText(tree)+'\njoinPinnedJsonBuiltin;',scope,{timeout:1000});await call();return{activated,reads,stages,writes};
}
test('actual bootstrap admits only current configured-push profile and joins pinned JSON builtin',async()=>{const result=await execute();assert.equal(result.activated,1);assert.equal(result.reads,5);assert.deepEqual(result.stages,['json-builtin-activation-start','json-builtin-activation-end']);assert.equal(result.writes.length,1);assert.equal(result.writes[0].value.files.length,4);});
test('actual configured-push bootstrap rejects old component profile prefix',async()=>{await assert.rejects(execute({root:root.replace('f26b-configured-push','f26b-prepush-native')}));});
test('actual bootstrap rejects another drive',async()=>{await assert.rejects(execute({root:root.replace(/^D:/,'C:')}));});
test('actual bootstrap rejects wrong profile sibling',async()=>{await assert.rejects(execute({profile:path.join(path.dirname(root),'unrelated')}));});
test('actual bootstrap rejects untrusted workspace',async()=>{await assert.rejects(execute({untrusted:true}));});
test('actual bootstrap rejects remote workspace',async()=>{await assert.rejects(execute({remote:true}));});
test('actual bootstrap rejects multiple workspace folders',async()=>{await assert.rejects(execute({multiple:true}));});
test('actual bootstrap rejects wrong synthetic marker',async()=>{await assert.rejects(execute({marker:'wrong'}));});
test('actual bootstrap rejects schema downloads',async()=>{await assert.rejects(execute({download:true}));});
test('actual bootstrap rejects changed vendor input bytes',async()=>{await assert.rejects(execute({badVendor:true}));});
test('actual success receipt grants no environment assignment or child EOF claim',async()=>{const result=await execute(),value=result.writes[0].value;assert.equal(value.schemaDownloadEnabled,false);assert.equal(value.processEnvironmentAssignmentsByBootstrap,0);assert.equal(value.signalsRequested,0);assert.equal(value.vendorLanguageServer,'STARTUP_CHILD_OUTSIDE_OWNER_GIT_WITNESSES_NO_STREAM_OR_EOF_CLAIM');});
