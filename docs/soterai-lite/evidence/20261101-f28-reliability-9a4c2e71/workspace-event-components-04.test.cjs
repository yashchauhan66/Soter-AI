'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'native-reliability-04.host.ts.txt'),'utf8'),ast=ts.createSourceFile('fixture.ts',source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
function extract(name){const node=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert(node);return node.getText(ast);}
function fixture(mode='ok'){
 let listener,disposed=0,confirmed=false;const uri={toString:()=> 'file:///synthetic-second'};
 const workspace={workspaceFolders:[{}],onDidChangeWorkspaceFolders(fn){listener=fn;return{dispose(){disposed++;}};},updateWorkspaceFolders(){if(mode==='refused')return false;workspace.workspaceFolders=[{},{}];if(mode==='ok')setImmediate(()=>{confirmed=true;listener({added:[{uri}],removed:[]});});return true;}};
 const until=async predicate=>{for(let n=0;n<20;n++){if(predicate())return;await new Promise(resolve=>setImmediate(resolve));}throw Error('bounded');};
 const js=ts.transpileModule(extract('changeFolders'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const change=vm.runInNewContext(js+'\nchangeFolders;',{vscode:{workspace},assert,until});
 return{workspace,uri,change,confirmed:()=>confirmed,disposed:()=>disposed};
}
test('Baseline count-only completion precedes the real confirmation event',async()=>{const f=fixture();f.workspace.onDidChangeWorkspaceFolders(()=>{});assert(f.workspace.updateWorkspaceFolders());assert.equal(f.workspace.workspaceFolders.length,2);assert.equal(f.confirmed(),false);await new Promise(resolve=>setImmediate(resolve));assert.equal(f.confirmed(),true);});
test('Actual extracted changeFolders waits for the matching event',async()=>{const f=fixture();const pending=f.change(1,0,2,{uri:f.uri});assert.equal(f.confirmed(),false);await pending;assert.equal(f.confirmed(),true);assert.equal(f.disposed(),1);});
test('Optimistic count without confirmation cannot pass',async()=>{const f=fixture('missing');await assert.rejects(f.change(1,0,2,{uri:f.uri}));assert.equal(f.disposed(),1);});
test('Refused update cannot pass and disposes subscription',async()=>{const f=fixture('refused');await assert.rejects(f.change(1,0,2,{uri:f.uri}));assert.equal(f.disposed(),1);});
test('Wrong added URI event cannot satisfy confirmation',async()=>{const f=fixture();await assert.rejects(f.change(1,0,2,{uri:{toString:()=> 'file:///other'}}));assert.equal(f.disposed(),1);});
test('All thirty frozen scenario identities and original withholding assertions retained',()=>{const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,n),'utf8'));assert.deepEqual(read('native-case-freeze-04.json').cases,read('native-case-freeze-03.json').cases);assert.equal((source.match(/await changeFolders\(/g)||[]).length,6);const before=fs.readFileSync(path.join(__dirname,'native-reliability-03.host.ts.txt'),'utf8');for(const assertion of ['withheld(await read("file-race.txt"));assert(changed);assert.equal(prompts,before);','withheld(await read("parent-race/public.txt"));assert(changed);assert.equal(prompts,before);','withheld(await read("content-race.txt"));assert(changed);assert.equal(prompts,before);'])assert(before.includes(assertion)&&source.includes(assertion));});
