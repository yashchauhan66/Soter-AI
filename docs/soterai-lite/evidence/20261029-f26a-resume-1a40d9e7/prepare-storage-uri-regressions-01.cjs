const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),own=n=>path.join(__dirname,n),repo=path.resolve(__dirname,'../../../..');
let source=fs.readFileSync(own('first-install-component-01.test.ts'),'utf8');
source=source.replaceAll('../../../../packages/vscode-extension/src/__tests__/phase2/','./phase2/').replaceAll('../../../../packages/vscode-extension/src/history-hooks/','../history-hooks/');
const replace=(before,after)=>{assert.equal(source.split(before).length,2);source=source.replace(before,after);};
replace('for (const present of [false, true]) test(`first install with storage directory ${present ? "present" : "absent"}`, { skip: process.platform !== "win32" }, async t => {',`const cases: Array<{name:string;present?:boolean;scheme?:string;field?:"authority"|"query"|"fragment";remote?:boolean;inside?:boolean;mismatch?:boolean;allowed:boolean}> = [
    {name:"file storage absent",allowed:true}, {name:"file storage present",present:true,allowed:true},
    {name:"local desktop userdata storage absent",scheme:"vscode-userdata",allowed:true},
    {name:"local desktop userdata storage present",scheme:"vscode-userdata",present:true,allowed:true},
    {name:"unknown storage scheme refuses",scheme:"test-unsupported",allowed:false},
    {name:"userdata authority refuses",scheme:"vscode-userdata",field:"authority",allowed:false},
    {name:"userdata query refuses",scheme:"vscode-userdata",field:"query",allowed:false},
    {name:"userdata fragment refuses",scheme:"vscode-userdata",field:"fragment",allowed:false},
    {name:"remote desktop userdata refuses",scheme:"vscode-userdata",remote:true,allowed:false},
    {name:"workspace-contained storage refuses",scheme:"vscode-userdata",inside:true,allowed:false},
    {name:"noncanonical file URI path refuses",mismatch:true,allowed:false},
];
for (const setting of cases) test("F26a checked storage URI: " + setting.name, { skip: process.platform !== "win32" }, async t => {
    const present=setting.present;`);
replace('Object.defineProperty(stub.env,"remoteName",{configurable:true,value:undefined});','Object.defineProperty(stub.env,"remoteName",{configurable:true,value:setting.remote?"ssh-remote":undefined});');
replace('const context = stub.makeExtensionContext(profile);',`const context = stub.makeExtensionContext(profile);
    let storage=setting.inside?stub.Uri.file(join(root,"managed-storage")):context.globalStorageUri;
    storage=storage.with({scheme:setting.scheme??"file"});
    if(setting.field)Object.defineProperty(storage,setting.field,{value:"TEST_ONLY_URI_COMPONENT",configurable:true});
    if(setting.mismatch)Object.defineProperty(storage,"fsPath",{value:context.globalStorageUri.fsPath,configurable:true});
    if(setting.mismatch)Object.defineProperty(storage,"path",{value:"/X:/TEST_ONLY_NONCANONICAL_STORAGE",configurable:true});
    Object.defineProperty(context,"globalStorageUri",{value:storage,configurable:true});`);
replace('const outcome=await controller.install();',`const outcome=await controller.install();
    if(!setting.allowed){
        assert.equal(outcome.status,"UNAVAILABLE");assert.equal(controller.current(outcome),false);assert.equal(backup.size,0);assert.equal(state.bytes,undefined);
        assert(services.every(s=>!s.available));
        await assert.rejects(lstat(join(context.globalStorageUri.fsPath,"pre-commit")),{code:"ENOENT"});return;
    }`);
source=source.replace('Diagnostic component: unchanged production controller','Storage URI regression: actual production controller').replace('No Code launch, Git child, normal profile or native retry.','No Code launch, Git child, normal profile or native retry. Real crypto, transaction, descriptor files and owned loopback service execute; other capabilities are explicit component seams.');
const target=path.join(repo,'packages/vscode-extension/src/__tests__/preCommitStorageUri.review.test.ts');assert(!fs.existsSync(target));
const before=own('storage-uri-before-01');assert(!fs.existsSync(before));fs.mkdirSync(before);
fs.copyFileSync(path.join(repo,'packages/vscode-extension/src/history-hooks/PreCommitController.ts'),path.join(before,'PreCommitController.ts'),fs.constants.COPYFILE_EXCL);
fs.writeFileSync(target,source,{flag:'wx'});console.log('Eleven storage URI regression cases authored before production change; original controller bytes retained.');
