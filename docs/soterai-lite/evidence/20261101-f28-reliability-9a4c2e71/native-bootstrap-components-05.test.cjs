'use strict';const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test'),crypto=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'native-bootstrap-05.cjs'),'utf8'),app='C:\\Users\\USER\\AppData\\Local\\Programs\\Microsoft VS Code\\2c33b50b16\\resources\\app',parent='D:\\SoterAI-Lite-test-profiles\\f28-reliability-native-20261101T000000Z-00000000';
async function fixture(changes={}){
 const root=changes.root??path.join(parent,'workspace'),phase=changes.phase??'primary',profile=changes.profile??path.join(parent,phase==='peer'?'peer-profile':'profile');let activations=0;
 const extension={id:'vscode.json-language-features',extensionUri:{scheme:'file'},extensionPath:path.join(app,'extensions/json-language-features'),packageJSON:{publisher:'vscode',name:'json-language-features',version:'10.0.0',main:'./client/dist/node/jsonClientMain'},isActive:false,activate:async function(){activations++;this.isActive=true;}};
 const vscode={workspace:{workspaceFolders:[{uri:{scheme:'file',fsPath:root}}],isTrusted:changes.trusted??true,getConfiguration:()=>({get:()=>changes.schemaDownload??false})},env:{remoteName:changes.remoteName,appRoot:changes.appRoot??app},extensions:{getExtension:()=>extension},commands:{executeCommand:async()=>{throw Error('No Code/window command allowed in component.');}}};
 const io={...fsp,readFile:async(file,...args)=>{if(String(file).endsWith('.synthetic-lite-f28-host'))return changes.marker??'synthetic-only-v1';const raw=await fsp.readFile(file,...args);return changes.tamper&&String(file).endsWith('jsonClientMain.js')?Buffer.from('tampered synthetic vendor bytes'):raw;},appendFile:async()=>undefined,writeFile:async()=>undefined};
 const exports={},context={exports,require:name=>{if(name==='vscode')return vscode;if(name==='node:fs/promises')return io;if(name==='node:crypto')return crypto;if(name==='node:path')return path;throw Error('No product/driver or process require in component.');},process:{env:{SOTERAI_LITE_F28_PROFILE:profile,SOTERAI_LITE_F28_PHASE:phase,SOTERAI_LITE_F28_EVIDENCE:path.join(parent,'component-only.json')}},Buffer,setTimeout:()=>{throw Error('No activation/run timer in component.');},console:{log:()=>undefined}};
 vm.runInNewContext(source+'\nglobalThis.componentJoin=joinPinnedJsonBuiltin;',context);
 return{join:()=>context.componentJoin(),activations:()=>activations};
}
for(const phase of ['primary','restart','peer'])test('Actual extracted bootstrap accepts exact synthetic '+phase+' profile and pinned local vendor bytes',async()=>{const f=await fixture({phase});await f.join();assert.equal(f.activations(),1);});
for(const [label,changes]of [
 ['wrong fixture prefix',{root:path.join('D:\\SoterAI-Lite-test-profiles\\other-native-20261101T000000Z-00000000','workspace')}],
 ['outside synthetic scope',{root:'C:\\Synthetic-unused-workspace'}],['untrusted',{trusted:false}],['remote',{remoteName:'ssh-remote'}],
 ['wrong main profile',{profile:path.join(parent,'peer-profile')}],['wrong peer profile',{phase:'peer',profile:path.join(parent,'profile')}],
 ['unknown phase',{phase:'unknown'}],['missing marker',{marker:'wrong'}],['schema downloads enabled',{schemaDownload:true}],['wrong app root',{appRoot:'C:\\Synthetic-unowned-vendor'}],['vendor bytes drift',{tamper:true}],
])test('Actual extracted bootstrap refuses '+label+' before vendor activation',async()=>{const f=await fixture(changes);await assert.rejects(f.join());assert.equal(f.activations(),0);});
