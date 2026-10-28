'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const own=n=>path.join(__dirname,n);let text=fs.readFileSync(own('run-code-renderer-observer-01.cjs'),'utf8');
const before='await page.keyboard.type(query, { delay: 5 }); await page.keyboard.press("Enter");';
assert(text.includes(before));text=text.replace(before,'await page.keyboard.type(query, { delay: 5 });\n            await until(async () => { const widget = page.locator(".quick-input-widget"); if (!await widget.isVisible()) return false; const labels = (await widget.innerText()).replace(/\\s+/g, " "); return labels.includes(query.replace(/\\s+/g, " ")); }, 8000, "Actual command palette result not observed before Enter");\n            await page.keyboard.press("Enter");');
fs.writeFileSync(own('run-code-renderer-observer-02.cjs'),text,{flag:'wx'});console.log('Prepared actual-palette-result observation before Enter; no Code/browser launch.');
