const h=require('./f15h-evidence-lib.cjs'),{assert,fs,path,repo,base,sha,hash,read,inside,own,git,lines,fileFact}=h;
function queueCheck(queue,old,revision){
 assert.equal(old.activeFeature,'F15');assert.equal(queue.activeFeature,'F16');assert.equal(queue.features.length,old.features.length);
 for(const key of Object.keys(old).filter(k=>!['features','activeFeature'].includes(k)))assert.deepEqual(queue[key],old[key]);
 for(const row of old.features.filter(r=>!['F15','F16'].includes(r.id)))assert.deepEqual(queue.features.find(r=>r.id===row.id),row);
 const parent=queue.features.find(r=>r.id==='F15'),prior=old.features.find(r=>r.id==='F15'),next=queue.features.find(r=>r.id==='F16'),oldNext=old.features.find(r=>r.id==='F16');
 const changed=['status','result','subcards','sourceEvidenceCommit','acceptanceEvidence','commitByteVerification','transitionByteVerification','parentCompletionVerification'];
 for(const key of Object.keys(prior).filter(k=>!changed.includes(k)))assert.deepEqual(parent[key],prior[key]);
 assert.deepEqual(parent.subcards.map(r=>r.id),['F15a','F15b','F15c','F15d','F15e','F15f','F15g','F15h']);
 for(const row of prior.subcards.filter(r=>r.id!=='F15h'))assert.deepEqual(parent.subcards.find(r=>r.id===row.id),row);
 const last=parent.subcards[7];for(const key of Object.keys(prior.subcards[7]).filter(k=>!['status','result'].includes(k)))assert.deepEqual(last[key],prior.subcards[7][key]);assert.equal(last.status,'DONE');assert.equal(last.result,'PASS');assert.equal(last.sourceRevision,revision);
 assert.equal(last.evidence,base+'/f15h-acceptance-01.json');assert.equal(last.commitByteVerification,base+'/f15h-committed-byte-verification-01.json');assert.equal(last.transitionByteVerification,base+'/f15h-transition-byte-verification-01.json');
 assert.ok(parent.subcards.every(r=>r.status==='DONE'&&r.result==='PASS'));assert.equal(parent.status,'DONE');assert.equal(parent.result,'PASS');assert.equal(parent.sourceEvidenceCommit,revision);
 assert.equal(parent.acceptanceEvidence,base+'/f15-parent-acceptance-01.json');assert.equal(parent.commitByteVerification,last.commitByteVerification);assert.equal(parent.transitionByteVerification,last.transitionByteVerification);assert.equal(parent.parentCompletionVerification,base+'/f15-parent-completion-byte-verification-01.json');
 assert.equal(oldNext.status,'PLANNED');assert.equal(next.status,'ACTIVE');assert.equal(next.result,'INCOMPLETE');for(const key of Object.keys(oldNext).filter(k=>!['status','result'].includes(k)))assert.deepEqual(next[key],oldNext[key]);
}
function verifyCards(queue,revision,priorOnly=false){
 const rows=queue.features.find(r=>r.id==='F15').subcards;assert.deepEqual(rows.map(r=>r.id),['F15a','F15b','F15c','F15d','F15e','F15f','F15g','F15h']);
 return rows.filter(row=>!priorOnly||row.id<'F15g').map(row=>{
  assert.equal(row.status,'DONE');assert.equal(row.result,'PASS');assert.match(row.sourceRevision,/^[a-f0-9]{40}$/);
  const acceptanceFile=inside(repo,row.evidence),proofFile=inside(repo,row.commitByteVerification),a=read(acceptanceFile),p=read(proofFile),indexName=path.posix.dirname(row.evidence)+'/'+row.id.toLowerCase()+'-evidence-index-01.json',indexFile=inside(repo,indexName),idx=read(indexFile);
  assert.equal(a.status,'PASS');assert.equal(p.status,'PASS');assert.equal(p.revision,row.sourceRevision);assert.equal(p.indexedEntries,idx.entries.length);assert.equal(p.committedPaths,idx.expectedCommitPaths.length);assert.deepEqual(p.mismatches,[]);assert.equal(p.unexpectedPaths,0);
  assert.equal(sha(git('show',row.sourceRevision+':'+indexName)),hash(indexFile));git.preload(row.sourceRevision,idx.entries.map(e=>e.path));
  for(const e of idx.entries){const blob=git('show',row.sourceRevision+':'+e.path);assert.equal(blob.length,e.bytes);assert.equal(sha(blob),e.sha256);}
  assert.deepEqual(lines(git('diff-tree','--no-commit-id','--name-only','-r',row.sourceRevision)).sort(),idx.expectedCommitPaths.slice().sort());
  assert.equal(sha(git('show',revision+':'+row.evidence)),hash(acceptanceFile));if(row.id!=='F15h')assert.equal(sha(git('show',revision+':'+row.commitByteVerification)),hash(proofFile));
  assert.equal(a.artifact.sha256,p.artifact.sha256);const artifact=inside(repo,a.artifact.path);assert.equal(hash(artifact),a.artifact.sha256);assert.equal(fs.statSync(artifact).size,a.artifact.bytes);
  let transitionProof=null;if(row.id!=='F15h'){const f=inside(repo,row.transitionByteVerification),t=read(f);assert.equal(t.status,'PASS');assert.equal(t.sourceRevision,row.sourceRevision);assert.deepEqual(t.mismatches,[]);assert.equal(t.unexpectedPaths,0);assert.equal(sha(git('show',revision+':'+row.transitionByteVerification)),hash(f));transitionProof=fileFact(f);}
  return {id:row.id,sourceRevision:row.sourceRevision,acceptance:fileFact(acceptanceFile),sourceProof:fileFact(proofFile),sourceIndex:fileFact(indexFile),indexedEntries:idx.entries.length,committedPaths:idx.expectedCommitPaths.length,artifact:a.artifact,priorTransitionProof:transitionProof,currentTransitionRequired:row.id==='F15h',historicalSourceBytesVerified:true,currentWorkingTreeEquivalenceClaimed:false};
 });
}
function parentCheck(parent,queue,revision,artifactSha){
 assert.equal(parent.status,'PASS_SCOPED_SOURCE_AND_PRIOR_TRANSITIONS_CURRENT_TRANSITION_REQUIRED');assert.equal(parent.feature,'F15');assert.equal(parent.sourceRevision,revision);assert.equal(parent.artifact.sha256,artifactSha);assert.equal(parent.independence,'LOW');assert.equal(parent.rating,'PENDING');assert.equal(parent.catalog.status,'44_UNVERIFIED');assert.equal(parent.catalog.graded,false);
 assert.deepEqual(parent.cards,verifyCards(queue,revision));assert.equal(parent.finalProof,base+'/f15-parent-completion-byte-verification-01.json');
}
module.exports={queueCheck,verifyCards,parentCheck};
