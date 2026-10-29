const fs=require('node:fs'),assert=require('node:assert/strict');
const file=__dirname+'/native-launch-candidate-03.ps1.txt',before=fs.readFileSync(file,'utf8');
const repeated="@{schemaVersion=1;syntheticOnly=$true;status='ACTUAL_F26B_PRIMARY_EDITOR_CLOSED';syntheticOnly=$true;";
assert.equal(before.split(repeated).length,2);
const after=before.replace(repeated,"@{schemaVersion=1;syntheticOnly=$true;status='ACTUAL_F26B_PRIMARY_EDITOR_CLOSED';");
fs.writeFileSync(__dirname+'/native-launch-candidate-04.ps1.txt',after,{flag:'wx'});
