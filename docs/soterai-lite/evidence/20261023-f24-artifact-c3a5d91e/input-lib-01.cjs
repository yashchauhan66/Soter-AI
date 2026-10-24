'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const roots=['packages/vscode-extension/src','packages/vscode-extension/scripts','packages/core/src','packages/guard-core/src','packages/guard-core/dist','apps/local-ai-broker/src','packages/soterai-lite/src','packages/soterai-lite/scripts'];
const files=['package.json','package-lock.json','packages/vscode-extension/package.json','packages/vscode-extension/tsconfig.json','packages/vscode-extension/README.md','packages/core/package.json','packages/guard-core/package.json','packages/guard-core/tsconfig.json','packages/soterai-lite/package.json','packages/soterai-lite/README.md','packages/soterai-lite/CHANGELOG.md','docs/soterai-lite/LITE-CATALOG.json','docs/soterai-lite/MASTER-PROMPT-20261016.txt','docs/vscode-extension-readiness.md'];
function inventory(){const found=new Set(files);function walk(relative){for(const entry of fs.readdirSync(path.join(repo,relative),{withFileTypes:true})){const file=relative+'/'+entry.name;assert(!entry.isSymbolicLink(),'Input alias refused');if(entry.isDirectory())walk(file);else if(/\.(?:ts|js|mjs|cjs|json|map)$/.test(entry.name))found.add(file);}}for(const root of roots)walk(root);return [...found].sort();}
function fact(file){const bytes=fs.readFileSync(path.join(repo,file));return {path:file,bytes:bytes.length,sha256:sha(bytes)};}
function check(){const frozen=JSON.parse(fs.readFileSync(path.join(__dirname,'source-inputs-01.json'),'utf8'));assert.deepEqual(inventory(),frozen.records.map(row=>row.path));for(const row of frozen.records)assert.deepEqual(fact(row.path),row,row.path);return frozen.records.length;}
module.exports={repo,sha,inventory,fact,check};
