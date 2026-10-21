const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const prior = path.resolve(__dirname, '../20261020-f21-hygiene-4f8a1c92'), hash = b => crypto.createHash('sha256').update(b).digest('hex'), records = [];
function copy(source, target, transform = x => x) { const before = fs.readFileSync(path.join(prior, source)), after = Buffer.from(transform(before.toString('utf8'))); fs.writeFileSync(path.join(__dirname, target), after, { flag: 'wx' }); records.push({ source, originalSha256: hash(before), output: target, bytes: after.length, sha256: hash(after) }); }
const ownSources = [
 'packages/vscode-extension/src/config-scanners/SourceSecretPlan.ts', 'packages/vscode-extension/src/config-scanners/SourceScannerFlags.ts', 'packages/vscode-extension/src/config-scanners/commands.ts',
 'packages/vscode-extension/src/hygiene/HygieneCandidatePolicy.ts', 'packages/vscode-extension/src/hygiene/HygieneAnalysis.ts', 'packages/vscode-extension/src/hygiene/HygieneController.ts', 'packages/vscode-extension/src/hygiene/HygieneExposureLedger.ts',
 'packages/vscode-extension/src/firewall/VaultMigrationPlan.ts', 'packages/vscode-extension/src/firewall/VaultManager.ts', 'packages/vscode-extension/src/extension.ts',
 'packages/vscode-extension/src/__tests__/sourceSecretPlan.test.ts', 'packages/vscode-extension/src/__tests__/sourceScanner.test.ts', 'packages/vscode-extension/src/__tests__/sourceScannerCommands.test.ts', 'packages/vscode-extension/src/__tests__/host/liteSourceScanner.host.ts',
 'packages/vscode-extension/package.json', 'packages/soterai-lite/package.json', 'package-lock.json', 'packages/vscode-extension/README.md', 'packages/soterai-lite/README.md', 'packages/vscode-extension/LICENSE.md', 'packages/soterai-lite/LICENSE.md', 'packages/soterai-lite/CHANGELOG.md', 'docs/vscode-extension-readiness.md', 'docs/soterai-lite/FEATURE-QUEUE.json'
];
copy('evidence-lib-01.cjs', 'evidence-lib-01.cjs');
const rename = text => text.replaceAll('f21-', 'f22a-').replaceAll("feature:'F21'", "feature:'F22a'").replaceAll('f21-evidence', 'f22a-evidence').replaceAll('f21-commit', 'f22a-commit');
copy('verify-source-01.cjs', 'verify-source-01.cjs', rename);
copy('verify-transition-01.cjs', 'verify-transition-01.cjs', text => rename(text).replace("next:'F22'", "next:'F22b'"));
copy('prepare-index-02.cjs', 'prepare-index-01.cjs', original => {
 let text = rename(original).replace("const parent='af17da62e89fd72077c8bb06b937d302daefba58'", "const parent='499ca1142f5b9b9f5cb21948530868c4440053e0'");
 text = text.replace(/const ownSources=new Set\(\[[^\n]*\]\);/, 'const ownSources=new Set(' + JSON.stringify(ownSources) + ');');
 assert(text.includes('SourceSecretPlan.ts'));
 text = text.replace("const previous='docs/soterai-lite/evidence/20261020-f20c-gemini-cli-8a6d3e70'", "const previous='docs/soterai-lite/evidence/20261020-f21-hygiene-4f8a1c92'");
 const before = "const generated=new Map();for(const input of acceptance.inputs){if(!input.path.startsWith('packages/guard-core/dist/')&&!input.path.startsWith('packages/detectors/dist/'))continue;assert(input.path.endsWith('.js'));";
 const after = "const generated=new Map();for(const input of [...acceptance.inputs,...acceptance.parserInputs]){if(!input.path.startsWith('packages/guard-core/dist/')&&!input.path.startsWith('packages/detectors/dist/')&&!input.path.startsWith('node_modules/@babel/parser/'))continue;assert(input.path.endsWith('.js')||input.path==='node_modules/@babel/parser/package.json'||input.path==='node_modules/@babel/parser/LICENSE');";
 assert(text.includes(before)); text = text.replace(before, after);
 text = text.replace("git('ls-files','--',...sourceRoots,'packages/vscode-extension/package.json'", "git('ls-files','--',...sourceRoots,...ownSources,'packages/vscode-extension/package.json'");
 text = text.replace('F21 owner-reviewed heuristic hygiene, canonical vault and possible-exposure metadata', 'F22a declared static source strings and canonical comments, owner-reviewed canonical vault and possible-exposure metadata');
 assert(!text.includes('af17da62')); assert(!text.includes('20261020-f20c-gemini')); return text;
});
copy('snapshot-execution-01.cjs', 'snapshot-execution-01.cjs', original => {
 let text = original.replaceAll('f21-', 'f22a-').replaceAll('hygiene-native|affected-vault|retained-native', 'source-native|affected-hygiene|affected-vault|retained-native').replaceAll('hygiene-restart|peer-ready', 'source-restart|hygiene-restart|peer-ready');
 text = text.replace("path.join(output,name,relative+'.txt')", "path.join(output,name,relative.replaceAll(/[\\\\/]/g,'__')+'.txt')");
 assert(text.includes("relative.replaceAll")); return text;
});
fs.writeFileSync(path.join(__dirname, 'byte-tool-preparation-01.json'), JSON.stringify({ status: 'PREPARED_NOT_RUN', ownSources, records, scope: 'Exact explicit source allowlist; current source/native/evidence bytes and parser/runtime dependency snapshots. Existing F21 closure receipts retained. No unrelated work or node_modules staging.' }, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify({ status: 'PREPARED_NOT_RUN', helpers: records.length, ownSources: ownSources.length }));
