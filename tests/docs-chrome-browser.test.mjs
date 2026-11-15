import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root=process.cwd();
const require=createRequire(resolve(root,"package.json"));
const {chromium}=require("playwright");
const base=process.env.DOCS_QA_BASE || "http://127.0.0.1:3102";
const out=resolve(process.env.DOCS_TEST_OUTPUT || resolve(process.env.TMPDIR || root,"soter-docs-chrome-qa"));
mkdirSync(out,{recursive:true});
const files=["components/layout/SiteChrome.tsx","components/docs/DocsPageShell.tsx","components/docs/docs.css","app/globals.css","app/docs/page.tsx","app/pricing/page.tsx","components/sa/PricingPlans.tsx"];
const hash=path=>createHash("sha256").update(readFileSync(resolve(root,path))).digest("hex");
const sourceHashes=Object.fromEntries(files.map(path=>[path,hash(path)]));
const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.route("**/*",route=>["GET","HEAD","OPTIONS"].includes(route.request().method())?route.continue():route.abort());
const page=await context.newPage(); const rows=[]; const errors=[];
page.on("pageerror",error=>errors.push(String(error)));
async function check(name,fn){try{rows.push({name,passed:true,details:await fn()});}catch(error){rows.push({name,passed:false,error:String(error)});}}
try {
  await page.goto(`${base}/docs/js`,{waitUntil:"networkidle",timeout:90000});
  await check("the docs header aligns with the workspace navigation edge",async()=>{
    const observed=await page.evaluate(()=>{
      const workspace=document.querySelector(".docs-workspace");const box=workspace.getBoundingClientRect();
      return {brandLeft:document.querySelector('header a[aria-label="soterai.in home"]').getBoundingClientRect().left,workspaceLeft:box.left+parseFloat(getComputedStyle(workspace).paddingLeft)};
    });
    assert.ok(Math.abs(observed.brandLeft-observed.workspaceLeft)<2,JSON.stringify(observed));return observed;
  });
  await check("a guide has one breadcrumb schema rather than two conflicting trails",async()=>{
    const count=await page.evaluate(()=>[...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(node=>{try{const data=JSON.parse(node.textContent);return Array.isArray(data)?data:data["@graph"]??[data];}catch{return [];}}).filter(item=>item["@type"]==="BreadcrumbList").length);
    assert.equal(count,1);return {count};
  });
  await page.goto(`${base}/docs`,{waitUntil:"networkidle",timeout:90000});
  await check("the docs hub has exactly one canonical breadcrumb trail",async()=>{
    const count=await page.evaluate(()=>[...document.querySelectorAll('script[type="application/ld+json"]')].flatMap(node=>{try{const data=JSON.parse(node.textContent);return Array.isArray(data)?data:data["@graph"]??[data];}catch{return [];}}).filter(item=>item["@type"]==="BreadcrumbList").length);
    assert.equal(count,1);return {count};
  });
  await page.goto(`${base}/pricing`,{waitUntil:"networkidle",timeout:90000});
  await check("the live pricing comparison covers all five offered plans",async()=>{
    const observed=await page.locator('section[aria-labelledby="compare"] thead th').allTextContents();
    assert.deepEqual(observed,["Compare","Free","Starter","Pro","Agency","Enterprise"]);return {columns:observed};
  });
} finally {
  const sourceUnchanged=files.every(path=>hash(path)===sourceHashes[path]);
  const observed={base,viewport:{width:1440,height:1000},browser:browser.version(),sourceHashes,sourceUnchanged,tests:rows,errors};
  writeFileSync(resolve(out,"observed.json"),JSON.stringify(observed,null,2));
  await context.close();await browser.close();console.log(JSON.stringify({out,...observed}));
  if(rows.some(row=>!row.passed)||errors.length||!sourceUnchanged||rows.length!==4)process.exitCode=1;
}
