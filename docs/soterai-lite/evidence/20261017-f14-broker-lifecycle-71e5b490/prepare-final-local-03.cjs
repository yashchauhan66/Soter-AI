const fs=require('node:fs'),path=require('node:path');
let text=fs.readFileSync(path.join(__dirname,'run-final-local-02.ps1'),'utf8').replaceAll("'final-focused-02'","'final-focused-03'").replaceAll("'typecheck-04'","'typecheck-05'").replaceAll("'full-tests-02'","'full-tests-03'")
.replaceAll("'readiness-01'","'readiness-02'").replaceAll("'package-01'","'package-02'").replaceAll("'host-build-01'","'host-build-02'").replaceAll('prebuilt-native-hosts-01','prebuilt-native-hosts-02').replaceAll('attempt01.vsix','attempt02.vsix').replace('-InspectionName 01','-InspectionName 02')
.replace("'readme-accuracy')","'readme-accuracy','brokerRoutingOwnership')");
text=text.split(/\r?\n/).filter(line=>!line.startsWith("Invoke-F14 'broker-tests-01'")).join('\n');
fs.writeFileSync(path.join(__dirname,'run-final-local-03.ps1'),text,{flag:'wx'});
text=fs.readFileSync(path.join(__dirname,'run-final-hosts-01.ps1'),'utf8').replaceAll('attempt01.vsix','attempt02.vsix').replaceAll('vsix-extracted-01','vsix-extracted-02').replaceAll('prebuilt-native-hosts-01','prebuilt-native-hosts-02').replace("@('-InspectionName','01')","@('-InspectionName','02')");
fs.writeFileSync(path.join(__dirname,'run-final-hosts-01.ps1'),text);
text=fs.readFileSync(path.join(__dirname,'create-final-bindings-01.cjs'),'utf8').replaceAll('final-focused-02','final-focused-03').replaceAll('typecheck-04','typecheck-05').replaceAll('full-tests-02','full-tests-03').replaceAll('readiness-01','readiness-02').replaceAll('package-01','package-02').replaceAll('host-build-01','host-build-02').replaceAll('attempt01.vsix','attempt02.vsix').replaceAll('vsix-inspection-01','vsix-inspection-02').replaceAll('root-source-review-01.md','root-source-review-02.md').replace("'root-final-disposition-01.md'","'routing-review-01.md','root-final-disposition-01.md'");
fs.writeFileSync(path.join(__dirname,'create-final-bindings-01.cjs'),text);
console.log('Final03 tools authored; no raw/artifact overwritten; unchanged backend broker-tests01 retained');
