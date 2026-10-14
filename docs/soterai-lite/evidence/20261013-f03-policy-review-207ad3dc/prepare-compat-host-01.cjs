const fs=require('node:fs'),path=require('node:path');
let script=fs.readFileSync(path.join(__dirname,'run-f03-native-host-02.ps1'),'utf8');
script=script.replace("('native-host-'+", "('compat-native-host-'+")
 .replace("$taskFreeze=@{createdAt=", "$taskFreeze=@{codeExecutableSha256=(Get-FileHash -LiteralPath $CodePath).Hash.ToLowerInvariant();codeProductVersion=([Diagnostics.FileVersionInfo]::GetVersionInfo($CodePath)).ProductVersion;createdAt=");
fs.writeFileSync(path.join(__dirname,'run-f03-compat-native-host-03.ps1'),script,{flag:'wx'});
console.log(JSON.stringify({status:'PREPARED_NOT_RUN',scope:'Supplemental cached ZIP 1.104 compatibility only; actual installed editor gate remains NOT-RUN while updater holds lock.'}));
