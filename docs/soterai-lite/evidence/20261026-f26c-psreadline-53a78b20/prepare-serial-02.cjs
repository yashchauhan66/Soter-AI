const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),own=n=>path.join(__dirname,n);
let source=fs.readFileSync(own('run-serial-01.cjs'),'utf8').replaceAll('-01','-02').replaceAll('attempt01.vsix','attempt02.vsix');
function swap(before,after){assert.equal(source.split(before).length-1,1,before);source=source.replace(before,()=>after);}
swap("assert.equal(proof.fileCount,1002)","assert.equal(proof.fileCount,1003)");
swap("await step('compiler-05',['node_modules/typescript/bin/tsc','--noEmit','-p','packages/vscode-extension/tsconfig.json']);", "const compiler=read(own('compiler-06.txt.result.json'));assert.equal(compiler.exitCode,0);assert.equal(sha(fs.readFileSync(own('compiler-06.txt'))),compiler.sha256.toLowerCase());verifyInputs();");
swap("await step('freeze-inputs-02',['docs/soterai-lite/evidence/20261026-f26c-psreadline-53a78b20/prepare-full-inputs-02.cjs']);verifyInputs();", "verifyInputs();");
swap("r.arguments[0]==='--import'?path.join(repo,'apps/local-ai-broker'):repo", "repo");
swap("['compiler05','readiness01','package01','freeze1002','full01','backendCompiler01','backendTests01']", "['compiler06PreviouslyPassedAndCurrentSourceRechecked','readiness02','package02','current1003Rechecked','full02','backendCompiler02','backendTests02']");
fs.writeFileSync(own('run-serial-02.cjs'),source,{flag:'wx'});console.log(JSON.stringify({status:'PREPARED_NOT_RUN',sourceProof:'full-inputs-02.json',fileCount:1003,compiler06:'PASS_REUSED_EXACT_CURRENT_SOURCES',original1000msPolicy:'UNCHANGED',originalSerial01:'FULL01_FAIL_RETAINED_BACKEND_NEVER_REACHED',native06:'DEFERRED_NOT_RUN'}));
