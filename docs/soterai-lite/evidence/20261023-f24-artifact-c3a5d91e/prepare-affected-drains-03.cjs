'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),e=require('./input-lib-01.cjs');
const p=name=>path.join(__dirname,name),read=name=>fs.readFileSync(p(name),'utf8'),put=(name,text)=>fs.writeFileSync(p(name),text,{flag:'wx'});
assert(!fs.existsSync(p('affected-hosts-run-01.txt')),'Affected host launch already attempted; refuse preparation mutation.');
assert(!fs.readdirSync(__dirname).some(name=>name.startsWith('affected-')&&fs.statSync(p(name)).isDirectory()),'Affected execution already began.');
const rows=[];
for(const kind of ['functional','security']){
 const original=read('run-'+kind+'-02.ps1');
 const anchor=kind==='functional'?"    if ($timedOut) { throw 'INCOMPLETE: functional host timeout; every Code.exe process retained.' }":"    if ($timedOut) { throw 'Isolated host timed out; raw output retained; no security pass is recorded.' }";
 assert(original.includes(anchor));
 const closure=`    $taskClosed=$process.HasExited
    $taskClose=@{observedExit=$taskClosed;exitCode=$(if($taskClosed){$process.ExitCode}else{$null});stdoutEOF=$stdout.IsCompleted;stderrEOF=$stderr.IsCompleted;signalsRequested=0;pid=$process.Id;observedAt=[DateTime]::UtcNow.ToString('o')}
    $taskCloseBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskClose|ConvertTo-Json -Depth 6)+[Environment]::NewLine)
    $taskCloseStream=[IO.File]::Open((Join-Path $runRoot 'owned-editor-close.json'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    try{$taskCloseStream.Write($taskCloseBytes,0,$taskCloseBytes.Length)}finally{$taskCloseStream.Dispose()}
    if(-not $taskClosed -or -not $stdout.IsCompleted -or -not $stderr.IsCompleted){throw 'INCOMPLETE: actual owned exit and both EOF drains required; all processes retained.'}
`;
 const target='run-'+kind+'-03.ps1';put(target,original.replace(anchor,closure+anchor));
 rows.push({path:target,sha256:e.sha(fs.readFileSync(p(target))),beforePath:'run-'+kind+'-02.ps1',beforeSha256:e.sha(Buffer.from(original))});
}
const affected=read('run-affected-hosts-02.ps1');assert(affected.includes('run-functional-02.ps1')&&affected.includes('run-security-02.ps1'));
put('run-affected-hosts-before-drain-03.ps1',affected);
const current=affected.replace('run-functional-02.ps1','run-functional-03.ps1').replace('run-security-02.ps1','run-security-03.ps1');
fs.writeFileSync(p('run-affected-hosts-02.ps1'),current);
put('affected-drain-preparation-03.json',JSON.stringify({status:'PREPARED_NOT_EXECUTED_STRICT_EXIT_AND_BOTH_EOF',beforeExecutionRefusal:true,rows,dispatcher:{path:'run-affected-hosts-02.ps1',beforeSha256:e.sha(Buffer.from(affected)),sha256:e.sha(Buffer.from(current))},scope:'Still-unexecuted affected dispatcher now uses new launchers03. All previous helpers/bytes retained. Original budgets, payloads, expected assertions and no-signals rules unchanged. Pending or faulted drains cannot return passing exit. Actual closure receipts required in acceptance.'},null,2));
const validation=read('validate-prepared-03.ps1').replace('prepared-validation-03.json','prepared-validation-04.json');put('validate-prepared-04.ps1',validation);
console.log(JSON.stringify({status:'PREPARED_NOT_EXECUTED_STRICT_EXIT_AND_BOTH_EOF',launchers:rows.length}));
