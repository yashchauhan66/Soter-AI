const fs=require('node:fs'),crypto=require('node:crypto');
const file='C:/Users/USER/AppData/Local/Programs/Microsoft VS Code/2a59476c9b/resources/app/out/main.js';
const bytes=fs.readFileSync(file),source=bytes.toString('utf8');
const match=source.match(/useInMemoryStorage\s*:\s*!![^,;}]{0,160}extensionTestsLocationURI/);
const result={status:match?'PASS_INSTALLED_SOURCE_CONDITION':'UNVERIFIED',source:file,
 sourceSha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,
 conditionObserved:match?.[0]??null,
 officialPrimary:'https://github.com/microsoft/vscode/blob/main/src/vs/platform/storage/electron-main/storageMainService.ts',
 observation:'extensionTestsPath launches produce no workspace state.vscdb; native persistence must be tested in a normal isolated window without extensionTestsPath.'};
fs.writeFileSync(__dirname+'/storage-test-mode-proof.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result));
