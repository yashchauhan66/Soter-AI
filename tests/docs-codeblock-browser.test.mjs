import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const require = createRequire(resolve(root, "package.json"));
const { build } = require("esbuild");
const { chromium } = require("playwright");
const source = resolve(root, "components/ui/CodeBlock.tsx");
const out = resolve(process.env.DOCS_TEST_OUTPUT || resolve(process.env.TMPDIR || root, "soter-docs-codeblock-qa"));
mkdirSync(out, {recursive:true});
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const before = readFileSync(source);
const sample = 'export const sample = "local UI fixture";\n\n// Keep the trailing newline\n';
const compiled = await build({
  stdin: {contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {CodeBlock} from ${JSON.stringify(source)}; createRoot(document.getElementById('app')).render(<CodeBlock title="guard.ts" language="typescript" showLineNumbers>{${JSON.stringify(sample)}}</CodeBlock>);`, loader:"tsx", resolveDir:root, sourcefile:"codeblock-browser-fixture.tsx"},
  bundle:true, write:false, platform:"browser", format:"iife", metafile:true, outfile:resolve(out,"fixture.js"),
  define:{"process.env.NODE_ENV":'"production"'},
});
const bundle = compiled.outputFiles.find(file=>file.path.endsWith(".js")).contents;
const stylesheet = compiled.outputFiles.find(file=>file.path.endsWith(".css"))?.contents ?? "";
const server=createServer((request,response)=>{
  if (request.url === "/bundle.js") {response.writeHead(200,{"content-type":"text/javascript"});response.end(bundle);}
  else if (request.url === "/bundle.css") {response.writeHead(200,{"content-type":"text/css"});response.end(stylesheet);}
  else if (request.url === "/") {response.writeHead(200,{"content-type":"text/html"});response.end('<!doctype html><html lang="en"><title>Isolated CodeBlock QA fixture</title><link rel="stylesheet" href="/bundle.css"><body><main id="app"></main><script src="/bundle.js"></script></body></html>');}
  else {response.writeHead(404);response.end();}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1366,height:900}});
await context.route('**/*',route=>route.request().url().startsWith(base)&&route.request().method()==='GET'?route.continue():route.abort());
const page=await context.newPage();
const rows=[]; const pageErrors=[];
page.on("pageerror",error=>pageErrors.push(String(error)));
async function check(name,fn){try{rows.push({name,passed:true,details:await fn()});}catch(error){rows.push({name,passed:false,error:String(error)});}}
try {
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async(text)=>{if(window.__denyCopy)throw new Error("Clipboard denied by QA fixture");window.__copiedText=text;}}});
    document.execCommand=()=>false;
    window.__denyCopy=true;
  });
  await page.goto(base,{waitUntil:"networkidle"});
  await check("clipboard failure is not announced as success",async()=>{
    await page.getByRole("button",{name:"Copy code",exact:true}).click();
    const status=await page.getByRole("status").textContent();
    assert.match(status,/copy failed|could not copy|unable to copy/i);
    assert.doesNotMatch(status,/copied to clipboard/i);
    return {status};
  });
  await check("explicit filename remains visible beside the language",async()=>{
    assert.equal(await page.getByText("guard.ts",{exact:true}).isVisible(),true);
    return {filename:"guard.ts"};
  });
  await check("copy failure is visibly recoverable",async()=>{
    const height=await page.getByRole("status").evaluate(element=>element.getBoundingClientRect().height);
    assert.ok(height>=20,`Error message is visually hidden: ${height}px`); return {height};
  });
  await check("retry copies exact source without displayed line numbers",async()=>{
    await page.evaluate(()=>{window.__denyCopy=false;});
    await page.getByRole("button",{name:"Copy code",exact:true}).click();
    assert.equal(await page.evaluate(()=>window.__copiedText),sample);
    assert.equal(await page.getByRole("status").textContent(),"Copied to clipboard");
    assert.equal(await page.locator(".code-block-line-number").evaluateAll(nodes=>nodes.every(node=>node.getAttribute("aria-hidden")==="true")),true);
    return {exactSource:true,trailingNewlineRetained:true};
  });
  await check("vertical-only code overflow remains keyboard reachable",async()=>{
    const pre=page.locator("pre");
    await pre.evaluate(element=>{element.style.maxHeight="48px";element.style.overflowY="auto";});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const geometry=await pre.evaluate(element=>({scrollWidth:element.scrollWidth,clientWidth:element.clientWidth,scrollHeight:element.scrollHeight,clientHeight:element.clientHeight,tabindex:element.getAttribute("tabindex")}));
    assert.ok(geometry.scrollHeight>geometry.clientHeight+1,"Fixture must genuinely overflow vertically");
    assert.ok(geometry.scrollWidth<=geometry.clientWidth+1,"Fixture must not overflow horizontally");
    assert.equal(geometry.tabindex,"0","A vertical code scroller must be in the keyboard tab order");
    await page.locator(".code-block-copy").focus();
    await page.keyboard.press("Tab");
    assert.equal(await pre.evaluate(element=>document.activeElement===element),true);
    await page.keyboard.press("ArrowDown");
    await page.waitForFunction(()=>document.querySelector("pre").scrollTop>0);
    return geometry;
  });
  await check("a fully visible code block does not retain an extra tab stop",async()=>{
    const pre=page.locator("pre");
    await pre.evaluate(element=>{element.style.maxHeight="";element.style.overflowY="";});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await pre.getAttribute("tabindex"),null);
    assert.equal(await pre.getAttribute("role"),null);
    return {extraTabStop:false};
  });
} finally {
  const observed={source,sourceHash:sha(before),sourceUnchanged:sha(before)===sha(readFileSync(source)),bundleHash:sha(bundle),consumedInputs:Object.keys(compiled.metafile.inputs),browser:browser.version(),base,viewport:{width:1366,height:900},tests:rows,pageErrors};
  writeFileSync(resolve(out,"observed.json"),JSON.stringify(observed,null,2));
  writeFileSync(resolve(out,"CodeBlock.source.txt"),before);
  await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));
  console.log(JSON.stringify({out, sourceHash:observed.sourceHash, sourceUnchanged:observed.sourceUnchanged, consumedOwnedInputs:observed.consumedInputs.filter(path=>!path.startsWith("node_modules/")), tests:rows, pageErrors}));
  if(rows.some(row=>!row.passed)||pageErrors.length||!observed.sourceUnchanged||rows.length===0)process.exitCode=1;
}
