import test from 'node:test';
import assert from 'node:assert/strict';
import { MemorySecretValueStore, SecretReferenceManager } from '../secret-broker/SecretReferenceManager';
import { EnforcedApiCapabilityBroker } from '../secret-broker/EnforcedApiCapability';

async function setup(oneTime = false) {
    const refs = new SecretReferenceManager();
    const value = 'synthetic private credential only';
    const reference = await refs.create({workspace:'synthetic',ttlMs:60000,oneTime,finding:{value,type:'password',start:0,end:value.length,label:'Synthetic',sensitivity:'critical',allowedOperations:['call_api_with_secret']}});
    let releaseEnabled = true;
    const broker = new EnforcedApiCapabilityBroker(refs,undefined,{releaseGuardEnabled:()=>releaseEnabled});
    const grant = broker.grant({secretRef:reference.ref,workspace:'synthetic',ttlMs:oneTime ? 120000 : 30000,maxUses:oneTime ? 2 : 1,scope:{host:'service.invalid',method:'POST',pathPrefix:'/approved'}});
    return {refs,reference,broker,grant,value,withdraw:()=>{releaseEnabled=false;}};
}

for (const revoke of ['grant','reference','expired','flag-off','none'] as const) test(`pending synthetic transport releases output only with current authority: ${revoke}`,async(t)=>{
    const f = await setup();
    let finish!: (response:{status:number;body:string})=>void;
    let started!: ()=>void;
    const ready = new Promise<void>(resolve=>{started=resolve;});
    const pending = f.broker.call({handle:f.grant.handle,workspace:'synthetic',method:'POST',url:'https://service.invalid/approved'},async request=>{
        assert.ok(request.headers.authorization.includes(f.value));
        started(); return new Promise(resolve=>{finish=resolve;});
    });
    await ready;
    if(revoke==='grant') f.broker.revoke(f.grant.handle);
    if(revoke==='reference') await f.refs.revoke(f.reference.ref);
    if(revoke==='expired') t.mock.method(Date,'now',()=>f.grant.expiresAt+1);
    if(revoke==='flag-off') f.withdraw();
    finish({status:200,body:'public result'});
    const result=await pending;
    assert.equal(result.allowed,revoke==='none');
    if(revoke==='none') assert.equal(result.response?.body,'public result');
    else assert.equal(result.response,undefined);
});

test('release guard withdrawal refuses capability issuance rather than using legacy release',async()=>{
    const f=await setup();
    const broker=new EnforcedApiCapabilityBroker(f.refs,undefined,{releaseGuardEnabled:false});
    assert.throws(()=>broker.grant({secretRef:f.reference.ref,workspace:'synthetic',ttlMs:1000,scope:{host:'service.invalid',method:'POST',pathPrefix:'/approved'}}),/unavailable/);
});

test('VO01: one-time reference releases its authorized public response exactly once', async()=>{
    const f=await setup(true);
    const input={handle:f.grant.handle,workspace:'synthetic',method:'POST',url:'https://service.invalid/approved'};
    let calls=0;
    const transport=async()=>{calls++;return {status:200,body:'public positive control'};};
    const first=await f.broker.call(input,transport);
    assert.equal(first.allowed,true);
    assert.equal(first.response?.body,'public positive control');
    assert.equal(f.refs.metadata(f.reference.ref)?.useCount,1,'Release does not consume another use.');
    const replay=await f.broker.call(input,transport);
    assert.equal(replay.allowed,false);
    assert.equal(replay.response,undefined);
    assert.equal(calls,1,'Reference replay never reaches the synthetic transport.');
});

for (const change of ['revoke','clear','reference-expiry'] as const) test(`VO01: one-time result still withheld after ${change}`,async(t)=>{
    const f=await setup(true);
    const result=await f.broker.call({handle:f.grant.handle,workspace:'synthetic',method:'POST',url:'https://service.invalid/approved'},async()=>{
        if(change==='revoke') await f.refs.revoke(f.reference.ref);
        if(change==='clear') await f.refs.clear('synthetic');
        if(change==='reference-expiry') {
            // Keep the capability valid while the reference's own expiry changes.
            t.mock.method(Date,'now',()=>Date.parse(f.reference.expiresAt));
        }
        return {status:200,body:'withheld synthetic public result'};
    });
    assert.equal(result.allowed,false);
    assert.equal(result.response,undefined);
});

test('used reference lease rejects a copied object and wrong workspace/operation',async()=>{
    const f=await setup(true);
    const used=await f.refs.lookup(f.reference.ref,'synthetic','call_api_with_secret');
    assert.ok(used);
    assert.equal(await f.refs.revalidateUsedReference(used,'synthetic','call_api_with_secret'),true);
    assert.equal(await f.refs.revalidateUsedReference({...used},'synthetic','call_api_with_secret'),false);
    assert.equal(await f.refs.revalidateUsedReference(used,'other','call_api_with_secret'),false);
    assert.equal(await f.refs.revalidateUsedReference(used,'synthetic','inspect_secret_metadata'),false);
});

for (const change of ['value-changed','inventory-disabled','revoked-during-read'] as const) test(`used reference revalidation withholds ${change}`,async(t)=>{
    const store=new MemorySecretValueStore();
    let enabled=true;
    const refs=new SecretReferenceManager(store,{enabled:()=>enabled});
    const value='synthetic lease value';
    const ref=await refs.create({workspace:'synthetic',ttlMs:60000,oneTime:true,finding:{value,type:'password',start:0,end:value.length,label:'Synthetic',sensitivity:'critical',allowedOperations:['call_api_with_secret']}});
    const used=await refs.lookup(ref.ref,'synthetic','call_api_with_secret');
    assert.ok(used);
    assert.equal(await refs.revalidateUsedReference(used,'synthetic','call_api_with_secret'),true);
    if(change==='value-changed') await store.set(ref.id,'different synthetic value');
    if(change==='inventory-disabled') enabled=false;
    if(change==='revoked-during-read') {
        const get=store.get.bind(store);
        t.mock.method(store,'get',async(id:string)=>{const result=await get(id);await refs.revoke(ref.ref);return result;});
    }
    if(change==='inventory-disabled') await assert.rejects(refs.revalidateUsedReference(used,'synthetic','call_api_with_secret'),/disabled/);
    else assert.equal(await refs.revalidateUsedReference(used,'synthetic','call_api_with_secret'),false);
});
