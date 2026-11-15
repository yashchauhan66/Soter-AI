import { runOwnerEc2Operation } from "./ec2";
import { runOwnerOperation } from "./ecs";
const [operation,id,...extra]=process.argv.slice(2);
if(extra.length || !["ec2-deploy","ec2-revoke","ecs-deploy","ecs-revoke"].includes(operation) || !/^[a-f0-9]{32}$/.test(id??"")){
    process.stdout.write('{"status":"DENIED","code":"INVALID_FIXED_OPERATION"}\n');process.exitCode=2;
}else{
    const action=operation.startsWith("ec2-")?runOwnerEc2Operation:runOwnerOperation;
    action(id,operation.endsWith("revoke")).then(result=>{process.stdout.write(JSON.stringify(result)+"\n");process.exitCode=result.status==="SUBMITTED" || result.code==="APPROVAL_REVOKED"?0:2;})
        .catch(()=>{process.stdout.write('{"status":"UNKNOWN","code":"OWNER_RECONCILIATION_REQUIRED"}\n');process.exitCode=2;});
}
