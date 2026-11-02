'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{own}=require('./native09-current-admission-01.cjs');
let source=fs.readFileSync(own('materialize-approved-native10-01.cjs'),'utf8');
const marker='const pinned=n=>';assert(source.includes(marker));source=source.replace(marker,"const parentProof=read(own('f26a-native09-preparation-byte-proof-01.json'));assert.equal(sha(fs.readFileSync(own('f26a-native09-preparation-byte-proof-01.json'))),'507c3c93e9b85922b8eace9d21f6d272f010bfa97bbb0e5ed00e9fa7580bc53f');assert.equal(parentProof.commit,'2ec232e8b28a6670c7651022833fc99710fce176');\n"+marker);
const needle='old=proof.files.find(x=>x.path===row.path);';assert(source.includes(needle));source=source.replace(needle,'old=proof.files.find(x=>x.path===row.path)??parentProof.files.find(x=>x.path===row.path);');
fs.writeFileSync(own('materialize-approved-native10-02.cjs'),source,{flag:'wx'});console.log('UNCHANGED_OFFLINE_INPUT_BOUND_TO_PARENT_RAW_BYTE_PROOF; FAILED01_BEFORE_APPROVAL_AND_MATERIALIZATION_RETAINED');
