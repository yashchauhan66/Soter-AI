const fs=require('node:fs'),path=require('node:path');
function fresh(name, text){fs.writeFileSync(path.join(__dirname,name),text,{flag:'wx'});}
let metadata=fs.readFileSync(path.join(__dirname,'prepare-metadata-01.cjs'),'utf8');
metadata=metadata.replaceAll('metadata-sync-01','metadata-sync-02').replaceAll('metadata-canonical-input-01','metadata-canonical-input-02').replaceAll('metadata-lite-before-01','metadata-lite-before-02').replace('JSON.stringify(lite, null, 4)','JSON.stringify(lite, null, 2)');
fresh('prepare-metadata-02.cjs',metadata);
let release=fs.readFileSync(path.join(__dirname,'run-release-01.ps1'),'utf8').replaceAll('metadata-sync-01','metadata-sync-02').replaceAll('generate-readiness-01','generate-readiness-02');
fresh('run-release-02.ps1',release);
let checks=fs.readFileSync(path.join(__dirname,'run-final-local-01.ps1'),'utf8').replaceAll('focused-after-04','focused-after-05').replaceAll('typecheck-03','typecheck-04').replaceAll('full-tests-01','full-tests-02');
fresh('run-final-local-02.ps1',checks);
console.log('Prepared unique metadata refinement, final validation and release wrappers; no check executed.');
