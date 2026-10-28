import {test} from "node:test";
import assert from "node:assert/strict";
import {OutputFilter} from "../secret-broker/OutputFilter";
import {runSetupMatchingCheck} from "../setup-verification/SetupCanaryChecks";
test("F30 actual production matcher preserves a public control and masks synthetic raw/base64 values",()=>{const r=runSetupMatchingCheck(new OutputFilter(undefined,{matchingEnabled:()=>true,outputRedactorEnabled:()=>true}));assert.equal(r.status,"PASS");assert.equal(r.cases.length,3);assert(r.cases.every(c=>c.pass));});
test("F30 permissive mutation fails secret-negative controls",()=>{const r=runSetupMatchingCheck({filter:text=>({allowed:true,text})});assert.equal(r.status,"FAIL");assert.equal(r.cases[0].pass,true);assert(r.cases.slice(1).some(c=>!c.pass));});
test("F30 a collector that withholds everything cannot pass its public control",()=>{const r=runSetupMatchingCheck({filter:()=>({allowed:false,text:"withheld"})});assert.equal(r.status,"WITHHELD");assert.equal(r.cases.length,0);});
test("F30 withdrawn production matcher returns WITHHELD instead of PASS",()=>assert.equal(runSetupMatchingCheck(new OutputFilter(undefined,{matchingEnabled:()=>false})).status,"WITHHELD"));
test("F30 private exception text is absent from synthetic report",()=>{const r=runSetupMatchingCheck({filter(){throw Error("FAKE_ONLY_F30_PRIVATE_FAILURE");}});assert.equal(r.status,"FAIL");assert(!JSON.stringify(r).includes("PRIVATE_FAILURE"));});
