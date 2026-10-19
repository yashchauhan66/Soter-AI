const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),base=__dirname;
const write=(name,text)=>fs.writeFileSync(path.join(base,name),text,{flag:"wx"});
let driver=fs.readFileSync(path.join(base,"product-matrix-01.cjs"),"utf8");
const hook='row.event=body.hook_event_name;row.tool=body.tool_name;row.fields=Object.keys(body).sort();';
assert.equal(driver.split(hook).length,2);
driver=driver.replace(hook,hook+'row.permissionMode=typeof body.permission_mode==="string"&&body.permission_mode.length<=32?body.permission_mode:"OTHER";row.effort=body.effort===null?null:typeof body.effort==="string"&&body.effort.length<=16?body.effort:typeof body.effort;row.inputFields=body.tool_input&&typeof body.tool_input==="object"?Object.keys(body.tool_input).sort():undefined;');
const anchor='assert.equal(records.configureStatus,"APPLIED","Dependent native routes require current product setup");';
assert.equal(driver.split(anchor).length,2);
driver=driver.replace(anchor,anchor+[
 'records.controllerStages=[];const adapter=context.subscriptions.find(item=>typeof item.configure==="function"&&typeof item.status==="function"&&item.status()?.version==="2.1.301");',
 'if(adapter)for(const name of["projectEligible","read","artifact"]){const original=adapter[name];if(typeof original!=="function")continue;adapter[name]=async function(...args){try{const result=await Reflect.apply(original,this,args);if(records.controllerStages.length<500)records.controllerStages.push({phase,method:name,file:name==="read"?path.basename(args[0]):undefined,result:typeof result==="boolean"?result:typeof result==="string"?"STRING_"+Buffer.byteLength(result):typeof result});return result;}catch(error){records.controllerStages.push({phase,method:name,error:safeError(error)});throw error;}};}'
].join("\n"));
const after='await check("F19-N05",async()=>';
assert.equal(driver.split(after).length,2);
driver=driver.replace(after,'if(records.checks.some(item=>item.id==="F19-N04"&&item.status!=="PASS"))throw Error("Diagnostic stops dependent routes after public native failure");\n'+after);
write("product-matrix-02.cjs",driver);
let launcher=fs.readFileSync(path.join(base,"run-product-matrix-01.ps1"),"utf8").split("product-matrix-01.cjs").join("product-matrix-02.cjs");
write("run-product-matrix-02.ps1",launcher);
let binding=fs.readFileSync(path.join(base,"artifact-binding-01.ps1"),"utf8").split("-f18-").join("-f19-");write("artifact-binding-02.ps1",binding);
for(const name of["run-functional","run-security"]){const text=fs.readFileSync(path.join(base,name+"-01.ps1"),"utf8").split("artifact-binding-01.ps1").join("artifact-binding-02.ps1");write(name+"-02.ps1",text);}
let affected=fs.readFileSync(path.join(base,"run-affected-hosts-01.ps1"),"utf8").split("artifact-binding-01.ps1").join("artifact-binding-02.ps1").split("run-functional-01.ps1").join("run-functional-02.ps1").split("run-security-01.ps1").join("run-security-02.ps1");write("run-affected-hosts-02.ps1",affected);
let current=fs.readFileSync(path.join(base,"run-current-affected-01.ps1"),"utf8").split("run-affected-hosts-01.ps1").join("run-affected-hosts-02.ps1").split("affected-hosts-01.txt").join("affected-hosts-02.txt");write("run-current-affected-02.ps1",current);
console.log("Prepared metadata-only native diagnostic and F19 exact artifact binder; no product changes.");
