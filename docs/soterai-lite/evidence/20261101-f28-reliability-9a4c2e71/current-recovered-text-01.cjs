'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),C=require('./affected-current-admission-02.cjs');const{own,read,sha,pin}=C;
function canonicalFile(name){if(name!=='affected-mcp-f28-02')return own(name+'.txt');const r=read(own('mcp-text-recovery-01.json'));assert.equal(r.status,'EXACT_ORIGINAL_SHA256_TEXT_BYTES_RECOVERED_CORRUPTED_FILE_PRESERVED');for(const k of ['originalCorrupt','originalReceipt','originalWrapperClose','originalWrapperStdout','recovered'])pin(r[k]);const meta=read(own(name+'.txt.result.json'));assert.equal(r.recovered.sha256,meta.sha256.toLowerCase());assert.equal(sha(fs.readFileSync(own(name+'-recovered-01.txt'))),r.expectedSha256);return own(name+'-recovered-01.txt');}
module.exports={...C,canonicalFile};
