'use strict';
// Parses source text only. Never imports/evaluates the test or production code.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),ts=require('typescript');
const repo=path.resolve(__dirname,'../../../..'),file='packages/vscode-extension/src/__tests__/hookIndexSnapshot.test.ts';
const bytes=fs.readFileSync(path.join(repo,file)),text=bytes.toString('utf8');
const parsed=ts.createSourceFile(file,text,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
const errors=parsed.parseDiagnostics.map(d=>({start:d.start,message:ts.flattenDiagnosticMessageText(d.messageText,' ')}));
const report={status:errors.length?'FAIL_STATIC_TYPESCRIPT_PARSE':'PASS_STATIC_TYPESCRIPT_PARSE_ONLY',source:{path:file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')},errors,declaredTests:(text.match(/^test\(/gm)||[]).length,containsNul:bytes.includes(0),testedCodeEvaluated:false,testCompilerBuildGitNative:'NOT_RUN',scope:'TypeScript createSourceFile syntax only; no typecheck, test registration, module import, fixture creation or behavior verification.',time:new Date().toISOString()};
fs.writeFileSync(path.join(__dirname,'hook-index-snapshot-author-static-01.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report));process.exitCode=errors.length?1:0;
