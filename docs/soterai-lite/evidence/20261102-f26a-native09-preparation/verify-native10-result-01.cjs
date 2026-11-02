'use strict';
// Read existing completed native evidence only; never launch or repair a fixture.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('./native09-current-admission-01.cjs'),{own,repo,read,sha,fact}=C;
function verify(runName){
 assert.match(runName,/^f26a-precommit-native-\d{8}T\d{6}Z-[a-f0-9]{8}$/);
 const b=C.guard(),run=own(runName),f=n=>path.join(run,n),facts=new Map();
 const retain=p=>{const row=fact(p);facts.set(row.path,row);return row;};
 const json=p=>{assert(fs.statSync(p).size<=16*1024*1024);retain(p);return read(p);};
 const eq=(value,expected,label)=>assert.deepEqual(value,expected,label);
 const freeze=json(f('freeze.json')),summary=json(f('summary.json')),semantic=read(own('original-native34-freeze-01.json'));
 eq(summary.status,'PASS_SCOPED');eq(summary.nativeChecks,34);eq(summary.independence,'LOW');eq(summary.phases.map(x=>x.phase),['primary','restart']);
 eq(freeze.vsixSha256,b.vsix.sha256);eq(summary.vsixSha256,b.vsix.sha256);eq(freeze.hostProbeSha256,b.newDriver.sha256);
 eq(summary.extensionBundleSha256,b.frontendSha256);eq(summary.workerSha256,freeze.workerSha256);
 const droot=path.resolve(freeze.executionEvidenceRoot);eq(droot,path.resolve('D:\\SoterAI-Lite-test-profiles',runName));
 function synthetic(p){const absolute=path.resolve(p);assert(absolute.startsWith(droot+path.sep));const s=fs.lstatSync(absolute);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1);return absolute;}
 function sameBytes(a,z){eq(fs.readFileSync(a),fs.readFileSync(synthetic(z)));retain(a);retain(z);}
 function stream(row){const p=synthetic(row.path),raw=fs.readFileSync(p);eq(raw.length,row.bytes);eq(sha(raw),row.sha256);retain(p);}
 const closure=row=>{for(const k of ['observedExit','stdoutEOF','stderrEOF'])eq(row[k],true,k);eq(row.exitCode,0);eq(row.signalsRequested,0);eq(row.timedOut,false);};
 let children=0;
 for(const [phase,count,prefix]of [['primary',30,'F26A-HP'],['restart',4,'F26A-HR']]){
  const row=json(f(phase+'-results.json')),phaseSummary=summary.phases.find(x=>x.phase===phase);
  sameBytes(f(phase+'-results.json'),phaseSummary.result);eq(sha(fs.readFileSync(f(phase+'-results.json'))),phaseSummary.sha256);
  eq(row.schemaVersion,1);eq(row.syntheticOnly,true);eq(row.phase,phase);eq(row.expectedChecks,count);eq(row.passed,count);eq(row.failed,0);eq(row.notRun,0);assert(!row.driverFailure);eq(row.observations.length,count);
  for(let i=0;i<count;i++){eq(row.observations[i].id,prefix+String(i+1).padStart(2,'0'));eq(row.observations[i].scope,semantic[phase][i]);eq(row.observations[i].status,'PASS');}
  eq(row.hostVersion,'1.144.0');eq(row.codeSha256,freeze.codeExecutableSha256);eq(row.hostProbeSha256,b.newDriver.sha256);eq(row.extensionBundleSha256,b.frontendSha256);eq(row.workerSha256,freeze.workerSha256);
  for(const field of ['runtimeBindings','currentRuntimeBindings']){eq(row[field].length,4);for(const rt of freeze.runtimeBindings){const actual=row[field].filter(x=>x.file===rt.name);eq(actual.length,1);eq(actual[0].sha256,rt.sha256);eq(actual[0].bytes,rt.bytes);}}
  eq(row.executionManifest.sha256,freeze.fixtureManifestSha256);eq(row.currentExecutionManifest.sha256,freeze.fixtureManifestSha256);
  for(const k of ['busyChildren','timedOutChildren','sourceDocuments','sourceDocumentEvents','directWorktreeReads','directObjectReads'])eq(row[k],0,k);eq(row.metadataLeak,false);eq(row.parentEnvironmentUnchanged,true);eq(row.independence,'LOW');
  assert(row.children.length>0);children+=row.children.length;
  for(const child of row.children){for(const k of ['closed','stdoutEOF','stderrEOF','argumentsValid','environmentValid','parentEnvironmentUnchanged'])eq(child[k],true,k);for(const k of ['busy','timedOut','spawnFailed','streamError','overflow','invalidInput'])eq(child[k],false,k);eq(child.signal,null);eq(child.signalsRequested,0);}
  if(phase==='primary')eq(row.readyForInterphase,true);else eq(row.interphaseEvidence,'ACTUAL_LAUNCHER_RECEIPT_VALIDATED');
  closure(json(f(phase+'-owned-editor-close.json')));const absent=json(f(phase+'-owned-editor-absence.json'));closure(absent);eq(absent.pidAbsentTwice,true);eq(absent.streamsStable,true);eq(absent.pidAbsenceObservations.length,2);assert(absent.pidAbsenceObservations.every(x=>x.absent===true&&x.pid===absent.pid));
  for(const channel of ['stdout','stderr']){const p=f(phase+'-'+channel+'.txt'),s=absent.streams.find(x=>path.resolve(x.path)===path.resolve(p));assert(s);const raw=fs.readFileSync(p);eq(raw.length,s.bytes);eq(sha(raw),s.sha256);retain(p);}
 }
 for(const rt of freeze.runtimeBindings){for(const p of [rt.source,synthetic(rt.execution)]){const raw=fs.readFileSync(p);eq(raw.length,rt.bytes);eq(sha(raw),rt.sha256);retain(p);}}
 closure(json(f('offline-helper-close.json')));
 const offline=json(f('precommit-owner-absent.json'));sameBytes(f('precommit-owner-absent.json'),summary.actualOfflineEvidence);
 eq(offline.status,'ACTUAL_OWNER_ABSENT_BLOCKED');eq(offline.syntheticOnly,true);eq(offline.primaryStateSha256,sha(fs.readFileSync(f('precommit-restart-state.json'))));retain(f('precommit-restart-state.json'));
 eq(offline.headAfter,offline.headBefore);for(const k of ['source','index','hook'])eq(offline[k+'After'],offline[k+'Before']);
 const o=offline.owner;for(const k of ['closed','stdoutEOF','stderrEOF','ownerArgumentsHaveNoHooksOverride'])eq(o[k],true,k);for(const k of ['timedOut','overflow','streamError','spawnFailed'])eq(o[k],false,k);eq(o.signal,null);eq(o.signalsRequested,0);assert(Number.isInteger(o.exitCode)&&o.exitCode!==0);stream(o.stdout);stream(o.stderr);
 assert(fs.readFileSync(synthetic(o.stderr.path)).includes(Buffer.from('SoterAI: Commit withheld. Open the owning editor or review pre-commit status.')));
 const outer=json(own('native10-run-01-owned-close.json')),chain=json(own('native10-chain-result-01.json'));
 eq(outer.actualClose,true);eq(outer.exitCode,0);eq(outer.signal,null);eq(outer.stdoutEOF,true);eq(outer.stderrEOF,true);eq(outer.signalsRequested,0);eq(outer.deadlineExceeded,false);eq(outer.overflow,false);eq(outer.streamError,false);
 for(const s of outer.streams){const p=own('native10-run-01-'+s.name+'.bin'),raw=fs.readFileSync(p);eq(raw.length,s.bytes);eq(raw.length,s.observedBytes);eq(sha(raw),s.sha256);retain(p);}
 eq(chain.status,'APPROVED_NATIVE10_WRAPPER_CLOSED_PASS_ROOT_AGGREGATION_PENDING');eq(chain.wrapperExit,0);eq(chain.innerExit,0);eq(chain.actualClose,true);eq(chain.stdoutEOF,true);eq(chain.stderrEOF,true);eq(chain.signal,null);eq(chain.deadlineExceeded,false);
 C.canonical('native10-run-01');retain(own('native10-run-01.txt'));retain(own('native10-run-01.txt.result.json'));
 const approval=json(own('native10-user-approval-01.json')),consumption=json(own('native10-consumption-01.json'));
 eq(approval.replyId,'call_0d76e0002c6c4bc684183d1ee61ff5a0');eq(approval.allowedAttempts,1);eq(consumption.approvalSha256,sha(fs.readFileSync(own('native10-user-approval-01.json'))));eq(consumption.candidateSha256,sha(fs.readFileSync(own('run-precommit-native10-current-01.ps1'))));eq(consumption.proposalSha256,sha(fs.readFileSync(own('NATIVE10-CURRENT-JSON-PINS-PROPOSAL01.md'))));
 return {status:'PASS_SCOPED_CURRENT_F26A_NATIVE34_OFFLINE_WITHDRAWAL',observedAt:new Date().toISOString(),runName,sourceProof:b.sourceProof,vsix:b.vsix,binding:fact(own('native09-current-binding-01.json')),checks:{primary:30,restart:4,total:34,failed:0,notRun:0},declaredNativeChildren:children,offlineOwner:'ACTUAL_OWNER_ABSENT_BLOCKED_NATURAL_CLOSE_BOTH_EOF',owners:'PRIMARY_RESTART_CODE_AND_OFFLINE_HELPER_EXIT0_BOTH_EOF_MARKED_CODE_ABSENT_TWICE',originalHook:'UNKNOWN_OWNER_EDIT_RETAINED_INCOMPLETE_AS_ASSERTED_HR04_NOT_SILENTLY_REMOVED',independence:'LOW',nestedClientClosure:'NOT_INFERRED_FROM_OWNER_GIT; ORIGINAL_DIRECT_CLIENT_CONTROLS_RETAINED',evidence:[...facts.values()].sort((a,b)=>a.path.localeCompare(b.path)),featureComplete:false,remaining:'Scoped feature acceptance and source/transition byte barriers',signalsRequested:0};
}
module.exports={verify};
if(require.main===module){try{const result=verify(process.argv[2]);fs.writeFileSync(own('native10-acceptance-01.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:result.status,checks:result.checks,evidence:result.evidence.length}));}catch(e){console.error(e);process.exitCode=1;}}
