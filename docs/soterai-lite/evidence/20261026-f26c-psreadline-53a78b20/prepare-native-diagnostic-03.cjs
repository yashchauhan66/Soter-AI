const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),own=n=>path.join(__dirname,n);
let source=fs.readFileSync(own('run-history-native-02.cjs'),'utf8');
const needle="const close=async()=>{await note('close-start');";assert.equal(source.split(needle).length-1,1);
const instrumentation=String.raw`let diagnostic;
const startDiagnostic=async()=>{
 const inspector=require('node:inspector'),session=new inspector.Session(),frames=[],scripts=new Map();session.connect();
 const post=(method,args={})=>new Promise((done,fail)=>session.post(method,args,(error,result)=>error?fail(error):done(result)));
 session.on('Debugger.scriptParsed',({params})=>{const normalized=String(params.url||'').replaceAll('\\','/').toLowerCase();if(normalized.endsWith('/dist/extension.js'))scripts.set(params.scriptId,true)});
 session.on('Debugger.paused',({params})=>{try{
  const calls=params.callFrames||[];if(calls.some(frame=>scripts.has(frame.location.scriptId))&&frames.length<512)frames.push({reason:params.reason,errorClass:typeof params.data?.className==='string'?params.data.className:'Unknown',uncaught:params.data?.uncaught===true,observedAt:new Date().toISOString(),frames:calls.slice(0,16).map(frame=>({functionName:String(frame.functionName||'anonymous').slice(0,120),file:String(frame.url||'').replaceAll('\\','/').split('/').pop(),line:frame.location.lineNumber+1,column:frame.location.columnNumber+1,product:scripts.has(frame.location.scriptId)}))});
 }finally{session.post('Debugger.resume',()=>{})}});
 await post('Debugger.enable');await post('Debugger.setPauseOnExceptions',{state:'all'});
 diagnostic={stop:async()=>{await post('Debugger.setPauseOnExceptions',{state:'none'});await post('Debugger.disable');session.disconnect();await fs.writeFile(process.env.SOTERAI_LITE_F17_EVIDENCE+'.exception-frames.json',JSON.stringify({status:'DIAGNOSTIC_ONLY_NOT_ACCEPTANCE',noDescriptionsLocalsOrValues:true,externalSockets:0,signalsRequested:0,frames},null,2)+'\n',{flag:'wx'})}};
};
`;
source=source.replace(needle,()=>instrumentation+needle);
const run="await note('driver-run-start');await driver.run(context);";assert.equal(source.split(run).length-1,1);source=source.replace(run,"await note('driver-run-start');await startDiagnostic();await driver.run(context);");
const end="finally{await close()}},1500)";assert.equal(source.split(end).length-1,1);source=source.replace(end,"finally{if(diagnostic)await diagnostic.stop();await close()}},1500)");
source=source.replaceAll("'.command-trace.jsonl']","'.command-trace.jsonl','.exception-frames.json']").replaceAll('native-run-failure-02.json','native-run-failure-03.json');
source=source.replaceAll('PASS_SCOPED_NATIVE_OWNER_API_ONLY','DIAGNOSTIC_ONLY_NOT_NATIVE_ACCEPTANCE');
fs.writeFileSync(own('run-history-native-03.cjs'),source,{flag:'wx'});console.log(JSON.stringify({status:'PREPARED_DIAGNOSTIC_ONLY_NOT_EXECUTED',fixtureImprovementRound:2,productChanges:0,oraclesUnchanged:28,externalSockets:0,signalsRequested:0,native06:'DEFERRED_NOT_RUN',captures:'Only own product exception class/function/file-basename/line-column; no messages, locals or values'}));
