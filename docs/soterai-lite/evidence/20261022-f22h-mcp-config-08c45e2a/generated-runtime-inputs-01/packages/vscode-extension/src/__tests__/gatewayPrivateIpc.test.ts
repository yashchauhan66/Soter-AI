import assert from "node:assert/strict";
import {test} from "node:test";
import {EventEmitter} from "node:events";
import {PassThrough} from "node:stream";
import {randomUUID} from "node:crypto";
import {OwnedBrokerLifecycle} from "../broker/OwnedBrokerLifecycle";
import {createGatewayParentGuard} from "../../../../apps/local-ai-broker/src/GatewayParentGuard";
const tick=()=>new Promise<void>(done=>setImmediate(done));
function fixture(initialize=async()=>{}){
    let child:ReturnType<typeof makeChild>,session="",allowed=true,calls=0;const sent:Record<string,unknown>[]=[];
    function makeChild(){return Object.assign(new EventEmitter(),{stdout:new PassThrough(),stderr:new PassThrough(),connected:true,
        send(value:Record<string,unknown>,cb?:(error:Error|null)=>void){sent.push(value);cb?.(null);if(value.type==="SOTERAI_BROKER_STOP")setImmediate(()=>{child.stdout.end();child.stderr.end();child.emit("close",0);});return true;},kill(){assert.fail("No process signals");}});}
    const lifecycle=new OwnedBrokerLifecycle({script:"/synthetic/f16.js",enabled:()=>true,fingerprint:()=>"synthetic",prepare:async()=>({}),initialize,stopMs:40,
        gatewayGuard:()=>{calls++;return allowed;},launch:((_exe:unknown,_args:unknown,opts:{env:NodeJS.ProcessEnv})=>{session=opts.env.SOTERAI_BROKER_SESSION!;child=makeChild();setImmediate(()=>child.emit("message",{type:"SOTERAI_BROKER_READY",version:1,session,port:49155}));return child;}) as never,
        fetchImpl:async()=>Response.json({session,version:"0.2.0",ready:true})});
    return{lifecycle,sent,get calls(){return calls;},deny(){allowed=false;},challenge(extra={}){const row={type:"SOTERAI_GATEWAY_GUARD_REQUEST",version:1,session,id:randomUUID(),generation:randomUUID(),...extra};child.emit("message",row);return row;}};
}
test("F16-I01 no release permission before initialization completes",async()=>{
    let release!:()=>void,entered!:()=>void;const ready=new Promise<void>(done=>{entered=done;}),f=fixture(()=>{entered();return new Promise<void>(done=>{release=done;});});
    const run=f.lifecycle.start();const outcome=run.catch(()=>undefined);await ready;f.challenge();await tick();await tick();
    const response=f.sent.find(row=>row.type==="SOTERAI_GATEWAY_GUARD_RESPONSE");release();await outcome;await f.lifecycle.stop();assert.equal(response?.allowed,false);assert.equal(f.calls,0);
});
test("F16-I02 healthy bound challenge succeeds; negative guard withdraws",async()=>{const f=fixture();try{await f.lifecycle.start();const first=f.challenge();await tick();await tick();assert.equal(f.sent.find(row=>row.id===first.id)?.allowed,true);f.deny();const second=f.challenge();await tick();await tick();assert.equal(f.sent.find(row=>row.id===second.id)?.allowed,false);assert.throws(()=>f.lifecycle.clientToken());}finally{await f.lifecycle.stop();}});
test("F16-I03 wrong session and extra payload fail closed",async()=>{for(const extra of [{session:"wrong"},{payload:"synthetic-private-never-echo"}]){const f=fixture();try{await f.lifecycle.start();f.challenge(extra);await tick();assert.throws(()=>f.lifecycle.clientToken());assert.ok(!JSON.stringify(f.sent).includes("synthetic-private-never-echo"));}finally{await f.lifecycle.stop();}}});
function channel(){const sent:Record<string,unknown>[]=[];const ch=Object.assign(new EventEmitter(),{connected:true,send(value:Record<string,unknown>,cb?:(e:Error|null)=>void){sent.push(value);cb?.(null);return true;}});return{ch,sent,guard:createGatewayParentGuard("synthetic-session",ch as never)};}
function response(row:Record<string,unknown>,extra={}){return{type:"SOTERAI_GATEWAY_GUARD_RESPONSE",version:1,session:row.session,id:row.id,allowed:true,...extra};}
test("F16-I04 parent reply requires exact session/id/schema; old reply cannot authorize next request",async()=>{const f=channel(),first=f.guard(randomUUID());f.ch.emit("message",response(f.sent[0],{session:"wrong"}));f.ch.emit("message",response(f.sent[0],{payload:"synthetic-extra"}));f.ch.emit("message",response(f.sent[0]));assert.equal(await first,true);const second=f.guard(randomUUID());f.ch.emit("message",response(f.sent[0]));f.ch.emit("disconnect");assert.equal(await second,false);});
test("F16-I05 parent outage and bounded outstanding challenges deny",async()=>{const f=channel();const held=Array.from({length:32},()=>f.guard(randomUUID()));assert.equal(await f.guard(randomUUID()),false);f.ch.emit("disconnect");assert.deepEqual(await Promise.all(held),Array(32).fill(false));f.ch.connected=false;assert.equal(await f.guard(randomUUID()),false);});
test("F16-I06 missing response expires without payload disclosure",async()=>{const f=channel(),start=Date.now();assert.equal(await f.guard(randomUUID()),false);assert.ok(Date.now()-start<2500);assert.equal(Object.keys(f.sent[0]).sort().join(","),"generation,id,session,type,version");});
