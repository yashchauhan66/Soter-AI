import assert from "node:assert/strict";
import {test} from "node:test";
import * as fs from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {admitNodeArtifact} from "../operations/ec2-install";
import {scanDirectory} from "../ci/scan";
import {digest} from "../security/bounded";
const exec=promisify(execFile),source="a".repeat(40),repo=path.resolve(__dirname,"../../../..");
const artifact=(code:string,extra:object={})=>Buffer.from(JSON.stringify({schemaVersion:1,sourceSha:source,entry:"app.bundle.cjs",base64:Buffer.from(code).toString("base64"),...extra})+"\n");
test("server admits useful Node bytes but refuses raw secrets, traversal and extra fields",()=>{
    assert.equal(admitNodeArtifact(artifact("console.log('public')"),source).code.toString(),"console.log('public')");
    for(const bad of [artifact("DB_PASSWORD=BlueMango7!"),artifact("public",{entry:"../private"}),artifact("public",{secret:"private"}),artifact("x".repeat(131073))])assert.throws(()=>admitNodeArtifact(bad,source));
    assert.throws(()=>admitNodeArtifact(artifact("public"),"b".repeat(40)));
});
test("fresh final admission binds decoded bytes, report and source before publication",async()=>{
    const root=await fs.mkdtemp(path.join(tmpdir(),"soterai-delivery-")),file=path.join(root,"artifact.json"),tree=path.join(root,"scan"),reportFile=path.join(root,"report.json"),outputs=path.join(root,"github-output");
    await fs.writeFile(file,artifact("console.log('useful public project')"));const script=path.join(repo,"examples/aws-soterai/delivery.cjs"),env={...process.env,EXPECTED_SOURCE_SHA:source,GITHUB_OUTPUT:outputs};
    await exec(process.execPath,[script,"prepare",file,tree],{env});const report=await scanDirectory(tree,{mode:"artifact"});await fs.writeFile(reportFile,JSON.stringify(report));
    await exec(process.execPath,[script,"seal",file,reportFile,tree],{env});assert.ok((await fs.readFile(outputs,"utf8")).includes("artifact_sha256="+digest(await fs.readFile(file))));
    const staged=path.join(root,"upload");await exec(process.execPath,[script,"stage",file,reportFile,staged],{env});
    assert.deepEqual((await fs.readdir(staged)).sort(),["artifact-report.json","artifact.json"]);
    assert.equal(digest(await fs.readFile(path.join(staged,"artifact.json"))),digest(await fs.readFile(file)));
    await fs.appendFile(path.join(tree,"app.bundle.cjs"),"changed");await assert.rejects(exec(process.execPath,[script,"seal",file,reportFile,tree],{env}));
    await fs.writeFile(reportFile,JSON.stringify({...report,status:"incomplete"}));await assert.rejects(exec(process.execPath,[script,"seal",file,reportFile,tree],{env}));
});
test("workflow isolates credentials and runs final admission on a fresh runner",async()=>{
    const yaml=await fs.readFile(path.join(repo,".github/workflows/soterai-aws-ec2.yml"),"utf8"),parse=require("yaml").parse,workflow=parse(yaml),jobs=workflow.jobs;
    assert.ok(workflow.on.workflow_dispatch);assert.equal(jobs.publish.environment,"soterai-aws-ec2");assert.equal(jobs.publish.permissions["id-token"],"write");
    assert.ok(!JSON.stringify(jobs.build).includes("configure-aws-credentials"));assert.ok(!JSON.stringify(jobs.admit).includes("configure-aws-credentials"));assert.equal(jobs.admit.needs,"build");
    const steps=jobs.publish.steps,credentials=steps.findIndex((s:any)=>s.uses?.startsWith("aws-actions/configure-aws-credentials@")),verification=steps.findIndex((s:any)=>s.run?.includes("delivery.cjs verify"));
    assert.ok(verification>=0 && credentials>verification);assert.ok(!steps.slice(credentials).some((s:any)=>/npm |docker run|docker start|ssh /.test(s.run??"")));
    assert.ok(jobs.publish.if.includes("inputs.approved_artifact_sha256 == needs.admit.outputs.artifact_sha256"));
});
