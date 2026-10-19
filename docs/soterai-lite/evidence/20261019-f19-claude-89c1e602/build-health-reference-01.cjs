const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto"),esbuild=require("esbuild"),base=__dirname,repo=process.cwd();
const sourceFile=path.join(repo,"apps/local-ai-broker/src/BrokerServer.ts"),source=fs.readFileSync(sourceFile,"utf8");
const addition='\n                    || url.pathname === "/v1/lifecycle/status" || url.pathname === "/v1/gateway/status"';
assert.equal(source.split(addition).length,2);
const baseline=source.replace(addition,""),sha=value=>crypto.createHash("sha256").update(value).digest("hex");
const copy=path.join(base,"health-reference-before-01.ts.txt");fs.writeFileSync(copy,baseline,{flag:"wx"});
fs.writeFileSync(path.join(base,"claudeHealthBudget-frozen-02.ts.txt"),fs.readFileSync("packages/vscode-extension/src/__tests__/claudeHealthBudget.test.ts"),{flag:"wx"});
const output=path.join(base,"health-reference-before-01.cjs");assert(!fs.existsSync(output));
esbuild.build({absWorkingDir:repo,entryPoints:["packages/vscode-extension/src/__tests__/claudeHealthBudget.test.ts"],outfile:output,bundle:true,platform:"node",format:"cjs",sourcemap:false,
 plugins:[{name:"explicit-before-health-budget",setup(build){build.onLoad({filter:/[\\/]apps[\\/]local-ai-broker[\\/]src[\\/]BrokerServer\.ts$/},()=>({contents:baseline,loader:"ts",resolveDir:path.dirname(sourceFile)}));}}]}).then(()=>{
 const record={status:"BUILT_NOT_RUN_COUNTERFACTUAL_SOURCE_COPY",currentSha256:sha(source),referenceSha256:sha(baseline),bundleSha256:sha(fs.readFileSync(output)),changedFragment:addition,scope:"Only the two newly added liveness paths are removed in a retained diagnostic source copy; production source is not reverted. Corrected synthetic tokens meet the existing minimum."};
 fs.writeFileSync(path.join(base,"health-reference-build-01.json"),JSON.stringify(record,null,2)+"\n",{flag:"wx"});console.log(record.status);
}).catch(error=>{console.error(error);process.exitCode=1;});
