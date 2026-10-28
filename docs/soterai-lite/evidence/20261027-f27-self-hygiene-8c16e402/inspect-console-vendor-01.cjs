'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const p='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',s=fs.lstatSync(p),b=fs.readFileSync(p);
const result={status:'READ_ONLY_FIXED_VENDOR_METADATA_NOT_CONSOLE_RUN',path:p,isFile:s.isFile(),symlink:s.isSymbolicLink(),nlink:s.nlink,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex'),real:fs.realpathSync(p)};
fs.writeFileSync(path.join(__dirname,'console-vendor-metadata-01.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
