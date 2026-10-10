import test from 'node:test';
import assert from 'node:assert/strict';
import { SecretReferenceManager } from '../secret-broker/SecretReferenceManager';
import { EnforcedApiCapabilityBroker } from '../secret-broker/EnforcedApiCapability';

async function setup() {
    const refs = new SecretReferenceManager();
    const value = 'synthetic private credential only';
    const reference = await refs.create({workspace:'synthetic',ttlMs:60000,finding:{value,type:'password',start:0,end:value.length,label:'Synthetic',sensitivity:'critical',allowedOperations:['call_api_with_secret']}});
    let releaseEnabled = true;
    const broker = new EnforcedApiCapabilityBroker(refs,undefined,{releaseGuardEnabled:()=>releaseEnabled});
    const grant = broker.grant({secretRef:reference.ref,workspace:'synthetic',ttlMs:30000,scope:{host:'service.invalid',method:'POST',pathPrefix:'/approved'}});
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
