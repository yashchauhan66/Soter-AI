'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),ts=require('typescript');const own=n=>path.join(__dirname,n),sha=b=>crypto.createHash('sha256').update(b).digest('hex');let s=fs.readFileSync(own('native-reliability-01.host.ts.txt'),'utf8');
function one(a,b){assert.equal(s.split(a).length,2,a);s=s.replace(a,b);}
one('const wait=(ms:number)=>new Promise<void>(done=>setTimeout(done,ms));',[
'const peerOwner={started:false,closed:false,stdoutEOF:false,stderrEOF:false,timedOut:false};',
'export function setupDiagnostic(){return{halted:fixtureHandles!==0||peerOwner.started&&(!peerOwner.closed||!peerOwner.stdoutEOF||!peerOwner.stderrEOF),busyChildren:peerOwner.started&&!peerOwner.closed?1:0,timedOutChildren:peerOwner.timedOut?1:0,unfinishedFixtureHandles:fixtureHandles};}',
'const wait=(ms:number)=>new Promise<void>(done=>setTimeout(done,ms));',
'async function bounded<T>(work:Promise<T>,milliseconds=10000):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([work,new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(Error("Bounded synthetic operation incomplete.")),milliseconds);})]);}finally{clearTimeout(timer);}}',
].join('\n'));
one('let closed=false,code:number|null=null','peerOwner.started=true;\n let closed=false,code:number|null=null');
one('if(channel==="stdout")stdoutEOF=true;else stderrEOF=true;','if(channel==="stdout"){stdoutEOF=true;peerOwner.stdoutEOF=true;}else{stderrEOF=true;peerOwner.stderrEOF=true;}');
one('closed=true;code=exit;signal=stopped;','closed=true;peerOwner.closed=true;code=exit;signal=stopped;');
one('await until(()=>closed&&stdoutEOF&&stderrEOF,90000);','try{await until(()=>closed&&stdoutEOF&&stderrEOF,90000);}catch(error){peerOwner.timedOut=true;throw error;}');
assert.equal(s.split('await entered;').length,3);s=s.replaceAll('await entered;','await bounded(entered);');
const ast=ts.createSourceFile('native-reliability-02.host.ts',s,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);assert.equal(ast.parseDiagnostics.length,0);
const old=JSON.parse(fs.readFileSync(own('native-case-freeze-01.json'),'utf8')),scopes={};for(const statement of ast.statements)if(ts.isVariableStatement(statement))for(const d of statement.declarationList.declarations)if(ts.isIdentifier(d.name)&&['primaryScopes','restartScopes'].includes(d.name.text)){assert(d.initializer&&ts.isArrayLiteralExpression(d.initializer));scopes[d.name.text]=d.initializer.elements.map(e=>{assert(ts.isStringLiteral(e));return e.text;});}
assert.deepEqual(scopes.primaryScopes,old.cases.filter(r=>r.phase==='primary').map(r=>r.scope));assert.deepEqual(scopes.restartScopes,old.cases.filter(r=>r.phase==='restart').map(r=>r.scope));
for(const name of ['native-reliability-02.host.ts.txt','native-reliability-02.host.ts'])fs.writeFileSync(own(name),s,{flag:'wx'});
const raw=Buffer.from(s);fs.writeFileSync(own('native-case-freeze-02.json'),JSON.stringify({...old,status:'F28_NATIVE30_SOURCE_UNCHANGED_CASES_PEER_OWNERSHIP_AND_BOUNDED_WAIT_FIX_NOT_RUN',observedAt:new Date().toISOString(),source:{path:'native-reliability-02.host.ts.txt',bytes:raw.length,sha256:sha(raw)},priorCaseFreezeSha256:sha(fs.readFileSync(own('native-case-freeze-01.json'))),change:'Fixture-only setupDiagnostic retains owning window on unfinished peer/streams/handles or timeout; consent entry waits bounded10s. All30 assertions/IDs/scopes/product1076 unchanged.'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'F28_NATIVE30_LIFECYCLE_SOURCE_PREPARED_NOT_EXECUTED',primary:25,restart:5,sourceSha256:sha(raw)}));
