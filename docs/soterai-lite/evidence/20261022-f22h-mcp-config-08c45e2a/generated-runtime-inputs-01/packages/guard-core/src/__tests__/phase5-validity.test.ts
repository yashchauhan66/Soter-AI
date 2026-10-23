import test from 'node:test';
import assert from 'node:assert/strict';
import { createApprovalGrant, isApprovalValid, ApprovalStore } from '../ApprovalToken';
import { parseProjectPolicy, PROJECT_POLICY_VERSION, classifyPath } from '../ProjectPolicy';

const input = {sessionId:'synthetic-session',contentHash:'synthetic-digest',decision:'approval_required' as const,scope:'once' as const,now:1000,ttlMs:100};

test('advisory approvals reject invalid lifetime and clock with a working finite control', async () => {
    for (const ttlMs of [NaN,Infinity,-Infinity,-1,0,0.5,28_800_001,Number.MAX_SAFE_INTEGER]) {
        await assert.rejects(createApprovalGrant({...input,ttlMs}),/bounded/);
    }
    for (const now of [NaN,Infinity,-1,Number.MAX_SAFE_INTEGER]) await assert.rejects(createApprovalGrant({...input,now}),/bounded/);
    const grant = await createApprovalGrant(input);
    assert.equal(isApprovalValid(grant,{sessionId:input.sessionId,contentHash:input.contentHash,now:1099}),true);
    for (const now of [NaN,Infinity,999,1100,1101]) assert.equal(isApprovalValid(grant,{sessionId:input.sessionId,contentHash:input.contentHash,now}),false);
    assert.equal(isApprovalValid({...grant,expiresAt:NaN},{sessionId:input.sessionId,contentHash:input.contentHash,now:1001}),false);
});

test('validity withdrawal never restores unchecked approval and once grants cannot replay', async () => {
    await assert.rejects(createApprovalGrant({...input,validityHardeningEnabled:false}),/unavailable/);
    const grant = await createApprovalGrant(input);
    assert.equal(isApprovalValid(grant,{sessionId:input.sessionId,contentHash:input.contentHash,now:1001,validityHardeningEnabled:false}),false);
    const store = new ApprovalStore(); store.add(grant);
    assert.equal(store.consume(input.sessionId,input.contentHash,1001),true);
    assert.equal(store.consume(input.sessionId,input.contentHash,1002),false);
});

test('project schema rejects unsupported versions while valid private and public classifications work', () => {
    for (const version of [NaN,Infinity,0,-1,1.5,2,'1',null]) assert.throws(()=>parseProjectPolicy({version,protectedFiles:[],aiContext:{protectedFileAction:'allow'}}),/Unsupported/);
    assert.throws(()=>parseProjectPolicy({version:PROJECT_POLICY_VERSION},{schemaValidationEnabled:false}),/unavailable/);
    const policy = parseProjectPolicy({version:PROJECT_POLICY_VERSION,protectedFiles:['private.txt'],sensitivePaths:['sensitive/**']});
    assert.equal(classifyPath('private.txt',policy).action,'block');
    assert.equal(classifyPath('public.txt',policy).level,'normal');
});

test('bounded policy input families retain supported schema and default protected paths', () => {
    let seed = 0x5a17;
    for (let i=0;i<150;i++) {
        seed = (Math.imul(seed,1664525)+1013904223)>>>0;
        const policy = parseProjectPolicy({version:PROJECT_POLICY_VERSION,unrecognized:seed,aiContext:{allowSessionMinutes:-(seed%1000)-1},protectedFiles:[null,seed,'']});
        assert.equal(policy.version,PROJECT_POLICY_VERSION);
        assert.equal(classifyPath('.env',policy).action,'block');
        assert.equal(classifyPath('public/readme.txt',policy).level,'normal');
        assert.ok(Number.isSafeInteger(policy.aiContext.allowSessionMinutes));
    }
});
