const fs=require('node:fs');
const file='packages/vscode-extension/src/ai-boundary/VersionedPolicy.ts';
const source=fs.readFileSync(file,'utf8');
const start=source.indexOf('/** Conservative project-local credential names'),end=source.indexOf('\nfunction object(');
if(start<0||end<=start)throw new Error('Catalog markers missing.');
let catalog=source.slice(start,end).replace('export const CREDENTIAL_PATTERNS','const authoredPatterns').replace('export const STACK_PRESETS','export const LITE_STACK_PRESETS');
const registryStart=catalog.indexOf('const authoredPatterns');
const presetStart=catalog.indexOf('export const LITE_STACK_PRESETS');
catalog=catalog.slice(0,registryStart)+catalog.slice(registryStart,presetStart)+
`\n// Legacy consumers retain their original registry. Expanded Lite defaults add\n// patterns at the shared policy authority, without forking extension-local globs.\nconst legacy = SENSITIVE_FILE_GLOBS.map(pattern => Object.freeze({ id: 'legacy:' + documentDigest(pattern).slice(0,12), pattern: pattern.toLowerCase(), family: 'legacyCredential', reason: 'Existing canonical credential filename or path; preserve earlier protection.', sample: sample(pattern) }));\nexport const LITE_CREDENTIAL_PATTERNS = Object.freeze([...legacy, ...authoredPatterns.filter(row => !legacy.some(existing => existing.pattern === row.pattern))]);\n\n`+catalog.slice(presetStart);
fs.writeFileSync('packages/guard-core/src/LitePolicyCatalog.ts',`import { createHash } from 'node:crypto';\nimport { SENSITIVE_FILE_GLOBS } from './sensitiveFiles';\nconst documentDigest = (text: string) => createHash('sha256').update(text).digest('hex');\n\n`+catalog+'\n',{flag:'wx'});
fs.writeFileSync(file,source.slice(0,start)+`export { LITE_CREDENTIAL_PATTERNS as CREDENTIAL_PATTERNS, LITE_STACK_PRESETS as STACK_PRESETS } from '@soterai/guard-core';\nimport { LITE_CREDENTIAL_PATTERNS as CREDENTIAL_PATTERNS, LITE_STACK_PRESETS as STACK_PRESETS } from '@soterai/guard-core';\n`+source.slice(end));
fs.appendFileSync('packages/guard-core/src/index.ts','\nexport * from "./LitePolicyCatalog";\n');
console.log(JSON.stringify({status:'CENTRALIZED_NOT_VERIFIED',legacyConsumerRegistry:'UNCHANGED',newAuthority:'packages/guard-core/src/LitePolicyCatalog.ts'}));
