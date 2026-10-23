'use strict';
const e=require('./evidence-lib-01.cjs');
const tests=['mcpSecretPlan','mcpScanner','mcpScannerCommands'].map(n=>'packages/vscode-extension/src/__tests__/'+n+'.test.ts');
const original=['config-scanners/EditorSecretPlan.ts','firewall/VaultMigrationPlan.ts','firewall/VaultManager.ts','hygiene/HygieneAnalysis.ts','hygiene/HygieneExposureLedger.ts','hygiene/HygieneController.ts','extension.ts'].map(n=>'packages/vscode-extension/src/'+n);
const missing=['McpSecretPlan.ts','McpScannerFlags.ts','mcpCommands.ts','JsoncSecretPlan.ts','McpTomlSyntax.ts'].map(n=>'packages/vscode-extension/src/config-scanners/'+n);
for(const p of missing)e.assert.equal(e.fs.existsSync(e.path.join(e.repo,p)),false,p);
e.assert.equal(e.git('rev-parse','HEAD').toString().trim(),'0ef608959e35ec72d2d490322cbfeef8884c6069');
e.write('baseline-inputs-01.json',{status:'TESTS_AUTHORED_BEFORE_IMPLEMENTATION',tests:tests.map(p=>e.fact(e.path.join(e.repo,p))),original:original.map(p=>e.fact(e.path.join(e.repo,p))),absent:missing});
console.log('Baseline inputs recorded; F22h implementation absent.');
