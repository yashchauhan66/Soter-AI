'use strict';
const e=require('./evidence-lib-01.cjs'),reconciliation=e.read(e.own('host-template-reconciliation-01.json')),revision=reconciliation.revision;
e.git.preload(revision,reconciliation.records.map(r=>r.path));
const snapshots=[];
for(const record of reconciliation.records){
 e.current(record.actual);e.assert.equal(record.onlyLineEndingsDifferFromCommitted,true);const blob=e.git('show',revision+':'+record.path);e.assert.equal(e.sha(blob),record.proposalPin.sha256);e.assert.equal(blob.length,record.proposalPin.bytes);
 const name=e.path.basename(record.path),frozen=e.own('template-inputs-01/committed/'+name),observed=e.own('template-inputs-01/observed/'+name);
 for(const file of [frozen,observed])e.fs.mkdirSync(e.path.dirname(file),{recursive:true});
 e.fs.writeFileSync(frozen,blob,{flag:'wx'});e.fs.writeFileSync(observed,e.bytes(e.path.join(e.repo,record.path)),{flag:'wx'});
 snapshots.push({original:record.actual,committedRevision:revision,committed:e.fact(frozen),observed:e.fact(observed)});
}
let text=e.bytes(e.own('prepare-host-tools-01.cjs')).toString('utf8');
const prior="prior=path.resolve(__dirname,'../20261021-f22g-editor-config-5d7a91c3')";e.assert.equal(text.split(prior).length,2);text=text.replace(prior,"prior=path.resolve(__dirname,'template-inputs-01/committed')");
const guard="plan('host-current-binding-01.ps1');";e.assert.equal(text.split(guard).length,2);
text=text.replace(guard,"plan('host-current-binding-01.ps1','host-current-binding-01.ps1',s=>one(s,'function Assert-F22hEditorHost {',`function Assert-F22hEditorHost {\n $taskFrozen=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'source-inputs-01.json') -Raw -Encoding UTF8|ConvertFrom-Json\n $taskFrozenRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))\n foreach($taskInput in $taskFrozen.records){\n  $taskInputPath=Join-Path $taskFrozenRepo $taskInput.path\n  if((Get-Item -LiteralPath $taskInputPath).Length -ne $taskInput.bytes -or (Get-FileHash -LiteralPath $taskInputPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskInput.sha256){throw 'Frozen scoped source/test/build input changed.'}\n }`));");
new (require('node:vm').Script)(text,{filename:'prepare-host-tools-02.cjs'});e.fs.writeFileSync(e.own('prepare-host-tools-02.cjs'),text,{flag:'wx'});
e.write('host-template-snapshots-01.json',{status:'PASS_COMMITTED_TEMPLATE_BYTES_RETAINED',revision,snapshots,originalGenerator:e.fact(e.own('prepare-host-tools-01.cjs')),generator:e.fact(e.own('prepare-host-tools-02.cjs')),scope:'Generator01 assertion17802vs17615 before any outputs;23of25 current templates differ only by CRLF normalization from committed/proposed bytes, originunestablished. Preserve both observed and original committed bytes, generate only from exact committed pins. No old file modified or historical failure regraded. Add360frozen source/test/build checks to every current host guard.'});
console.log(JSON.stringify({status:'PREPARED_GENERATOR02_NOT_EXECUTED',templates:snapshots.length,observedAndCommittedSnapshots:snapshots.length*2}));
