'use strict';
// Preserve failed author01 and every emitted byte; prepare exact author02 only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
let s=fs.readFileSync(path.join(__dirname,'prepare-visible-gui-successor-05.cjs'),'utf8');
function replace(before,after){assert.equal(s.split(before).length-1,1);s=s.replace(before,()=>after)}
replace("const write=(n,s)=>fs.writeFileSync(file(n),s,{flag:'wx'});","const write=(n,s)=>{if(fs.existsSync(file(n))){assert(fs.readFileSync(file(n)).equals(Buffer.from(s)),'Existing partial source differs');return;}fs.writeFileSync(file(n),s,{flag:'wx'});};");
replace(" s=change(s,\"const vscode = require('vscode');\",\"const vscode = require('vscode');\\nconst { collectTrustSnapshot } = require('./installed-trust-diagnostics-proposed-05.cjs');\");"," s=change(s,\"const { admitInstalledManifest } = require('./installed-manifest-admission-proposed-02.cjs');\",\"const { admitInstalledManifest } = require('./installed-manifest-admission-proposed-02.cjs');\\nconst { collectTrustSnapshot } = require('./installed-trust-diagnostics-proposed-05.cjs');\");");
// Current partial observer was emitted before the compact old declaration
// refusal. Its sole helper require placement changes semantically inertly;
// preserve it and generate only its missing successors in author02.
replace(" write(output,s);"," if(output==='installed-observer-proposed-05.cjs'&&fs.existsSync(file(output))){const original=fs.readFileSync(file(output),'utf8');assert.equal(original.replace(\"const { collectTrustSnapshot } = require('./installed-trust-diagnostics-proposed-05.cjs');\\n\",''),s.replace(\"const { collectTrustSnapshot } = require('./installed-trust-diagnostics-proposed-05.cjs');\\n\",''));}else write(output,s);");
fs.writeFileSync(path.join(__dirname,'prepare-visible-gui-successor-corrected-05.cjs'),s,{flag:'wx'});
require('./prepare-visible-gui-successor-corrected-05.cjs');
