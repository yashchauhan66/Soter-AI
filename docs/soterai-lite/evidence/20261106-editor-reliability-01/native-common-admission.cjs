'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../../..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),gateFile=path.resolve(repo,"docs/soterai-lite/evidence/20261106-v01-current-01/v01-admission.cjs");
assert.equal(sha(fs.readFileSync(gateFile)),"45d85d8fdaefa9d5cec58706d660730a0f386b60911e43868ccad344924838af");const G=require(gateFile);
function binding(){const b=G.binding();assert.equal(b.vsix.sha256,"011f96d19d42dbefc2e56eb5399bf5c7f16a09d6b71b8bae5be9d66b2f3769ec");assert.equal(b.hostVersion,'1.145.1');return {...b,content:b.inspection};}
module.exports={...G,repo,own:n=>path.join(__dirname,n),location:r=>path.resolve(repo,r.path),binding};
