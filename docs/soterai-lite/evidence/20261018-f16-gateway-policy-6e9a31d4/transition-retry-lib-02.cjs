'use strict';
// Additive evidence-only launcher repair. Indexed source/tools stay unchanged.
const h=require('./f16-transition-lib-01.cjs');
const extras=['source-byte-verification-01.txt','source-byte-verification-01.txt.result.json','acceptance-launch-01.txt','acceptance-launch-01.txt.result.json','source-verification-resume-01.json','resume-close-card-02.ps1','transition-retry-lib-02.cjs','prepare-transition-02.cjs','verify-transition-02.cjs','commit-transition-02.ps1'];
function sourceProof(...args){const facts=h.sourceProof(...args);return{...facts,receiptPaths:[...facts.receiptPaths,...extras.map(name=>h.base+'/'+name)]};}
module.exports={...h,sourceProof};
