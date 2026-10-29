const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test'),{EventEmitter}=require('node:events'),ts=require('typescript');
const own=n=>path.join(__dirname,n),repo=path.resolve(__dirname,'../../../..');
const source=fs.readFileSync(own('f26a-install-diagnostics-08.host.ts'),'utf8');
const parsed=ts.createSourceFile('fixture.ts',source,ts.ScriptTarget.Latest,true);
function find(predicate){let result;function visit(n){if(!result&&predicate(n))result=n;ts.forEachChild(n,visit);}visit(parsed);assert(result);return result;}
function js(n){return ts.transpileModule('const observer = '+n.getText(parsed)+';', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText+'\nreturn observer;';}
test('all34 native check callbacks remain byte exact; complete transformation reverses to frozen original',()=>{
 const original=fs.readFileSync(path.join(repo,'packages/vscode-extension/src/__tests__/host/litePreCommitGuard.host.ts'),'utf8');
 const callbacks=text=>{const sf=ts.createSourceFile('test.ts',text,ts.ScriptTarget.Latest,true),rows=[];function visit(n){if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='add')rows.push(n.getText(sf));ts.forEachChild(n,visit);}visit(sf);return rows;};
 assert.equal(callbacks(source).length,34);assert.deepEqual(callbacks(source),callbacks(original));
 let reversed=source;for(const row of JSON.parse(fs.readFileSync(own('diagnostic-transform-08.json'),'utf8')).changes.reverse())reversed=reversed.replace(row.after,row.before);assert.equal(reversed,original);
});
test('actual generated filesystem observer preserves receiver arguments return and thrown error identity',()=>{
 const n=find(n=>ts.isCallExpression(n)&&n.expression.getText(parsed)==='patch'&&n.arguments[0]?.getText(parsed)==='fs'&&n.arguments[1]?.getText(parsed)==='operation').arguments[2];
 const rows=[], context={globalStorageUri:{fsPath:'storage'}}, diagnostics={record:(...r)=>rows.push(r)},within=(a,b)=>b==='storage/file',same=(a,b)=>a===b;
 let called,returns={},exception=Error('TEST_ONLY_DELEGATE_EXCEPTION');
 const delegate=function(...args){called={receiver:this,args};if(args[1]==='throw')throw exception;return returns;};
 const observer=new Function('fs','operation','delegate','context','diagnostics07','within','samePath','dirname',js(n))({},'openSync',delegate,context,diagnostics,within,same,()=> 'parent');
 const receiver={},args=['storage/file','read'];assert.equal(observer.apply(receiver,args),returns);assert.equal(called.receiver,receiver);assert.deepEqual(called.args,args);
 assert.throws(()=>observer('storage/file','throw'),e=>e===exception);assert.equal(rows.length,2);
});
test('actual generated server observer delegates exact listener and retains one real server identity',()=>{
 const n=find(n=>ts.isCallExpression(n)&&n.expression.getText(parsed)==='patch'&&n.arguments[0]?.getText(parsed)==='http'&&n.arguments[1]?.getText(parsed)==='"createServer"').arguments[2];
 const rows=[],server=new EventEmitter();server.address=()=>({address:'127.0.0.1',port:42421});let called,requests=0,originalCalls=0;
 const http={},create=function(...args){called={receiver:this,args};return server;};
 const observer=new Function('http','nativeCreateServer','observeRequest','diagnostics07','ownerServers',js(n))(http,create,()=>requests++,{record:(...r)=>rows.push(r)},0);
 const listener=function(req,res){originalCalls++;assert.equal(this,server);assert.equal(req,'request');assert.equal(res,'response');return 'original-return';};
 assert.equal(observer({maxHeaderSize:4096},listener),server);assert.equal(called.receiver,http);assert.equal(called.args.length,2);
 assert.equal(called.args[1].call(server,'request','response'),'original-return');assert.equal(requests,1);assert.equal(originalCalls,1);
 server.emit('listening');server.emit('close');assert.deepEqual(rows.map(r=>r[0]),['listener-created','listener-listening','listener-close']);
});
