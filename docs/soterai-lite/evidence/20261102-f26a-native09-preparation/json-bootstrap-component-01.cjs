'use strict';
// Execute the exact extracted bootstrap function with an in-memory vscode seam.
// Vendor reads are limited to the four reviewed public builtin inputs; no Code,
// profile, filesystem mutation, child, network or process.env modification.
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test');
const C=require('./native09-current-admission-01.cjs'),{own,repo,read}=C;
const selected=process.argv[2];assert(['original','fixed'].includes(selected));
const text=fs.readFileSync(own(selected==='original'?'native09-current-candidate-01.ps1.txt':'native10-current-candidate-01.ps1.txt'),'utf8');
const begin=text.indexOf('const jsonBuiltinPins = '),end=text.indexOf('exports.activate = async function',begin);assert(begin>0&&end>begin);const extracted=text.slice(begin,end);
const b=read(own('native09-current-binding-01.json')),review=read(path.resolve(repo,b.hostReview.path)),appRoot=path.dirname(review.currentHost.applicationFiles.find(x=>path.basename(x.path)==='package.json').path);
const builtin=path.join(appRoot,'extensions/json-language-features'),root='D:\\SoterAI-Lite-test-profiles\\f26a-precommit-native-20261102T000000Z-0123abcd\\workspace',profile=path.join(path.dirname(root),'profile');
async function invoke(change={}){
 const events=[],writes=[],marker=path.join(root,'.synthetic-lite-f26a-precommit-host');let activations=0;
 const ext={id:'vscode.json-language-features',extensionUri:{scheme:'file'},extensionPath:builtin,packageJSON:{publisher:'vscode',name:'json-language-features',version:'10.0.0',main:'./client/dist/node/jsonClientMain'},isActive:false,async activate(){activations++;if(!change.inactiveAfterActivate)ext.isActive=true;}};
 Object.assign(ext,change.extension||{});
 const allowed=new Set(review.jsonBuiltinPins.map(x=>path.join(builtin,x.relative)));
 const shim={async readFile(p,...args){if(p===marker)return change.marker??'synthetic-only-v1';assert(allowed.has(p),'Only reviewed public vendor bytes may be read');const raw=await fsp.readFile(p,...args);return change.tamperBytes?Buffer.from('changed'):raw;},async lstat(p){assert(allowed.has(p));const s=await fsp.lstat(p);return change.badSize?{size:s.size+1,isFile:()=>true,isSymbolicLink:()=>false}:s;},async realpath(p){assert(p===builtin||allowed.has(p));return fsp.realpath(p);}};
 const vscode={workspace:{workspaceFolders:[{uri:{scheme:'file',fsPath:root}}],isTrusted:!change.untrusted,getConfiguration(){return{get(){return change.schemaDownload??false;}};}},env:{appRoot:change.appRoot??appRoot,remoteName:change.remote},extensions:{getExtension(){return ext;}}};
 const context=vm.createContext({vscode,fs:shim,path,profile:change.profile??profile,evidence:'in-memory-evidence',phase:'primary',same:(a,z)=>typeof a==='string'&&typeof z==='string'&&path.resolve(a).toLowerCase()===path.resolve(z).toLowerCase(),sha:raw=>crypto.createHash('sha256').update(raw).digest('hex'),startup:async s=>events.push(s),writeJson:async(p,value)=>writes.push(value)});
 new vm.Script(extracted+'\nglobalThis.joinFixture=joinPinnedJsonBuiltin;').runInContext(context);
 await context.joinFixture();return{activations,events,writes};
}
test('current reviewed local profile joins exact JSON builtin before driver environment baseline',async()=>{const result=await invoke();assert.equal(result.activations,1);assert.deepEqual(result.events,['json-builtin-activation-start','json-builtin-activation-end']);assert.equal(result.writes.length,1);assert.equal(result.writes[0].schemaDownloadEnabled,false);assert.equal(result.writes[0].processEnvironmentAssignmentsByBootstrap,0);});
test('other app root is refused before vendor activation',()=>assert.rejects(invoke({appRoot:'C:\\synthetic-other-app'}),/Pinned trusted/));
test('untrusted workspace is refused',()=>assert.rejects(invoke({untrusted:true}),/Pinned trusted/));
test('remote context is refused',()=>assert.rejects(invoke({remote:'synthetic-remote'}),/Pinned trusted/));
test('different profile is refused',()=>assert.rejects(invoke({profile:'D:\\synthetic-other-profile'}),/Pinned trusted/));
test('incorrect synthetic marker is refused',()=>assert.rejects(invoke({marker:'incorrect'}),/Synthetic marker/));
test('incorrect builtin identity is refused',()=>assert.rejects(invoke({extension:{id:'other.synthetic'}}),/Exact installed JSON builtin/));
test('changed public vendor bytes are refused',()=>assert.rejects(invoke({tamperBytes:true}),/Pinned vendor JSON input bytes/));
test('changed vendor size is refused',()=>assert.rejects(invoke({badSize:true}),/Pinned vendor JSON input identity/));
test('schema downloads must remain off',()=>assert.rejects(invoke({schemaDownload:true}),/Schema downloads/));
test('uncompleted builtin activation is refused',()=>assert.rejects(invoke({inactiveAfterActivate:true}),/activation\/configuration incomplete/));
