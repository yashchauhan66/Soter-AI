import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { prepareProtectedAgent, runProtectedAgent, runGuestProcess } from '../isolation/agent';
import { PROTECTED_AGENT_GUEST } from '../isolation/ProtectedAgentGuest';
const image = 'node@sha256:' + 'a'.repeat(64);
async function source() { const root = await fs.mkdtemp(path.join(tmpdir(), 'soterai-protected-agent-')); await fs.writeFile(path.join(root, 'app.cjs'), "console.log('public')"); return root; }
test('registered prompts are refused and public proposals contain no snapshot or registration values', async () => {
    const root = await source(), value = 'PRIVATE_FIXTURE_VALUE_53f819d2';
    await assert.rejects(prepareProtectedAgent({root,image,files:['app.cjs'],prompt:value,model:'test-model',registeredValues:[value]}));
    const p = await prepareProtectedAgent({root,image,files:['app.cjs'],prompt:'Review public code.',model:'test-model',registeredValues:[value]});
    assert.ok(!JSON.stringify(p).includes(value)); assert.ok(!JSON.stringify(p).includes('console.log'));
});
test('model, task and operation policy are bound into owner approval', async () => {
    const root = await source(), base = {root,image,files:['app.cjs'],prompt:'Review public code.',model:'one'};
    const one=await prepareProtectedAgent(base), two=await prepareProtectedAgent({...base,model:'two'}), task=await prepareProtectedAgent({...base,prompt:'Another public task.'});
    const op=await prepareProtectedAgent({...base,operations:[{id:'status',label:'Read approved status'}],operationPolicyDigest:'b'.repeat(64)});
    assert.equal(one.snapshotSha256,two.snapshotSha256);assert.notEqual(one.approvalSha256,two.approvalSha256);assert.notEqual(one.approvalSha256,task.approvalSha256);assert.notEqual(one.approvalSha256,op.approvalSha256);
});
test('copied proposals, incorrect approvals and source drift cannot invoke Docker or provider', async () => {
    const root=await source(),p=await prepareProtectedAgent({root,image,files:['app.cjs'],prompt:'Review public code.',model:'test'});let calls=0;
    const options={isCurrent:()=>true,model:async()=>{calls++;return {};}};const testing={runner:async()=>{calls++;throw Error('PRIVATE_PROCESS_ERROR');},guest:async()=>({})};
    assert.equal((await runProtectedAgent({...p},p.approvalSha256,options,testing)).status,'DENIED');
    assert.equal((await runProtectedAgent(p,'c'.repeat(64),options,testing)).status,'DENIED');
    await fs.writeFile(path.join(root,'app.cjs'),"console.log('changed')");const result=await runProtectedAgent(p,p.approvalSha256,options,testing);
    assert.equal(result.status,'UNAVAILABLE');assert.equal(calls,0);assert.ok(!JSON.stringify(result).includes('PRIVATE_PROCESS_ERROR'));
});
test('one-use proposal cannot be replayed after a failed runtime attempt', async () => {
    const root=await source(),p=await prepareProtectedAgent({root,image,files:['app.cjs'],prompt:'Review public code.',model:'test'});let calls=0;
    const options={isCurrent:()=>true,model:async()=>({})},testing={runner:async()=>{calls++;throw Error();},guest:async()=>({})};
    assert.equal((await runProtectedAgent(p,p.approvalSha256,options,testing)).status,'UNAVAILABLE');
    assert.equal((await runProtectedAgent(p,p.approvalSha256,options,testing)).status,'DENIED');assert.equal(calls,1);
});
test('actual guest child refuses traversal, returns proposed writes and uses only declared operation IDs', async () => {
    const root=await source();let calls=0;
    const result=await runGuestProcess({executable:process.execPath,args:['-e',PROTECTED_AGENT_GUEST,root],env:{SystemRoot:process.env.SystemRoot,PATH:process.env.PATH},
        signal:new AbortController().signal,start:{type:'start',prompt:'Public guest test.',model:'test',maxTurns:8,operations:['status']},exchange:async request=>{
            const r=request as any;
            if(r.type==='operation-request'){assert.equal(r.operationId,'status');return {type:'operation-response',id:r.id,result:{status:'COMPLETE',fields:{healthy:true}}};}
            calls++;
            if(calls===1)return {type:'model-response',id:r.id,message:{role:'assistant',content:null,tool_calls:[
                {id:'escape',type:'function',function:{name:'read_file',arguments:JSON.stringify({path:'../outside.txt'})}},
                {id:'write',type:'function',function:{name:'write_file',arguments:JSON.stringify({path:'proposed.txt',text:'public proposed output'})}},
                {id:'op',type:'function',function:{name:'approved_operation',arguments:JSON.stringify({operation_id:'status'})}},
            ]}};
            assert.ok(JSON.stringify(r.messages).includes('GUEST_TOOL_REFUSED'));assert.ok(JSON.stringify(r.messages).includes('healthy'));
            return {type:'model-response',id:r.id,message:{role:'assistant',content:'Public task completed.'}};
        }});
    assert.deepEqual((result as any).changedFiles.map((file: any)=>({path:file.path,text:file.text})),[{path:'proposed.txt',text:'public proposed output'}]);assert.equal((result as any).turns,2);
});
