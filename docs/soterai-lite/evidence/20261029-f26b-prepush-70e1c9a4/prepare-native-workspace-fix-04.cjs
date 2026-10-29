'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),ts=require('typescript');
const own=n=>path.join(__dirname,n),repo=path.resolve(__dirname,'../../../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=n=>JSON.parse(fs.readFileSync(own(n),'utf8').replace(/^\uFEFF/,'')),save=(n,v)=>fs.writeFileSync(own(n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const old=fs.readFileSync(own('native-prepush-03.host.ts.txt'),'utf8');
const before='add("Workspace setting cannot enable the machine owner route", async () => { await configuration.update(FLAG, true, vscode.ConfigurationTarget.Workspace); await idle(); assert.equal((await call("installPrePushGuard")).status, "UNAVAILABLE"); await configuration.update(FLAG, undefined, vscode.ConfigurationTarget.Workspace); await idle(); });';
const after=`add("Workspace setting cannot enable the machine owner route", async () => {
            await assert.rejects(async () => { await configuration.update(FLAG, true, vscode.ConfigurationTarget.Workspace); },
                (error: unknown) => error instanceof Error && error.name === "CodeExpectedError"
                    && error.message.includes("soterai." + FLAG) && error.message.includes("Workspace Settings")
                    && error.message.includes("only into User settings"));
            await idle(); assert.equal(configuration.get<boolean>(FLAG), false);
            assert.equal(configuration.inspect<boolean>(FLAG)?.workspaceValue, undefined);
            assert.equal((await call("installPrePushGuard")).status, "UNAVAILABLE");
        });`;
assert.equal(old.split(before).length,2);const current=old.replace(before,after);assert.equal(current.replace(after,before),old);
const input='native-prepush-04.host.ts.txt';fs.writeFileSync(own(input),current,{flag:'wx'});
const virtual=path.join(repo,'packages/vscode-extension/src/__tests__/__f26b_native_workspace04.ts');
const parsed=ts.readConfigFile(path.join(repo,'packages/vscode-extension/tsconfig.json'),ts.sys.readFile);assert(!parsed.error);
const config=ts.parseJsonConfigFileContent(parsed.config,ts.sys,path.join(repo,'packages/vscode-extension')),options={...config.options,noEmit:true};
const host=ts.createCompilerHost(options),originalSource=host.getSourceFile.bind(host),originalRead=host.readFile.bind(host),originalExists=host.fileExists.bind(host),same=file=>path.resolve(file).toLowerCase()===virtual.toLowerCase();
host.getSourceFile=(file,language,...rest)=>same(file)?ts.createSourceFile(file,current,language,true,ts.ScriptKind.TS):originalSource(file,language,...rest);host.readFile=file=>same(file)?current:originalRead(file);host.fileExists=file=>same(file)||originalExists(file);
const diagnostics=ts.getPreEmitDiagnostics(ts.createProgram([virtual],options,host)).map(d=>({code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,' ')}));
const tree=ts.createSourceFile(virtual,current,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS),scopes=[];
function visit(node){if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='add'&&ts.isStringLiteral(node.arguments[0]))scopes.push(node.arguments[0].text);ts.forEachChild(node,visit);}visit(tree);
assert.equal(scopes.length,36);const cases=scopes.map((scope,index)=>({phase:index<30?'primary':'restart',scope}));assert.deepEqual(cases,read('native-fixture-static-result-03.json').cases);
const parseErrors=tree.parseDiagnostics.map(d=>({code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,' ')}));
save('native-fixture-static-result-04.json',{status:diagnostics.length||parseErrors.length?'FAIL_SOURCE_ONLY':'PASS_SOURCE_ONLY_NOT_EXECUTED_NO_DRIVER_EMIT',input,bytes:Buffer.byteLength(current),sha256:sha(current),parseErrors,diagnostics,transformedInMemoryOnly:true,transformedSha256:sha(ts.transpileModule(current,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText),cases});assert.equal(diagnostics.length,0);assert.equal(parseErrors.length,0);
const root='C:/Users/USER/AppData/Local/Programs/Microsoft VS Code/2c33b50b16/resources/app/out/',desktop=fs.readFileSync(root+'vs/workbench/workbench.desktop.main.js','utf8'),nls=JSON.parse(fs.readFileSync(root+'nls.messages.json','utf8'));
const witnesses=[29529,29530].map(index=>{const offset=desktop.indexOf(index+',null');assert(offset>=0);return{nlsIndex:index,message:nls[index],offset,sourceWitness:desktop.slice(Math.max(0,offset-150),offset+180)};});
save('native-workspace-fix-review-04.json',{status:'HOST_DENIED_WORKSPACE_WRITE_ORACLE_CORRECTED_NO_PRODUCT_CHANGE',observedAt:new Date().toISOString(),nativeBefore:{primaryPass:2,primaryFail:1,primaryNotRun:27,restartNotRun:6,errorName:'CodeExpectedError'},baseline:'native-workspace-before-01.txt actual7PASS1FAIL using real HP03 callback and explicit host-refusal seam',before,after,reversalByteExact:true,all36ScopesByteExact:true,allOther35CallbacksByteExact:true,metadataHP01CallbackUnchanged:true,ownershipAndDeadlinesUnchanged:true,sourceBefore:{input:'native-prepush-03.host.ts.txt',bytes:Buffer.byteLength(old),sha256:sha(old)},sourceAfter:{input,bytes:Buffer.byteLength(current),sha256:sha(current)},installedSourceWitnesses:witnesses,diagnosisLimit:'Prior native output retained error name only. Corrected native must verify the exact setting-specific user-only workspace refusal message; an unrelated error or enabled/retained workspace value will still fail.',productionChanged:false,source1070AndVsixUnchanged:true,native:'NOT_RUN_ON_CORRECTED_WORKSPACE_FIXTURE',f26aNative09:'USER_DEFERRED_NOT_RUN',configuredPush:'NOT_AUTHORIZED_NOT_RUN'});
console.log(JSON.stringify({status:'WORKSPACE_ORACLE_CORRECTION_STRICT_TYPECHECK_36_SCOPES_PASS_NOT_NATIVE',input,bytes:Buffer.byteLength(current),sha256:sha(current),cases:36}));
