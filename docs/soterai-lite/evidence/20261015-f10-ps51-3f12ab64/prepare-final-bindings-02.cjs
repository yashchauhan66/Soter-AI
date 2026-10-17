const fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'create-final-bindings-01.cjs'),'utf8')
 .replaceAll('20261017-attempt02','20261017-attempt03').replaceAll('final-focused-04','final-focused-05')
 .replaceAll('full-tests-04','full-tests-05').replaceAll('typecheck-08','typecheck-09').replaceAll('package-03','package-04')
 .replaceAll('native-launch-03','native-launch-04').replaceAll('affected-launch-03','affected-launch-04')
 .replaceAll('vsix-inspection-03','vsix-inspection-04').replaceAll('final-bindings-01.json','final-bindings-02.json')
 .replace("'root-final-disposition-01.md'","'source-review-root-listing-01.md','root-final-disposition-01.md'");
fs.writeFileSync(path.join(__dirname,'create-final-bindings-02.cjs'),source,{flag:'wx'});
