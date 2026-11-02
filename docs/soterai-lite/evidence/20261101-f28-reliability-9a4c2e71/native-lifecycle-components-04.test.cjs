'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,process.env.F28_FIXTURE_SOURCE||'native-reliability-04.host.ts.txt'),'utf8'),ast=ts.createSourceFile('fixture.ts',source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS),node=ast.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='setupDiagnostic');
const vectors=[
 ['idle',{started:false,closed:false,stdoutEOF:false,stderrEOF:false,timedOut:false},0,false,0,0],
 ['live peer',{started:true,closed:false,stdoutEOF:false,stderrEOF:false,timedOut:false},0,true,1,0],
 ['closed but missing EOF',{started:true,closed:true,stdoutEOF:false,stderrEOF:true,timedOut:false},0,true,0,0],
 ['complete peer',{started:true,closed:true,stdoutEOF:true,stderrEOF:true,timedOut:false},0,false,0,0],
 ['late close after timeout',{started:true,closed:true,stdoutEOF:true,stderrEOF:true,timedOut:true},0,false,0,1],
 ['unfinished source handle',{started:false,closed:false,stdoutEOF:false,stderrEOF:false,timedOut:false},1,true,0,0],
];
for(const [label,peerOwner,fixtureHandles,halted,busyChildren,timedOutChildren]of vectors)test('Actual extracted native cleanup diagnostic: '+label,()=>{
 assert(node,'Fixture must expose its actual unfinished-owner state to bootstrap close guard.');
 const js=ts.transpileModule(node.getText(ast).replace('export ',''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const result=vm.runInNewContext(js+'\nsetupDiagnostic();',{peerOwner,fixtureHandles});assert.equal(result.halted,halted);assert.equal(result.busyChildren,busyChildren);assert.equal(result.timedOutChildren,timedOutChildren);assert.equal(result.unfinishedFixtureHandles,fixtureHandles);
 // Exact bootstrap predicate: retain the owning window if any proof is incomplete.
 assert.equal(Boolean(result.halted||result.busyChildren||result.timedOutChildren),Boolean(halted||busyChildren||timedOutChildren));
});
