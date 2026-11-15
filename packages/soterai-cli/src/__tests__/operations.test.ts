import assert from "node:assert/strict";
import { test } from "node:test";
import { generateKeyPairSync, sign } from "node:crypto";
import * as fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { canonicalJson, validateOwnerPolicy, validateApprovedOperation, renderTaskTemplate, executeApprovedOperation } from "../operations/ecs";
import { digest } from "../security/bounded";
const account = "123456789012", region = "ap-south-1", nonce = "a".repeat(32);
const keys = generateKeyPairSync("ed25519"), publicKey = keys.publicKey.export({type:"spki",format:"pem"}).toString();
const policy = { schemaVersion: 1, projectId: "demo", accountId: account, region, clusterArn: `arn:aws:ecs:${region}:${account}:cluster/demo`,
    serviceArn: `arn:aws:ecs:${region}:${account}:service/demo/app`, repository: `${account}.dkr.ecr.${region}.amazonaws.com/demo`, family: "demo-app", containerName: "app",
    taskRoleArn: `arn:aws:iam::${account}:role/app`, executionRoleArn: `arn:aws:iam::${account}:role/execution`,
    principalPrefix: `arn:aws:sts::${account}:assumed-role/deployer/`, approvalPublicKey: publicKey, runtimeSecretArns: [`arn:aws:secretsmanager:${region}:${account}:secret:demo-abcdef`] };
const template = { family: policy.family, networkMode: "awsvpc", requiresCompatibilities: ["FARGATE"], cpu: "256", memory: "512", taskRoleArn: policy.taskRoleArn,
    executionRoleArn: policy.executionRoleArn, containerDefinitions: [{ name: "app", image: "SOTERAI_APPROVED_IMAGE", essential: true, secrets: [{ name: "DB_PASSWORD", valueFrom: policy.runtimeSecretArns[0] }] }] };
const bytes = Buffer.from(JSON.stringify(template));
function approval(now = 1000) {
    const payload = { schemaVersion: 1, operation: "ecs.deploy", approvalId: nonce, projectId: "demo", accountId: account, region, clusterArn: policy.clusterArn, serviceArn: policy.serviceArn,
        repository: policy.repository, imageDigest: "b".repeat(64), taskTemplateDigest: digest(bytes), policyDigest: digest(canonicalJson(policy)), issuedAt: now, expiresAt: now + 60000 };
    return { payload, signature: sign(null, Buffer.from(canonicalJson(payload)), keys.privateKey).toString("base64") };
}
test("owner signature and every deployment binding are mandatory", () => {
    const parsed = validateOwnerPolicy(policy); assert.equal(validateApprovedOperation(approval(), parsed, bytes, 1001).approvalId, nonce);
    for (const field of ["projectId","accountId","region","clusterArn","serviceArn","repository","imageDigest","taskTemplateDigest","policyDigest"]) {
        const envelope = approval(); (envelope.payload as any)[field] = "attacker";
        assert.throws(() => validateApprovedOperation(envelope, parsed, bytes, 1001), field);
    }
    assert.throws(() => validateApprovedOperation(approval(), parsed, bytes, 61000));
    assert.throws(() => validateApprovedOperation({...approval(), signature:"a".repeat(88)}, parsed, bytes, 1001));
    assert.throws(() => validateOwnerPolicy({...policy, arbitraryCommand:"curl private"}));
});
test("task rendering admits only fixed roles, one container, digest image and runtime ARN references", () => {
    const parsed = validateOwnerPolicy(policy), approved = validateApprovedOperation(approval(), parsed, bytes, 1001);
    const rendered = JSON.parse(renderTaskTemplate(bytes, parsed, approved).toString());
    assert.equal(rendered.containerDefinitions[0].image, policy.repository+"@sha256:"+approved.imageDigest);
    for (const mutate of [(v:any)=>v.taskRoleArn="arn:aws:iam::123456789012:role/admin", (v:any)=>v.containerDefinitions.push(v.containerDefinitions[0]),
        (v:any)=>v.containerDefinitions[0].environment=[{name:"DB_PASSWORD",value:"private"}], (v:any)=>v.containerDefinitions[0].privileged=true,
        (v:any)=>v.containerDefinitions[0].secrets[0].valueFrom="arn:aws:secretsmanager:ap-south-1:123456789012:secret:other-secret"]) {
        const changed=structuredClone(template); mutate(changed); assert.throws(()=>renderTaskTemplate(Buffer.from(JSON.stringify(changed)),parsed,approved));
    }
});
async function runtime(fail = false) {
    const state = await fs.mkdtemp(path.join(tmpdir(),"soterai-operation-"));
    const outputs: string[][] = [];
    const runtime = { policy, template: bytes, approval: approval(Date.now()), stateDirectory: state, awsExecutable: "C:\\trusted\\aws.exe", assertTrusted: async()=>{},
        claim: async (file:string, data:Buffer)=>{await fs.writeFile(file,data,{flag:"wx"});},
        runner: async (request:any)=>{outputs.push(request.args); if(fail) throw Error("RAW_SECRET_PROVIDER_ERROR");
            if(request.args[0]==="sts") return Buffer.from(JSON.stringify({Account:account,Arn:policy.principalPrefix+"trusted-session"}));
            if(request.args[1]==="register-task-definition") return Buffer.from(JSON.stringify({taskDefinition:{taskDefinitionArn:`arn:aws:ecs:${region}:${account}:task-definition/demo-app:1`}}));
            const taskDefinition=`arn:aws:ecs:${region}:${account}:task-definition/demo-app:1`;
            return Buffer.from(JSON.stringify({service:{serviceArn:policy.serviceArn,taskDefinition},services:[{serviceArn:policy.serviceArn,taskDefinition,status:"ACTIVE",desiredCount:1,pendingCount:0,runningCount:1}],failures:[]})); }};
    return {runtime,outputs};
}
test("durable single use blocks replay and concurrent external operations",async()=>{
    const {runtime: r,outputs}=await runtime();
    const results=await Promise.all([executeApprovedOperation({operation:"ecs.deploy",approvalId:nonce},r),executeApprovedOperation({operation:"ecs.deploy",approvalId:nonce},r)]);
    assert.equal(results.filter(x=>x.status==="SUBMITTED").length,1); assert.equal(outputs.filter(x=>x[1]==="update-service").length,1);
    assert.equal((await executeApprovedOperation({operation:"ecs.deploy",approvalId:nonce},r)).status,"DENIED");
});
test("failure consumes approval, withholds errors and never retries",async()=>{
    const {runtime:r,outputs}=await runtime(true); const first=await executeApprovedOperation({operation:"ecs.deploy",approvalId:nonce},r);
    assert.equal(first.status,"UNKNOWN"); assert.ok(!JSON.stringify(first).includes("RAW_SECRET"));
    assert.equal((await executeApprovedOperation({operation:"ecs.deploy",approvalId:nonce},r)).status,"DENIED"); assert.equal(outputs.length,1);
});
test("trust, durability and revocation rejection occur before any AWS callback",async()=>{
    for(const kind of ["trust","durability","revocation"]) {
        const {runtime:r,outputs}=await runtime();
        if(kind==="trust") r.assertTrusted=async()=>{throw Error()};
        if(kind==="durability") r.claim=async()=>{throw Error()};
        if(kind==="revocation") await fs.writeFile(path.join(r.stateDirectory,nonce+".decision.json"),"revoked");
        assert.equal((await executeApprovedOperation({operation:"ecs.deploy",approvalId:nonce},r)).status,"DENIED"); assert.equal(outputs.length,0);
    }
});
