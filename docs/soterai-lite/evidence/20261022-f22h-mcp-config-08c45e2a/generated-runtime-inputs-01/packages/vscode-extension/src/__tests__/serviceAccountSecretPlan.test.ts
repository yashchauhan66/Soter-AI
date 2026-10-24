import { test } from "node:test";
import assert from "node:assert/strict";
const VALUE = "TEST_ONLY_F22E_PRIVATE_18d29c7f", GENERATION = "25000000-0000-4000-8000-000000000005";
const PEM = "-----BEGIN PRIVATE KEY-----\n" + VALUE + "\n-----END PRIVATE KEY-----\n";
async function module() { const m = await import("../config-scanners/ServiceAccountSecretPlan"); assert.equal(typeof m.createServiceAccountSecretPlan, "function"); return m; }
async function plan(text: string, generation = GENERATION) { return (await module()).createServiceAccountSecretPlan(text, "service-account-json", generation); }
const safeError = (e: unknown) => !String(e).includes(VALUE);

test("F22e only canonical saved JSON paths are classified", async () => {
    const { serviceAccountFormatForPath } = await module(); for (const file of ["service-account.json", "nested/FIREBASE.JSON", "public.json"]) assert.equal(serviceAccountFormatForPath(file), "service-account-json");
    for (const file of ["key.json.bak", "key.pem", "config.jsonc", "package.txt"]) assert.equal(serviceAccountFormatForPath(file), undefined);
    for (const file of ["../key.json", "C:/key.json", "/key.json", "a\\key.json", "a//key.json"]) assert.throws(() => serviceAccountFormatForPath(file), safeError);
});
test("F22e escaped multiline private key masks while public Google schema and endpoints remain useful", async () => {
    const text = JSON.stringify({type:"service_account",project_id:"public-project",private_key_id:"public-key-id",private_key:PEM,client_email:"fixture@example.invalid",client_id:"12345",auth_uri:"https://accounts.example.invalid/auth",token_uri:"https://oauth.example.invalid/token",client_x509_cert_url:"https://cert.example.invalid/public"},null,2);
    const result = await plan(text); assert.equal(result.candidates.length,1); assert.equal(result.candidates[0].rawValue,PEM); assert(!result.maskedText.includes(VALUE)); const parsed=JSON.parse(result.maskedText); assert.equal(parsed.private_key_id,"public-key-id"); assert.equal(parsed.token_uri,"https://oauth.example.invalid/token"); assert.match(parsed.private_key,/^\[SOTERAI_PROTECTED_/); assert.equal(result.restoreMode,"checkpoint"); assert.equal(result.exampleText,"");
});
test("F22e authorized user and nested credentials use actual fields without inheriting public parent labels", async () => {
    const result=await plan(JSON.stringify({type:"authorized_user",client_id:"public-client-id",client_secret:VALUE,refresh_token:VALUE+"-refresh",private:{name:"public",retries:2},nested:[{password:VALUE+"-nested"}]})); assert.equal(result.candidates.length,3); assert(!result.maskedText.includes(VALUE)); assert.equal(JSON.parse(result.maskedText).private.name,"public");
});
test("F22e ordinary public JSON, key identifiers, public PEM and harmless near-matches stay useful", async () => {
    const text=JSON.stringify({private_key_id:"ordinary-public-id",client_id:"public-id",monkey:"banana",token_uri:"https://oauth.example.invalid/token",keys:["public",true,123,null],public_key:"-----BEGIN PUBLIC KEY-----\nPUBLIC_EXAMPLE_ONLY\n-----END PUBLIC KEY-----"}); const result=await plan(text); assert.equal(result.candidates.length,0); assert.equal(result.maskedText,text);
});
test("F22e public field names never exempt recognized provider secrets or private material", async () => {
    const secret="ghp_"+"a".repeat(36), result=await plan(JSON.stringify({private_key_id:secret,client_id:PEM})); assert.equal(result.candidates.length,2); assert(!result.maskedText.includes(secret)); assert(!result.maskedText.includes(VALUE));
});
test("F22e credential URLs and credential query scalars are replaced whole without exposing userinfo", async () => {
    const url="https://synthetic:"+VALUE+"@example.invalid/path",query="https://example.invalid/callback?access_token="+VALUE+"-query";const result=await plan(JSON.stringify({token_uri:url,auth_uri:query}));assert.equal(result.candidates.length,2);assert(!result.maskedText.includes("synthetic"));assert(!result.maskedText.includes(VALUE));assert.equal(result.candidates[0].rawValue,url);
});
test("F22e escaped duplicate names and malformed/JSONC syntax refuse without plaintext diagnostics", async () => {
    await module();for(const text of ['{"private_key":"'+VALUE+'","private_\\u006bey":"duplicate"}','{"a":{"x":1,"x":2}}','{"private_key":"'+VALUE+'",}','// TOKEN='+VALUE+'\n{}','{"x":NaN}','{"x":1e999}','{"x":"unterminated}','[]','{} true'])await assert.rejects(plan(text),safeError);
});
test("F22e external credential files, external-account sources and nonstring credential material refuse", async () => {
    await module();for(const value of [{type:"external_account",credential_source:{file:"synthetic-not-read"}},{private_key_file:"synthetic-not-read.pem"},{client_secret_file:"synthetic-not-read.json"},{private_key:123},{secret:{nested:"opaque"}}])await assert.rejects(plan(JSON.stringify(value)),safeError);
});
test("F22e exact references and protected markers are controls; mixed markers/templates refuse", async () => {
    const text=JSON.stringify({private_key:"${PRIVATE_KEY}",token:"[SOTERAI_PROTECTED_EXISTING]",password:"REPLACE_ME"});assert.equal((await plan(text)).candidates.length,0);await module();for(const value of ["prefix${TOKEN}"+VALUE,"prefix[SOTERAI_PROTECTED_EXISTING]"+VALUE,"[SOTERAI_PROTECTED_broken"])await assert.rejects(plan(JSON.stringify({password:value})),safeError);
});
test("F22e exact escaped source spans and CRLF restoration bytes remain private and repeat migration is empty", async () => {
    const text='{\r\n "private_key": '+JSON.stringify(PEM)+',\r\n "password": "'+VALUE+'\\u0021"\r\n}\r\n';const result=await plan(text);assert.equal(result.candidates.length,2);for(const c of result.candidates)assert.equal(text.slice(c.start,c.end),c.replacementText);assert.equal(JSON.parse(result.candidates[1].replacementText),VALUE+"!");assert.equal((await plan(result.maskedText)).candidates.length,0);
});
test("F22e UTF8, control, size, depth, candidate and generation limits refuse without original values", async () => {
    await module();for(const text of ['{"password":"'+VALUE+'\\u0000"}','{"password":"\\ud800"}',JSON.stringify({password:VALUE,padding:"x".repeat(65536)}),'{"x":'.repeat(66)+'0'+'}'.repeat(66),JSON.stringify(Object.fromEntries(Array.from({length:129},(_,i)=>["password_"+i,VALUE+"-"+i])))])await assert.rejects(plan(text),safeError);await assert.rejects(plan(JSON.stringify({password:VALUE}),"invalid"),safeError);
});
test("F22e repeated private values under a public field are all replaced and credential-bearing names withhold", async () => {
    const result=await plan(JSON.stringify({password:VALUE,description:VALUE}));assert.equal(result.candidates.length,2);assert(!result.maskedText.includes(VALUE));await module();await assert.rejects(plan(JSON.stringify({["ghp_"+"b".repeat(36)]:"public"})),safeError);
});
test("F22e deterministic nested JSON corpus keeps public structure and round-trip masked JSON valid", async () => {
    for(let i=0;i<64;i++){const original={project_id:"public-"+i,private_key_id:"public-id-"+i,list:[{password:VALUE+"-"+i},i,true,null]},result=await plan(JSON.stringify(original,null,i%3));assert.equal(result.candidates.length,1);assert(!result.maskedText.includes(VALUE));const parsed=JSON.parse(result.maskedText);assert.equal(parsed.project_id,original.project_id);assert.equal(parsed.list[1],i);assert.equal((await plan(result.maskedText)).candidates.length,0);}
});


test("F22e decoded escaped residual in a public scalar withholds the entire plan", async () => {
    await module(); const encoded = VALUE.replaceAll("T", "\\u0054"), text = '{"password":' + JSON.stringify(VALUE) + ',"description":"prefix' + encoded + 'suffix"}'; await assert.rejects(plan(text), safeError);
});

test("F22e decoded escaped residual in a property name withholds the entire plan", async () => {
    await module(); const encoded = VALUE.replaceAll("T", "\\u0054"), text = '{"password":' + JSON.stringify(VALUE) + ',"' + encoded + '":"public"}'; await assert.rejects(plan(text), safeError);
});
