'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const own=n=>path.join(__dirname,n),prior=n=>path.join(__dirname,'../20261028-f29-protection-center-6c93e15a',n);
let s=fs.readFileSync(prior('run-f29-native-08.cjs'),'utf8');
const lines=s.split(/\r?\n/),approval=lines.filter(l=>l.includes("const approval=read(own('extra07-approval-01.json'))")),consumption=lines.filter(l=>l.includes("json(own('extra07-consumption-01.json')"));assert.equal(approval.length,1);assert.equal(consumption.length,1);s=lines.filter(l=>!approval.includes(l)&&!consumption.includes(l)).join('\n');
for(const [a,b]of [['./current-native-guard-03.cjs','./current-native-guard-01.cjs'],['f29-native-run-start-08.json','f30-native-run-start-01.json'],['f29-native-run-failure-08.json','f30-native-run-failure-01.json'],['f29-protection-center-native-','f30-setup-verification-native-'],['f29-renderer-workspace-','f30-renderer-workspace-'],['renderer-binding-08.json','renderer-binding-01.json'],['run-code-renderer-observer-07.cjs','run-code-renderer-observer-01.cjs']]){assert(s.includes(a),a);s=s.split(a).join(b);}
// Keep legacy gate files consumed by the unchanged F29 component fixture.
const start=s.indexOf("const observerHelpers=own('accessibility-binding-02.cjs')"),end=s.indexOf(';\n const port=',start);assert(start>0&&end>start);
s=s.slice(0,start)+`const observerHelpers=own('accessibility-binding-01.cjs');const observerPins=[fact(observerScript),fact(observerHelpers),fact(path.resolve(__dirname,'../20261028-f29-protection-center-6c93e15a/accessibility-binding-01.cjs')),fact(path.resolve(__dirname,'../20261028-f29-protection-center-6c93e15a/streamed-vendor-pin-08.cjs')),fact(path.resolve(__dirname,'../20261028-f29-protection-center-6c93e15a/palette-keyboard-fixture-05.cjs')),fact(own('palette-entrypoints-01.cjs'))]`+s.slice(end);
s=s.replace('const phases=[];let rendererResult,primaryOwnerCalls;','const phases=[],extraPhases=[];let rendererResult,primaryOwnerCalls;');
const marker="  assert(!deadline&&!overflow&&!error&&closed.code===0";assert(s.includes(marker));
const copy=`  const extraSource=output+'.f30-results.json';if(fs.existsSync(extraSource))fs.copyFileSync(extraSource,path.join(run,phase+'-f30-results.json'),fs.constants.COPYFILE_EXCL);
  for(const name of fs.readdirSync(execution).filter(n=>/^((primary|restart)-f30-broker-[1-8]-(stdout|stderr)\\.bin|f30-restart-custody\\.json)$/.test(n))){const source=path.join(execution,name),target=path.join(run,name),stat=fs.lstatSync(source);assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size<=8*1024*1024);if(!fs.existsSync(target))fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL);}
`;
s=s.replace(marker,copy+marker);
const basePush="  phases.push({phase,passed:count,resultSha256:sha(fs.readFileSync(output))});";assert(s.includes(basePush));
s=s.replace(basePush,`  const extra=read(extraSource),extraCount=phase==='primary'?15:5;assert.equal(extra.feature,'F30');assert.equal(extra.phase,phase);assert.equal(extra.extensionBundleSha256,binding.frontendSha256);assert.equal(extra.passed,extraCount);assert.equal(extra.failed,0);assert.equal(extra.notRun,0);assert(!extra.driverFailure&&!extra.cleanupFailure);assert.equal(extra.observations.length,extraCount);assert(extra.observations.every(row=>row.status==='PASS'));assert.equal(extra.signalsRequested,0);assert(extra.brokerChildren.length>=1);for(const child of extra.brokerChildren){assert(child.closed&&child.code===0&&child.signal===null&&child.stdoutEOF&&child.stderrEOF);}
  extraPhases.push({phase,passed:extraCount,resultSha256:sha(fs.readFileSync(extraSource))});
`+basePush);
s=s.replace("nativeChecks:30,phases,vsixSha256","nativeChecks:50,baseNativeChecks:30,extraNativeChecks:20,phases,extraPhases,vsixSha256");
s=s.replace("assert.equal(rendererResult?.status,'PASS_SCOPED_ACTUAL_RENDERER_KEYS_HC_MOTION_ROOT_REVIEW_PENDING');","assert.equal(rendererResult?.status,'PASS_SCOPED_ACTUAL_RENDERER_KEYS_HC_MOTION_ROOT_REVIEW_PENDING');assert.equal(rendererResult.verifySetup,'OBSERVED_REAL_TREE_ENTER_CURRENT_THREE_CANARY_COMPONENTS');");
s=s.replace("nativeChecks:30,signalsRequested:0","nativeChecks:50,signalsRequested:0");
s=s.replace("  const output=path.join(execution,phase+'-results.json'),args=","  const output=path.join(execution,phase+'-results.json'),args=");
assert(!s.includes('extra07-approval')&&!s.includes('extra07-consumption'));assert(s.includes('nativeChecks:50'));assert(s.includes('extraCount=phase'));
fs.writeFileSync(own('run-f30-native-01.cjs'),s,{flag:'wx'});console.log('F30_INITIAL_BOUNDED_NATIVE50_RUNNER_PREPARED_NOT_EXECUTED_NO_EXTRA_APPROVAL_REUSE');
