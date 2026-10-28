'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../..'),own=name=>path.join(__dirname,name),sha=raw=>crypto.createHash('sha256').update(raw).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const relativeFile=name=>{assert(typeof name==='string'&&!path.isAbsolute(name));const file=path.resolve(repo,name);assert(file.startsWith(repo+path.sep));return file;};
async function guard(){throw new Error('UNBOUND_CURRENT_F27_HISTORY28_ALL15_RUNTIME4_FLAGS84_SOURCE1016_HOST_VENDOR_AND_ACCEPTED_PROPOSAL06_FIXTURE_REQUIRED');}
async function pin(){throw new Error('UNBOUND_CURRENT_F27_EXACT_PIN_ADMISSION');}
module.exports={guard,pin,repo,read,sha,own,relativeFile};
