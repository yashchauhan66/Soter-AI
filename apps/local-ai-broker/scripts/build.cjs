// Compile the shared host-free F07/F08 sources while preserving public entry paths.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
cp.execFileSync(process.execPath,[require.resolve('typescript/bin/tsc'),'-p',path.join(root,'tsconfig.json')],{stdio:'inherit',windowsHide:true});
const dist=path.join(root,'dist'),compiled='./apps/local-ai-broker/src/';
fs.writeFileSync(path.join(dist,'index.js'),'module.exports = require('+JSON.stringify(compiled+'index.js')+');\n');
fs.writeFileSync(path.join(dist,'index.d.ts'),'export * from '+JSON.stringify(compiled+'index')+';\n');
fs.writeFileSync(path.join(dist,'cli.js'),'#!/usr/bin/env node\nrequire('+JSON.stringify(compiled+'cli.js')+');\n');
console.log('Broker compiled with shared F07/F08 sources; dist/index.js and dist/cli.js preserved.');
