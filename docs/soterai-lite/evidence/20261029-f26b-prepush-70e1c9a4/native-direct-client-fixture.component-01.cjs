'use strict';
// Real directClient fixture + real production CLI grammar, explicit process/client seams.
// No native process, socket, signing key, Git operation or profile is created here.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test'),ts=require('typescript'),{EventEmitter}=require('node:events'),{createHash}=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),input=process.env.SOTERAI_F26B_DIRECT_SOURCE||'native-prepush-04.host.ts.txt';
assert(['native-prepush-04.host.ts.txt','native-prepush-05.host.ts.txt'].includes(input));
const source=fs.readFileSync(path.join(__dirname,input),'utf8'),tree=ts.createSourceFile(input+'.ts',source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
let functionText;for(const statement of tree.statements)if(ts.isFunctionDeclaration(statement)&&statement.name?.text==='directClient')functionText=statement.getText(tree);assert(functionText);
const transpile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const fixture=transpile(functionText+'\ndirectClient;');
const main=transpile(fs.readFileSync(path.join(repo,'packages/vscode-extension/src/history-hooks/preCommitClientMain.ts'),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
async function execute(expected=0,decision='ALLOW',options={}){
 const raw=Buffer.from('refs/heads/main '+ '1'.repeat(40)+' refs/heads/main '+'0'.repeat(40)+'\n'),wires=[];
 async function runMain(argv,bytes){
  let resolveExit;const exit=new Promise(resolve=>{resolveExit=resolve;}),stdin=new EventEmitter(),stdout=new EventEmitter(),output=[];
  stdin.resume=()=>queueMicrotask(()=>{stdin.emit('data',Buffer.from(bytes));stdin.emit('end');stdin.emit('close');});
  stdout.write=(value,callback)=>{output.push(Buffer.from(value));callback?.();return true;};
  const processSeam={argv:['synthetic-code','synthetic-worker',...argv],stdin,stdout,env:{}};
  Object.defineProperty(processSeam,'exitCode',{set:value=>resolveExit(value)});
  const requireSeam=name=>{
   if(name==='./PreCommitClient')return{runPreCommitClient:()=>{throw Error('Wrong CLI route');}};
   if(name==='./PrePushProtocol')return{PRE_PUSH_LIMITS:{transcriptBytes:32768,milliseconds:60000}};
   if(name==='./PrePushClient')return{runPrePushClient:async()=>{if(decision!=='none')wires.push({status:decision,requestValid:true,signatureValid:true,transcriptMatched:true});return decision==='none'?'UNAVAILABLE':decision;}};
   throw Error('Unexpected dependency');
  };
  vm.runInNewContext(main,{require:requireSeam,exports:{},process:processSeam,Buffer,performance,setTimeout,clearTimeout},{timeout:1000});
  const code=await exit;return{code,stdout:Buffer.concat(output)};
 }
 const spawn=(runtime,argv,configuration)=>{
  assert.equal(runtime,'synthetic-code');assert.equal(configuration.env.ELECTRON_RUN_AS_NODE,'1');assert.equal(configuration.shell,false);
  let complete;const child={stdin:new EventEmitter(),done:new Promise(resolve=>{complete=resolve;})};
  child.stdin.end=bytes=>{const actual=options.argv?options.argv(argv.slice(1)):argv.slice(1);void runMain(actual,bytes).then(result=>complete({receipt:{code:result.code,closed:true,stdoutEOF:true,stderrEOF:true},stdout:options.output?options.output(result.stdout):result.stdout,stderr:Buffer.alloc(0)}));};
  return child;
 };
 const scope={assert,Buffer,sha,currentPin:{worker:'synthetic-worker',systemRoot:'synthetic-system'},halted:false,wires,root:'synthetic-root',nativeSpawn:spawn,process:{execPath:'synthetic-code'},observe:child=>child.done,closed:receipt=>{assert(receipt.closed&&receipt.stdoutEOF&&receipt.stderrEOF);}};
 const work=vm.runInNewContext(fixture,scope,{timeout:1000});await work(raw,expected,decision);
}
test('direct fixture ALLOW uses real CLI grammar and exact transcript-plus-sentinel replay',()=>execute());
test('direct fixture BLOCK uses real CLI grammar and leaves stdout empty',()=>execute(1,'BLOCK'));
test('direct fixture owner absence leaves stdout empty without a wire decision',()=>execute(1,'none'));
test('direct fixture rejects omitted replay flag',()=>assert.rejects(execute(0,'ALLOW',{argv:args=>args.filter(x=>x!=='--replay')})));
test('direct fixture rejects wrong-case route flag',()=>assert.rejects(execute(0,'ALLOW',{argv:args=>args.map(x=>x==='--pre-push'?'--Pre-Push':x)})));
test('direct fixture rejects extra CLI data',()=>assert.rejects(execute(0,'ALLOW',{argv:args=>[...args,'unexpected']})));
test('direct fixture rejects replay output tampering',()=>assert.rejects(execute(0,'ALLOW',{output:bytes=>Buffer.concat([bytes,Buffer.from('?')])})));
test('direct fixture rejects mismatched expected exit',()=>assert.rejects(execute(1,'ALLOW')));
