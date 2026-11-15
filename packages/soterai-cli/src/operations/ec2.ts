import path from "node:path";
import { verify } from "node:crypto";
import { assertRootOwned, canonicalJson, type OperationResult } from "./ecs";
import { boundedProcess, digest, durableCreate, exactObject, readStable, type ProcessRunner } from "../security/bounded";

export interface Ec2OwnerPolicy {
    schemaVersion: 1; projectId: string; accountId: string; region: string; instanceId: string; bucket: string; keyPrefix: string;
    documentName: string; documentVersion: string; documentSha256: string; principalPrefix: string; approvalPublicKey: string;
}
const FIELDS = ["schemaVersion","projectId","accountId","region","instanceId","bucket","keyPrefix","documentName","documentVersion","documentSha256","principalPrefix","approvalPublicKey"];
export function validateEc2Policy(value: unknown): Ec2OwnerPolicy {
    exactObject(value,FIELDS); const p=value as unknown as Ec2OwnerPolicy;
    if(FIELDS.filter(key=>key!=="schemaVersion").some(key=>typeof value[key]!=="string") || p.schemaVersion!==1 || !/^[A-Za-z0-9_-]{1,64}$/.test(p.projectId) || !/^\d{12}$/.test(p.accountId) || !/^[a-z]{2}-[a-z]+-\d$/.test(p.region)
        || !/^i-[a-f0-9]{17}$/.test(p.instanceId) || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(p.bucket) || !/^[a-z0-9][a-z0-9/_-]{0,128}\/$/.test(p.keyPrefix)
        || !/^[A-Za-z0-9_-]{3,128}$/.test(p.documentName) || !/^[1-9]\d{0,5}$/.test(p.documentVersion) || !/^[a-f0-9]{64}$/.test(p.documentSha256)
        || !p.principalPrefix.startsWith(`arn:aws:sts::${p.accountId}:assumed-role/`) || !/^[A-Za-z0-9+=,.@_-]{1,64}\/$/.test(p.principalPrefix.split(":assumed-role/")[1])
        || typeof p.approvalPublicKey!=="string" || p.approvalPublicKey.length>2048 || !p.approvalPublicKey.startsWith("-----BEGIN PUBLIC KEY-----")) throw Error();
    return JSON.parse(canonicalJson(p));
}
export interface Ec2Approval {schemaVersion:1;operation:"ec2.deploy";approvalId:string;policyDigest:string;artifactSha256:string;objectKey:string;objectVersion:string;issuedAt:number;expiresAt:number}
export function validateEc2Approval(value:unknown,policy:Ec2OwnerPolicy,now:number):Ec2Approval {
    exactObject(value,["payload","signature"]); exactObject(value.payload,["schemaVersion","operation","approvalId","policyDigest","artifactSha256","objectKey","objectVersion","issuedAt","expiresAt"]);
    const a=value.payload as unknown as Ec2Approval;
    if(typeof value.signature!=="string" || !/^[A-Za-z0-9+/]{86}==$/.test(value.signature) || !verify(null,Buffer.from(canonicalJson(a)),policy.approvalPublicKey,Buffer.from(value.signature,"base64"))
        || a.schemaVersion!==1 || a.operation!=="ec2.deploy" || !/^[a-f0-9]{32}$/.test(a.approvalId) || a.policyDigest!==digest(canonicalJson(policy)) || !/^[a-f0-9]{64}$/.test(a.artifactSha256)
        || a.objectKey!==policy.keyPrefix+a.artifactSha256+".json" || !/^[A-Za-z0-9+/.=_-]{1,1024}$/.test(a.objectVersion) || a.objectVersion==="null"
        || !Number.isSafeInteger(a.issuedAt) || !Number.isSafeInteger(a.expiresAt) || a.issuedAt>now || a.expiresAt<=now || a.expiresAt<=a.issuedAt || a.expiresAt-a.issuedAt>900000) throw Error();
    return JSON.parse(canonicalJson(a));
}
export interface Ec2Runtime {policy:unknown;approval:unknown;stateDirectory:string;awsExecutable:string;assertTrusted():Promise<void>;runner:ProcessRunner;claim(file:string,bytes:Buffer):Promise<void>;credentialEnvironment?:NodeJS.ProcessEnv}
export function validateSsmContent(content:string):void{
    const doc=JSON.parse(content);exactObject(doc,["schemaVersion","parameters","mainSteps"],["description"]);exactObject(doc.parameters,["Approval"]);
    const parameter=doc.parameters.Approval;exactObject(parameter,["type","description","interpolationType","allowedPattern"]);
    if(doc.schemaVersion!=="2.2" || parameter.type!=="String" || parameter.interpolationType!=="ENV_VAR" || parameter.allowedPattern!=="^[A-Za-z0-9+/]{1,8190}={0,2}$" || !Array.isArray(doc.mainSteps) || doc.mainSteps.length!==1)throw Error();
    const step=doc.mainSteps[0];exactObject(step,["action","name","inputs"]);exactObject(step.inputs,["timeoutSeconds","runCommand"]);
    if(step.action!=="aws:runShellScript" || step.name!=="installApprovedArtifact" || step.inputs.timeoutSeconds!=="120" || canonicalJson(step.inputs.runCommand)!=='["/usr/bin/node /opt/soterai-owner/ec2-install.cjs"]')throw Error();
}
export interface Ec2Result extends OperationResult {commandId?:string}
export async function executeApprovedEc2Operation(request:unknown,runtime:Ec2Runtime):Promise<Ec2Result> {
    let claimed=false,id:string|undefined;
    try {
        exactObject(request,["operation","approvalId"]); if(request.operation!=="ec2.deploy" || typeof request.approvalId!=="string" || !/^[a-f0-9]{32}$/.test(request.approvalId)) throw Error();
        id=request.approvalId;await runtime.assertTrusted();const policy=validateEc2Policy(runtime.policy),approval=validateEc2Approval(runtime.approval,policy,Date.now());if(approval.approvalId!==id)throw Error();
        await runtime.claim(path.join(runtime.stateDirectory,id+".decision.json"),Buffer.from(canonicalJson({status:"claimed",approvalId:id,approvalDigest:digest(canonicalJson(approval))})));claimed=true;
        const env:NodeJS.ProcessEnv={PATH:"/usr/bin:/bin",LANG:"C.UTF-8",AWS_CONFIG_FILE:"/dev/null",AWS_SHARED_CREDENTIALS_FILE:"/dev/null",AWS_EC2_METADATA_DISABLED:"true",AWS_MAX_ATTEMPTS:"1",AWS_PAGER:"",AWS_REGION:policy.region};
        for(const key of ["AWS_ACCESS_KEY_ID","AWS_SECRET_ACCESS_KEY","AWS_SESSION_TOKEN"])if(runtime.credentialEnvironment?.[key])env[key]=runtime.credentialEnvironment[key];
        const call=async(service:"sts"|"ssm"|"s3api",args:string[])=>{if(Date.now()>=approval.expiresAt)throw Error();const endpoint=service==="s3api"?"s3":service;
            return JSON.parse((await runtime.runner({executable:runtime.awsExecutable,args:[service,...args,"--region",policy.region,"--endpoint-url",`https://${endpoint}.${policy.region}.amazonaws.com`,"--output","json","--no-cli-pager"],env,timeoutMs:25000,maxOutputBytes:262144})).toString("utf8"));};
        const identity=await call("sts",["get-caller-identity"]);if(identity.Account!==policy.accountId || typeof identity.Arn!=="string" || !identity.Arn.startsWith(policy.principalPrefix) || !/^[A-Za-z0-9+=,.@_-]{2,64}$/.test(identity.Arn.slice(policy.principalPrefix.length)))throw Error();
        const described=await call("ssm",["describe-document","--name",policy.documentName,"--document-version",policy.documentVersion]);
        const description=described.Document;if(!description || description.Name!==policy.documentName || description.Owner!==policy.accountId || description.DocumentVersion!==policy.documentVersion
            || description.DocumentType!=="Command" || description.Status!=="Active" || description.HashType!=="Sha256" || description.Hash!==policy.documentSha256)throw Error();
        const doc=await call("ssm",["get-document","--name",policy.documentName,"--document-version",policy.documentVersion,"--document-format","JSON"]);
        if(doc.Name!==policy.documentName || doc.DocumentVersion!==policy.documentVersion || doc.DocumentType!=="Command" || doc.Status!=="Active" || typeof doc.Content!=="string" || digest(doc.Content)!==policy.documentSha256)throw Error();
        if(Array.isArray(doc.AttachmentsContent) && doc.AttachmentsContent.length || Array.isArray(description.Requires) && description.Requires.length)throw Error();validateSsmContent(doc.Content);
        const object=await call("s3api",["head-object","--bucket",policy.bucket,"--key",approval.objectKey,"--version-id",approval.objectVersion,"--checksum-mode","ENABLED","--expected-bucket-owner",policy.accountId]);
        if(object.VersionId!==approval.objectVersion || object.ChecksumSHA256!==Buffer.from(approval.artifactSha256,"hex").toString("base64") || !Number.isSafeInteger(object.ContentLength) || object.ContentLength<1 || object.ContentLength>1048576)throw Error();
        const parameters=canonicalJson({Approval:[Buffer.from(canonicalJson(runtime.approval)).toString("base64")]});
        const sent=await call("ssm",["send-command","--document-name",`arn:aws:ssm:${policy.region}:${policy.accountId}:document/${policy.documentName}`,"--document-version",policy.documentVersion,
            "--document-hash",policy.documentSha256,"--document-hash-type","Sha256","--instance-ids",policy.instanceId,"--parameters",parameters,"--timeout-seconds","120","--max-concurrency","1","--max-errors","0"]);
        const command=sent.Command;if(!command || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(command.CommandId) || canonicalJson(command.InstanceIds)!==canonicalJson([policy.instanceId]))throw Error();
        const result:Ec2Result={status:"SUBMITTED",code:"SSM_COMMAND_SUBMITTED_RUNTIME_PENDING",approvalId:id,commandId:command.CommandId};
        await runtime.claim(path.join(runtime.stateDirectory,id+".result.json"),Buffer.from(canonicalJson(result)));return result;
    }catch{return{status:claimed?"UNKNOWN":"DENIED",code:claimed?"OWNER_RECONCILIATION_REQUIRED":"TRUST_APPROVAL_OR_SINGLE_USE_REFUSED",...(id?{approvalId:id}:{})};}
}
export async function runOwnerEc2Operation(id:string,revoke=false):Promise<Ec2Result>{
    try{
        if(__filename!=="/opt/soterai-owner/owner-broker.cjs" || !/^[a-f0-9]{32}$/.test(id))throw Error();await assertRootOwned(__filename);
        const configFile="/etc/soterai/ec2-broker.json";await assertRootOwned(configFile);const config=JSON.parse((await readStable(configFile)).toString());
        exactObject(config,["policyFile","approvalsDirectory","stateDirectory","awsExecutable"]);
        for(const key of ["policyFile","awsExecutable"]){if(typeof config[key]!=="string")throw Error();await assertRootOwned(config[key] as string);}
        for(const key of ["approvalsDirectory","stateDirectory"]){if(typeof config[key]!=="string")throw Error();await assertRootOwned(config[key] as string,true);}
        const approvalFile=path.join(config.approvalsDirectory as string,id+".json");await assertRootOwned(approvalFile);
        if(revoke){await durableCreate(path.join(config.stateDirectory as string,id+".decision.json"),Buffer.from('{"status":"revoked"}'));return{status:"DENIED",code:"APPROVAL_REVOKED",approvalId:id};}
        return await executeApprovedEc2Operation({operation:"ec2.deploy",approvalId:id},{policy:JSON.parse((await readStable(config.policyFile as string)).toString()),approval:JSON.parse((await readStable(approvalFile)).toString()),
            stateDirectory:config.stateDirectory as string,awsExecutable:config.awsExecutable as string,assertTrusted:async()=>{await assertRootOwned(configFile);await assertRootOwned(config.stateDirectory as string,true);},runner:boundedProcess,claim:durableCreate,credentialEnvironment:process.env});
    }catch{return{status:"DENIED",code:"TRUSTED_LINUX_OWNER_INSTALLATION_REQUIRED"};}
}
