// Browser template checks of HTML captured from the real review host, not native VS Code screenshots.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=process.cwd(),out=path.join(root,'docs/project-privacy/evidence/20261012-final-local');
const input=path.join(root,process.argv[2] === 'final' ? '.tmp/pv-final/ui-review-final/workspace/privacy-dashboard-rendered.html' : '.tmp/pv-final/ui-review/workspace/privacy-dashboard-rendered.html');
const original=fs.readFileSync(input,'utf8');
const nonce=original.match(/<script nonce="([^"]+)"/)[1];
const mock=`<script nonce="${nonce}">window.messages=[];window.acquireVsCodeApi=()=>({postMessage:m=>window.messages.push(m),getState:()=>undefined,setState:()=>{}});</script>`;
const theme=light=>`<style nonce="${nonce}">:root{--vscode-editor-background:${light?'#ffffff':'#181818'};--vscode-foreground:${light?'#242424':'#e7e7e7'};--vscode-descriptionForeground:${light?'#555':'#b6b6b6'};--vscode-panel-border:${light?'#ddd':'#393939'};--vscode-button-background:#007acc;--vscode-button-foreground:#fff;--vscode-button-secondaryBackground:${light?'#eee':'#333'};--vscode-button-secondaryForeground:${light?'#222':'#eee'};--vscode-input-background:${light?'#f4f4f4':'#252525'};--vscode-input-foreground:${light?'#222':'#ddd'};--vscode-input-border:#777;--vscode-focusBorder:#0098ff;--vscode-font-family:Segoe UI,Arial,sans-serif}</style>`;
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});let passed=0;
try{for(const [name,width,light] of [['dark',1280,false],['light',1280,true],['narrow',420,false]]){
 const page=await browser.newPage({viewport:{width,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent(original.replace('</head>',mock+theme(light)+'</head>'));
 await page.waitForTimeout(100);
 assert.deepEqual(errors,[]);passed++;
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);passed++;
 const text=await page.locator('body').innerText();assert.ok(text.includes('Evidence: MATCHED')&&text.includes('Full claim: BLOCKED')&&text.includes(process.argv[2] === 'final' ? '790' : '789')&&text.includes('Not logged in'));passed++;
 assert.ok(text.indexOf('Does not cover')<text.indexOf('Managed safe reader configured'));passed++;
 assert.equal(await page.locator('tr[data-restriction]:visible').count(),25);passed++;
 await page.locator('#next-page').click();assert.equal(await page.locator('tr[data-restriction]:visible').count(),10);passed++;
 await page.locator('#previous-page').click();assert.equal(await page.locator('tr[data-restriction]:visible').count(),25);passed++;
 await page.locator('#restriction-search').fill('nonexistent-synthetic-filter');
 await page.locator('#restriction-treatment').selectOption('sensitive');
 assert.ok((await page.locator('#restriction-count').innerText()).includes('No matching'));passed++;
 await page.locator('[data-refresh]').focus();await page.keyboard.press('Enter');
 assert.deepEqual(await page.evaluate(()=>window.messages),[{type:'refresh'}]);passed++;
 await page.locator('#restriction-search').fill('');await page.locator('#restriction-treatment').selectOption('all');
 await page.screenshot({path:path.join(out,`dashboard-template-${name}.png`),fullPage:true});
 await page.locator('[data-action="reviewRead"]').click();
 assert.deepEqual(await page.evaluate(()=>window.messages),[{type:'refresh'},{type:'reviewRead'}]);
 assert.ok((await page.locator('#feedback').innerText()).includes('no success is confirmed'));passed++;
 await page.close();}
 const result={generatedAt:new Date().toISOString(),status:'PASS',passed,failed:0,
 scope:'30 browser template checks from actual host HTML; dark/light/narrow screenshots are not native editor captures or human UX approval.'};
 fs.writeFileSync(path.join(out,'visual-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
