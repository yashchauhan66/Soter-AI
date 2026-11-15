import * as fs from "node:fs/promises";
import path from "node:path";
import { safeRelativePath, SecretContentScanner } from "@soterai/guard-core";
import { assertRootOwned, canonicalJson } from "./ecs";
import { validateEc2Approval, validateEc2Policy } from "./ec2";
import { boundedProcess, digest, durableCreate, exactObject, readStable } from "../security/bounded";

export function admitNodeArtifact(bytes:Buffer,expectedSource?:string):{sourceSha:string;code:Buffer}{
    if(bytes.length>1048576)throw Error();const artifact=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));exactObject(artifact,["schemaVersion","sourceSha","entry","base64"]);
    if(artifact.schemaVersion!==1 || typeof artifact.sourceSha!=="string" || !/^[a-f0-9]{40}$/.test(artifact.sourceSha) || expectedSource && artifact.sourceSha!==expectedSource
        || artifact.entry!=="app.bundle.cjs" || !safeRelativePath(artifact.entry) || typeof artifact.base64!=="string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(artifact.base64))throw Error();
    const code=Buffer.from(artifact.base64,"base64");if(code.length<1 || code.length>131072)throw Error();const text=new TextDecoder("utf-8",{fatal:true}).decode(code),scan=new SecretContentScanner().scan(text);
    if(text.includes("\0") || !scan.complete || scan.findings.length)throw Error();return{sourceSha:artifact.sourceSha,code};
}
async function install():Promise<object>{
    let claimed=false;
    try{
        if(__filename!=="/opt/soterai-owner/ec2-install.cjs")throw Error();await assertRootOwned(__filename);
        const policyFile="/etc/soterai/ec2-policy.json",state="/var/lib/soterai-ec2-installer",releases="/opt/soterai-approved/releases";
        await assertRootOwned(policyFile);await assertRootOwned(state,true);await assertRootOwned(releases,true);
        const policy=validateEc2Policy(JSON.parse((await readStable(policyFile)).toString())),encoded=process.env.SSM_Approval;
        if(typeof encoded!=="string" || encoded.length>8192 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw Error();
        const approval=validateEc2Approval(JSON.parse(Buffer.from(encoded,"base64").toString("utf8")),policy,Date.now());
        await durableCreate(path.join(state,approval.approvalId+".decision.json"),Buffer.from(canonicalJson({status:"claimed",approvalDigest:digest(encoded)})));claimed=true;
        const configFile="/etc/soterai/ec2-installer.json";await assertRootOwned(configFile);const config=JSON.parse((await readStable(configFile)).toString());exactObject(config,["awsExecutable"]);
        if(typeof config.awsExecutable!=="string")throw Error();await assertRootOwned(config.awsExecutable);
        const target=path.join(state,approval.approvalId+".artifact.json");
        await boundedProcess({executable:config.awsExecutable,args:["s3api","get-object","--bucket",policy.bucket,"--key",approval.objectKey,"--version-id",approval.objectVersion,
            "--expected-bucket-owner",policy.accountId,"--region",policy.region,"--endpoint-url",`https://s3.${policy.region}.amazonaws.com`,"--no-cli-pager",target],
            env:{PATH:"/usr/bin:/bin",LANG:"C.UTF-8",AWS_CONFIG_FILE:"/dev/null",AWS_SHARED_CREDENTIALS_FILE:"/dev/null",AWS_EC2_METADATA_DISABLED:"false",AWS_MAX_ATTEMPTS:"1",AWS_PAGER:""},timeoutMs:30000});
        const bytes=await readStable(target,1048576);if(digest(bytes)!==approval.artifactSha256 || Date.now()>=approval.expiresAt)throw Error();const artifact=admitNodeArtifact(bytes);
        const release=path.join(releases,approval.artifactSha256);await fs.mkdir(release,{mode:0o755});await durableCreate(path.join(release,"app.bundle.cjs"),artifact.code);
        await fs.chmod(path.join(release,"app.bundle.cjs"),0o444);
        const base="/opt/soterai-approved";await assertRootOwned(base,true);
        const current=path.join(base,"current");try{const st=await fs.lstat(current);if(!st.isSymbolicLink() || st.uid!==0)throw Error();}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
        const staged=path.join(base,"current-"+approval.approvalId);await fs.symlink(release,staged,"dir");await fs.rename(staged,current);
        await boundedProcess({executable:"/usr/bin/systemctl",args:["restart","soterai-approved-app.service"],env:{PATH:"/usr/bin:/bin",LANG:"C.UTF-8"},timeoutMs:30000,maxOutputBytes:65536});
        const result={status:"SUBMITTED",code:"SERVICE_RESTARTED_HEALTH_PENDING",approvalId:approval.approvalId,artifactSha256:approval.artifactSha256};
        await durableCreate(path.join(state,approval.approvalId+".result.json"),Buffer.from(canonicalJson(result)));return result;
    }catch{return{status:claimed?"UNKNOWN":"DENIED",code:claimed?"OWNER_RECONCILIATION_REQUIRED":"TRUST_OR_APPROVAL_REFUSED"};}
}
if(process.argv[1]===__filename)install().then(result=>{process.stdout.write(JSON.stringify(result)+"\n");process.exitCode=(result as {status:string}).status==="SUBMITTED"?0:2;})
    .catch(()=>{process.stdout.write('{"status":"UNKNOWN","code":"OWNER_RECONCILIATION_REQUIRED"}\n');process.exitCode=2;});
