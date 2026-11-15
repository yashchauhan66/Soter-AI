import assert from "node:assert/strict";
import {test} from "node:test";
import {generateKeyPairSync,sign} from "node:crypto";
import * as fs from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";
import {validateEc2Policy,validateEc2Approval,executeApprovedEc2Operation,runOwnerEc2Operation,validateSsmContent} from "../operations/ec2";
import {canonicalJson} from "../operations/ecs";
import {digest} from "../security/bounded";
const keys=generateKeyPairSync("ed25519"), content=JSON.stringify({schemaVersion:"2.2",parameters:{Approval:{type:"String",description:"public signed permit",interpolationType:"ENV_VAR",allowedPattern:"^[A-Za-z0-9+/]{1,8190}={0,2}$"}},mainSteps:[{action:"aws:runShellScript",name:"installApprovedArtifact",inputs:{timeoutSeconds:"120",runCommand:["/usr/bin/node /opt/soterai-owner/ec2-install.cjs"]}}]}), account="123456789012", region="ap-southeast-2";
const policy={schemaVersion:1,projectId:"demo",accountId:account,region,instanceId:"i-"+"1".repeat(17),bucket:"soterai-approved-fixture",keyPrefix:"approved/",documentName:"SoteraiApprovedDeploy",documentVersion:"1",documentSha256:digest(content),principalPrefix:`arn:aws:sts::${account}:assumed-role/deployer/`,approvalPublicKey:keys.publicKey.export({type:"spki",format:"pem"}).toString()};
const id="d".repeat(32), artifact="e".repeat(64);
function signed(){const now=Date.now(),payload={schemaVersion:1,operation:"ec2.deploy",approvalId:id,policyDigest:digest(canonicalJson(policy)),artifactSha256:artifact,objectKey:"approved/"+artifact+".json",objectVersion:"v1-approved-object",issuedAt:now,expiresAt:now+60000};return{payload,signature:sign(null,Buffer.from(canonicalJson(payload)),keys.privateKey).toString("base64")};}
async function fixture(tamper?:string){const calls:any[]=[],state=await fs.mkdtemp(path.join(tmpdir(),"soterai-ec2-"));const runtime={policy,approval:signed(),stateDirectory:state,awsExecutable:"C:\\trusted\\aws.exe",assertTrusted:async()=>{},claim:async(file:string,b:Buffer)=>{await fs.writeFile(file,b,{flag:"wx"});},credentialEnvironment:{AWS_ACCESS_KEY_ID:"synthetic-key",AWS_SECRET_ACCESS_KEY:"synthetic-private",AWS_ENDPOINT_URL:"https://attacker.invalid",HTTP_PROXY:"https://attacker.invalid"},
    runner:async(request:any)=>{calls.push(request);const op=request.args[1];
        const value:any=op==="get-caller-identity"?{Account:account,Arn:policy.principalPrefix+"session"}:op==="describe-document"?{Document:{Name:policy.documentName,Owner:account,DocumentVersion:"1",DocumentType:"Command",Status:"Active",HashType:"Sha256",Hash:digest(content)}}:
            op==="get-document"?{Name:policy.documentName,DocumentVersion:"1",DocumentType:"Command",Status:"Active",Content:content}:op==="head-object"?{VersionId:"v1-approved-object",ChecksumSHA256:Buffer.from(artifact,"hex").toString("base64"),ContentLength:400}:
            {Command:{CommandId:"11111111-1111-1111-1111-111111111111",InstanceIds:[policy.instanceId]}};
        if(tamper===op)throw Error("RAW_PRIVATE_PROVIDER_ERROR");if(tamper==="wrong-owner"&&op==="describe-document")value.Document.Owner="999999999999";
        if(tamper==="wrong-checksum"&&op==="head-object")value.ChecksumSHA256="wrong";return Buffer.from(JSON.stringify(value));}};return{runtime,calls};}
test("EC2 policy and signed permit reject malformed targets and changed bytes",()=>{
    const p=validateEc2Policy(policy),a=signed();assert.equal(validateEc2Approval(a,p,Date.now()).approvalId,id);
    for(const bad of [{...policy,instanceId:"i-anything;sh"},{...policy,accountId:123456789012},{...policy,command:"arbitrary"}])assert.throws(()=>validateEc2Policy(bad));
    a.payload.objectVersion="other";assert.throws(()=>validateEc2Approval(a,p,Date.now()));
});
test("exact SSM document, versioned artifact and single instance are submitted once",async()=>{
    const {runtime:r,calls}=await fixture();const results=await Promise.all([executeApprovedEc2Operation({operation:"ec2.deploy",approvalId:id},r),executeApprovedEc2Operation({operation:"ec2.deploy",approvalId:id},r)]);
    assert.equal(results.filter(r=>r.status==="SUBMITTED").length,1);assert.equal(calls.filter(r=>r.args[1]==="send-command").length,1);
    const sent=calls.find(r=>r.args[1]==="send-command");assert.ok(sent.args.includes(policy.instanceId));assert.ok(!sent.args.includes("--targets"));assert.ok(!JSON.stringify(results).includes("synthetic-private"));
    assert.equal(sent.env.AWS_ENDPOINT_URL,undefined);assert.equal(sent.env.HTTP_PROXY,undefined);
});
test("wrong owner, changed object, timeout and unknown result consume permit and block replay",async()=>{
    for(const reason of ["wrong-owner","wrong-checksum","send-command"]){const {runtime:r,calls}=await fixture(reason);
        const result=await executeApprovedEc2Operation({operation:"ec2.deploy",approvalId:id},r);assert.equal(result.status,"UNKNOWN");assert.ok(!JSON.stringify(result).includes("RAW_PRIVATE"));
        assert.equal((await executeApprovedEc2Operation({operation:"ec2.deploy",approvalId:id},r)).status,"DENIED");if(reason!=="send-command")assert.equal(calls.filter(r=>r.args[1]==="send-command").length,0);
    }
});
test("workspace executable can never become the privileged production broker",async()=>{assert.equal((await runOwnerEc2Operation(id)).code,"TRUSTED_LINUX_OWNER_INSTALLATION_REQUIRED");});
test("an owner document cannot expose arbitrary shell or legacy string interpolation",()=>{const doc=JSON.parse(content);validateSsmContent(content);doc.mainSteps[0].inputs.runCommand=["curl {{ Approval }}"];assert.throws(()=>validateSsmContent(JSON.stringify(doc)));const changed=JSON.parse(content);changed.parameters.Approval.interpolationType="STRING";assert.throws(()=>validateSsmContent(JSON.stringify(changed)));});
