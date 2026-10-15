const fs=require('node:fs'),path=require('node:path');
fs.copyFileSync(path.resolve(__dirname,'../20261014-f05-secure-editor-597d8a24/run-native-02.ps1'),path.join(__dirname,'run-affected-editor-01.ps1'),fs.constants.COPYFILE_EXCL);
console.log('Prepared unchanged F05 native controls against the exact F06 artifact; not run.');
