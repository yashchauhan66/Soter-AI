'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),own=n=>path.join(__dirname,n),file=n=>path.join(repo,n);
const done=JSON.parse(fs.readFileSync(own('integrated-sharded-result-02.json'),'utf8'));assert.equal(done.status,'F31B_SHARDED_FULL_READINESS_PACKAGE_CLOSED_CONTENT_NATIVE_PENDING');
function change(name,from,to){const p=file(name),text=fs.readFileSync(p,'utf8');assert.equal(text.split(from).length,2,name);fs.writeFileSync(p,text.replace(from,()=>to));}
const prior='Enable AutoVaultMigration: scan the workspace on startup for sensitive files (.env*, *.pem, etc.) that contain raw secrets and offer to migrate them to the encrypted vault. This is the only protection that works against CLI-based agents (Claude Code, Codex) that read files directly from disk.';
const next='Offer reviewed vault migration for detected values in sensitive workspace files (.env*, *.pem, etc.). Successfully migrated selected values become placeholders in the current saved files. Other copies, unknown values and independent same-user reads remain outside this protection.';
for(const p of ['packages/vscode-extension/package.json','packages/soterai-lite/package.json'])change(p,prior,next);
fs.writeFileSync(file('packages/soterai-lite/media/walkthrough/integrate.md'),'# Secure supported AI tools\n\nSoterAI can find supported local AI client configurations and propose routing them through local checking.\n\nReview every proposed change before it is written. Approved configuration backups are encrypted outside your workspace. **Undo AI Tool Security Changes** offers reviewed recovery; changed ownership or file bytes can prevent restoration. Keep the recovery receipts and review pending changes before removing the extension.\n\nSupported managed traffic routed through SoterAI can be inspected before forwarding. Check each route\'s Gateway, Vendor-controls-only or Uncovered status. Independent tools and same-user processes can use other paths.\n');
change('packages/soterai-lite/media/walkthrough/vault.md','That means AI tools and CLI agents that read files directly see placeholders instead of secret values.','After a successful migration, direct readers see placeholders for the selected migrated values in those current saved files. Other copies, values not detected or selected, inherited environments and independent same-user processes remain outside this protection.');
const auditor='packages/soterai-lite/scripts/audit-release.cjs';
const old="function finalXml(raw){const text=raw.replace(/<!--[\\s\\S]*?-->/g,'');demand(!/<!/.test(text),'Unsupported final XML construct');return text;}";
const replacement=`function finalXml(raw){
 const text=raw.replace(/<!--[\\s\\S]*?-->/g,'');demand(!/<!/.test(text),'Unsupported final XML construct');
 // The installed packager uses this same bounded, local SAX dependency through xml2js.
 // Regex extraction below supplies contract checks only after document admission.
 const parser=require('sax').parser(true,{xmlns:true});let depth=0,roots=0;
 parser.onerror=()=>{throw new Error('Malformed final XML');};
 parser.onopentag=()=>{if(depth++===0)roots++;demand(roots===1,'Malformed final XML document roots');};
 parser.onclosetag=()=>{depth--;demand(depth>=0,'Malformed final XML nesting');};
 parser.ontext=value=>demand(depth>0||value.trim()==='','Malformed final XML outside root');
 parser.write(raw).close();demand(depth===0&&roots===1,'Malformed final XML document');return text;
}`;
change(auditor,old,replacement);
change(auditor,"const xml=final?finalXml(decode(entries.get('extension.vsixmanifest'))):decode(entries.get('extension.vsixmanifest'));","if(final)finalXml(decode(entries.get('[Content_Types].xml')));\n const xml=final?finalXml(decode(entries.get('extension.vsixmanifest'))):decode(entries.get('extension.vsixmanifest'));");
const cases=`
for(const [id,mutate]of [
 ['unclosed tail',s=>s+'<unclosed'],
 ['second document root',s=>s+'<Second/>'],
 ['undeclared entity',s=>s.replace('</Metadata>','<DisplayName>&unknown;</DisplayName></Metadata>')]
])test('B10 malformed final XML refuses '+id,async()=>{
 const f=await fixture(x=>x.entries.set('extension.vsixmanifest',Buffer.from(mutate(x.entries.get('extension.vsixmanifest').toString()))));
 await assert.rejects(api().auditFinalRelease(f.options),/XML|xml|malformed/i);
});
`;
fs.appendFileSync(file('packages/soterai-lite/scripts/__tests__/release-package.test.cjs'),cases);
console.log('APPLIED: bounded XML document admission, three regression cases and reviewed claim wording. No runtime protection code changed; current object now requires source-proof03 and a new unique package.');
