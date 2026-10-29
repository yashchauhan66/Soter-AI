const fs=require('node:fs'),{own}=require('./storage-current-admission-09.cjs');
const facts=['C:\\Program Files\\Git\\cmd\\git.exe','C:\\Users\\USER\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe'].map(file=>{const s=fs.lstatSync(file);return{file,nlink:s.nlink,symlink:s.isSymbolicLink(),isFile:s.isFile(),real:fs.realpathSync(file),bytes:s.size};});
fs.writeFileSync(own('offline-preflight-vendor-facts-01.json'),JSON.stringify({observedAt:new Date().toISOString(),facts},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(facts));
