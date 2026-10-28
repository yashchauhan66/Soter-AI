'use strict';
const base=require('./current-native-guard-02.cjs');
const guard=()=>base.guard('affected-history-binding-01.json');
module.exports={...base,guard};
if(require.main===module)guard().then(binding=>console.log(JSON.stringify({status:'CURRENT_F27_HISTORY_REGRESSION_BINDING_VERIFIED_NO_CODE_LAUNCH',artifact:binding.vsix.sha256,inputs:1016,drivers:22,historyAssertions:28,native06:'F26a_USER_DEFERRED_NOT_RUN'}))).catch(()=>{console.error('Current history regression admission refused.');process.exitCode=1;});
