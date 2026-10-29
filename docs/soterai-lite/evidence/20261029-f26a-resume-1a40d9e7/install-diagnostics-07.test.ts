import assert from "node:assert/strict";
import {test} from "node:test";
import {InstallDiagnostics07} from "./install-diagnostics-07";
test("diagnostics refuse private strings paths stack messages getters and unknown fields",()=>{
    const d=new InstallDiagnostics07(), privateValue="TEST_ONLY_PRIVATE_DIAGNOSTIC_074adbe8";
    let calls=0;d.record("filesystem",{operation:"openSync",outcome:"THREW",code:"ENOENT",target:privateValue,path:privateValue,get status(){calls++;throw Error(privateValue);}});
    const error=Error(privateValue);error.stack=privateValue+"\n    at "+privateValue+" (C:\\"+privateValue+".js:123:45)\n"+privateValue;
    d.frames(error);d.record(privateValue,{code:privateValue});
    const result=JSON.stringify(d.snapshot());assert(!result.includes(privateValue));assert.equal(calls,0);
    assert.deepEqual(d.rows,[{event:"filesystem",operation:"openSync",outcome:"THREW",code:"ENOENT"},{event:"assertion-frame",line:123,column:45}]);
});
test("diagnostic capacity overflow stays bounded and cannot throw into tested routes",()=>{
    const d=new InstallDiagnostics07();for(let i=0;i<300;i++)d.record("listener-close");assert.equal(d.rows.length,256);assert.equal(d.dropped,44);
    assert.doesNotThrow(()=>d.record("filesystem",new Proxy({},{ownKeys(){throw Error("TEST_ONLY_PRIVATE_PROXY");}})));
    assert.equal(d.rows.length,256);assert(Object.isFrozen(d.rows[0]));
});
test("nonfinite unsafe and negative numeric fields cannot enter public diagnostics",()=>{
    const d=new InstallDiagnostics07();for(const n of [NaN,Infinity,-1,Number.MAX_SAFE_INTEGER+1])d.record("assertion-frame",{line:n,column:4});
    assert(d.rows.every(row=>row.line===undefined&&row.column===4));
});
