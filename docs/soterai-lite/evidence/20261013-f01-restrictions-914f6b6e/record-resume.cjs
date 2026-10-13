const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const docs=path.resolve(__dirname,'../..'),root=path.resolve(docs,'../..');
const json=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const atomic=(file,value)=>{const staged=path.join(path.dirname(file),'.tmp-'+path.basename(file)+'-'+crypto.randomBytes(6).toString('hex'));fs.writeFileSync(staged,JSON.stringify(value,null,2)+'\n',{flag:'wx'});fs.renameSync(staged,file);};
const inputsFile=path.join(docs,'inputs.json'),inputs=json(inputsFile);
inputs.approvedGitBundleParents=['C:/Users/USER/soterai-backups','D:/SoterAI-backups'];
inputs.existingFullBackup='D:/SoterAI-backups/security-hardening.bundle';
inputs.currentIncrementalBackup='D:/SoterAI-backups/soterai-lite-20261013-88fb9432.bundle';
inputs.backupRelocationAuthorization='User: tum khud move krr do; exact original base and increment only, copy/hash verified before original duplicate removal.';
inputs.existingTools.installedTestEditor='C:/Users/USER/AppData/Local/Programs/Microsoft VS Code/Code.exe';
atomic(inputsFile,inputs);
const queueFile=path.join(docs,'FEATURE-QUEUE.json'),queue=json(queueFile);
queue.activeFeature='F01';queue.scope='F01 only: implementation and focused regressions complete; exact new VSIX/full suite/host acceptance in progress';
Object.assign(queue.features.find(f=>f.id==='F01'),{status:'VERIFYING',result:'INCOMPLETE',flag:'soterai.lite.restrictionSave'});
atomic(queueFile,queue);
const failures={result:'INCOMPLETE_RETAINED',
 preparation:'Error: ENOSPC: no space left on device, write',
 approvalMessage:'Automatic approval review failed: Fatal error: Failed to initialize session: thread-store internal error: There is not enough space on the disk. (os error 112)\nThe action was not executed because automatic approval review could not be completed. This is a review failure, not a determination that the action is unsafe. Do not bypass the approval check; resolve the error or ask the user for guidance.',
 actionsNotExecuted:['F01 focused-after-01 tests','base backup relocation attempt01'],
 receiptFailure:'Exception calling AppendAllText with 3 arguments: There is not enough space on the disk.',
 subagentFailures:['Agent errored: Selected model is at capacity. Please try a different model.','Agent errored: You’ve hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/settings/usage to purchase more credits or try again at 3:43 PM.'],
 resolution:'User explicitly requested agent move; later freshC~103MB allowed review initialization. Base relocation02PASS exactSHA, C~1.9GBfree; new unique retries preserve prior failures.'};
fs.writeFileSync(path.join(__dirname,'blocked-attempts-01.json'),JSON.stringify(failures,null,2)+'\n',{flag:'wx'});
fs.appendFileSync(path.join(docs,'ledger.md'),'\n## STEP RECEIPT F01-RESUME — actual disk block resolved\n\nEarlier disk-full preparation/approval/ledger writes were INCOMPLETE; exact messages and unexecuted actions are in blocked-attempts-01.json. No approval bypass occurred. User explicitly instructed "tum khud move krr do". FreshC103,657,472bytes allowed authorized base-backup relocation02: verified D:/SoterAI-backups/security-hardening.bundle1,632,545,875bytes/SHA256cc2974fe3dcda234cb9a238e514b933758859c75ee534ae313ccd768032857c9 before removing only C: duplicate. Both backup pair files now live D:. Receipt base-backup-relocation-02.json records exact path/hash/time/freebytes. inputs.json records this existing authorization.20GB gate staysWAIVED.\n\nF01 test-first baseline16FAIL; production metadata/awaited saves/manual pending-read lifecycle implemented. First afterfix15PASS/1FAIL was a nested UI mock restoration fixture defect; explicit original-method restoration fixed it,16PASS. Added four meaningful concurrency/config/no-op policy regressions: one existing multi-root test exposed nondeterministic filesystem arrival order; controlling first update made its intended queue sequence deterministic. New workspace/root-drift review finding got test-first regression baseline20PASS/3FAIL; original root is now validated before queued persistence and before SAVED, preserving already committed stronger records on drift. Current focused23PASS/0FAIL; typecheck03PASS.\n\nSource-review independenceLOW; same-lineage host author hit capacity/usage limits (exact messages retained), its completed host source was read/typechecked by root. F01 remainsVERIFYING/INCOMPLETE until full suite,new matching VSIX,save/reload host,affected baseline harnesses,flags/safe rollback and scoped local commit finish. No F02 code has started; no interim numerical rating. Supplemental full fsck remainsactive; do notkill/rerun.\n');
console.log(JSON.stringify({status:'RECORDED',activeFeature:queue.activeFeature,backupBase:inputs.existingFullBackup}));
