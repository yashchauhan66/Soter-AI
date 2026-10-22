'use strict';
const h=require('./evidence-lib-01.cjs'),{fs,own,assert}=h;
let text=fs.readFileSync(own('confirm-durable-final-exit-02.ps1'),'utf8');
function replace(from,to){assert.equal(text.split(from).length-1,1,'Unexpected seed '+from);text=text.replace(from,to);}
replace("Get-ReceiptBinding 'recovery-candidate03-run-01' 0","Get-ReceiptBinding 'recovery-candidate03-run-01' 1");
replace("@('final-gates-run-07','candidate03-gates-run-02','affected-ci-run-03')","@('final-gates-run-07','candidate03-gates-run-02','affected-ci-run-03','current-affected-suite-run-04','affected-ci-run-04')");
replace('PASS_RECOVERY_RECEIPT_BOTH_RUNNERS_ABSENT_AND_FOUR_STABLE_STREAMS','INCOMPLETE_CURRENT_NATIVE_FAILED_STABLE');
replace('innerRecoveryExitCode=0;','innerRecoveryExitCode=1;');
replace('Actual current recovery inner receipt0,','Actual failed recovery inner receipt1,');
replace('plus four stable output streams authorize indexing.','plus four stable output streams authorize ACTIVE checkpoint indexing only; feature acceptance remainsINCOMPLETE.');
replace('durable-recovery-exit-01.json','checkpoint-failure-stability-01.json');
fs.writeFileSync(own('confirm-durable-failed-recovery-exit-01.ps1'),text,{flag:'wx'});
console.log(JSON.stringify({status:'PREPARED_ONLY',report:'checkpoint-failure-stability-01.json',featureAcceptance:'INCOMPLETE'}));
