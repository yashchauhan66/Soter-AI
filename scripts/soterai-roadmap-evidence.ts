import * as fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {performance} from "node:perf_hooks";
import {SecretContentScanner} from "../packages/guard-core/src/SecretScanPolicy";
import {redactForSharing} from "../packages/guard-core/src/Redactor";
import {digest} from "../packages/soterai-cli/src/security/bounded";
const output=process.argv[2];if(!output)throw Error("New evidence directory required");
async function main(){
    const target=path.resolve(output);await fs.mkdir(target);
    const registered="heldout_registered_value_83472916",scanner=new SecretContentScanner([registered]);
    const positive=["DB_PASSWORD=MintHorizon8!",'POSTGRES_PASSWORD="QuietLemon9!"',registered,Buffer.from(registered).toString("base64"),"AKIA"+"Z".repeat(16)];
    const negative=["Document the password reset endpoint.","const passwordType = 'string';","GET /v1/public/status",redactForSharing('DB_PASSWORD="SyntheticControl8!"'),"The public Node application returns an HTTP status."];
    let detected=0,missed=0,falsePositive=0,incomplete=0;
    for(const input of positive){const r=scanner.scan(input);if(!r.complete)incomplete++;else if(r.findings.length)detected++;else missed++;}
    for(const input of negative){const r=scanner.scan(input);if(!r.complete)incomplete++;else if(r.findings.length)falsePositive++;}
    const timings:number[]=[],fixture="export function publicHandler(){ return {status:'ok'}; }\n".repeat(100);
    for(let i=0;i<10;i++)scanner.scan(fixture);
    for(let i=0;i<100;i++){const start=performance.now();scanner.scan(fixture);timings.push(performance.now()-start);}timings.sort((a,b)=>a-b);
    const result={schemaVersion:1,scope:"Local synthetic detector controls; not independent/provider/runtime acceptance",fixtureDigest:digest(JSON.stringify({positive,negative})),scannerVersion:scanner.version,
        positives:positive.length,negatives:negative.length,detected,missed,falsePositive,incomplete,performance:{iterations:timings.length,textBytes:Buffer.byteLength(fixture),meanMs:timings.reduce((a,b)=>a+b,0)/timings.length,p95Ms:timings[94],rssBytes:process.memoryUsage().rss},
        hardware:{platform:os.platform(),architecture:os.arch(),logicalCpuCount:os.cpus().length,totalMemoryBytes:os.totalmem()},releaseReady:false};
    await fs.writeFile(path.join(target,"result.json"),JSON.stringify(result,null,2)+"\n",{flag:"wx"});console.log(JSON.stringify(result));
}
main().catch(()=>{console.error("Synthetic evidence unavailable.");process.exitCode=2;});
