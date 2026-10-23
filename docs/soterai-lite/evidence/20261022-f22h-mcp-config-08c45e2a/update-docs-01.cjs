'use strict';
const e=require('./evidence-lib-01.cjs'),section=e.bytes(e.own('docs-section-01.md')).toString('utf8');
for(const name of ['packages/vscode-extension/README.md','packages/soterai-lite/README.md']){
 const file=e.path.join(e.repo,name),old=e.bytes(file);e.fs.writeFileSync(e.own(name.replaceAll('/','-')+'.before-docs-01.txt'),old,{flag:'wx'});let text=old.toString('utf8');
 e.assert(!text.includes('### Project MCP configuration review'));
 if(name.includes('vscode-extension')){e.assert.equal(text.split('The 77 safety-relevant settings').length,2);text=text.replace('The 77 safety-relevant settings','The 78 safety-relevant settings');}
 e.fs.writeFileSync(file,text+section);
}
const name='packages/soterai-lite/CHANGELOG.md',file=e.path.join(e.repo,name),old=e.bytes(file);e.fs.writeFileSync(e.own('CHANGELOG.before-docs-01.txt'),old,{flag:'wx'});
const text=old.toString('utf8');e.assert(text.startsWith('# Changelog'));e.fs.writeFileSync(file,text.replace('# Changelog','# Changelog\n\n- Add owner-reviewed project MCP JSONC/finite TOML secret scanning, strict machine withdrawal, keyed findings and canonical encrypted checkpoint-only migration/disclosure. Preserve exact reference controls; duplicate/unsupported syntax withholds. No config application, variable resolution, MCP client/server execution, global profile scan or new dependency.'));
const source='packages/vscode-extension/src/config-scanners/EditorSecretPlan.ts',sourceFile=e.path.join(e.repo,source),sourceText=e.bytes(sourceFile).toString('utf8');e.assert.equal(sourceText.split('const UUID = ').length,2);e.fs.writeFileSync(sourceFile,sourceText.replace(/^const UUID = .*\r?\n/m,''));
for(const name of ['packages/vscode-extension/src/firewall/VaultManager.ts','packages/vscode-extension/src/hygiene/HygieneAnalysis.ts']){const file=e.path.join(e.repo,name),s=e.bytes(file).toString('utf8');e.assert(s.startsWith('import { mcpFormatForPath, MCP_WORKSPACE_GLOBS }'));e.fs.writeFileSync(file,s.replace('import { mcpFormatForPath, MCP_WORKSPACE_GLOBS }','import { mcpFormatForPath }'));}
console.log('MCP scope/recovery/limits documented; machine count78 and unused extraction imports tidied.');
