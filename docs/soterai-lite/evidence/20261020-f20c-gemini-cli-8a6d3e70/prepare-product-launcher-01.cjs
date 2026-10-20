const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const replace=(s,a,b)=>{assert(s.includes(a),a);return s.replace(a,b);};
let text=fs.readFileSync(path.join(__dirname,'../20261019-f20b-codex-ide-c7a309e2/run-ide-product-matrix-02.ps1'),'utf8').replaceAll('F20B','F20C').replaceAll('f20b','f20c').replaceAll('vsix-inspection-03.json','vsix-inspection-01.json').replaceAll('installed-public-inputs-01.json','installed-public-inputs-02.json').replaceAll('ide-product-matrix-02.cjs','gemini-product-matrix-01.cjs').replaceAll('ide-product-guards-01.cjs','gemini-product-parent-guards-01.cjs').replaceAll('ide-native-client-01.cjs','gemini-product-child-guards-01.cjs').replaceAll('PASS_SCOPED_PRODUCT_IDE_MATRIX','PASS_SCOPED_PRODUCT_GEMINI_MATRIX');
text=replace(text,"$taskVendorCopy=Join-Path $taskRoot 'extensions/openai.chatgpt-26.51007.21434-win32-x64'","$taskVendorCopy=Join-Path $taskRoot 'public-vendor/npm/node_modules/@google/gemini-cli'");
const start=text.indexOf("if(@(Get-ChildItem -LiteralPath $taskVendor"),end=text.indexOf('$taskBindings=@()',start);assert(start>0&&end>start);
text=text.slice(0,start)+`foreach($taskInput in $taskPin.files){
 $taskDestination=Join-Path $taskVendorCopy $taskInput.relative
 [void][IO.Directory]::CreateDirectory((Split-Path -Parent $taskDestination))
 if((Get-Item -LiteralPath $taskInput.path).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked public input refused'}
 Copy-Item -LiteralPath $taskInput.path -Destination $taskDestination
 if((Get-F20CHash $taskDestination) -cne $taskInput.sha256){throw 'Copied selected public artifact differs'}
}
$taskDependencyCopy=Join-Path $taskRoot 'public-vendor/npm/node_modules/picomatch'
foreach($taskInput in $taskPin.dependencies[0].files){
 $taskDestination=Join-Path $taskDependencyCopy $taskInput.relative
 [void][IO.Directory]::CreateDirectory((Split-Path -Parent $taskDestination))
 Copy-Item -LiteralPath $taskInput.path -Destination $taskDestination
 if((Get-F20CHash $taskDestination) -cne $taskInput.sha256){throw 'Copied public dependency differs'}
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'installed-public-inputs-02.json') -Destination (Join-Path $taskRoot 'reviewed-public-pin.json')
`+text.slice(end);
text=replace(text,"if((Get-F20CHash $taskInspection.vsix) -cne $taskInspection.sha256){throw 'VSIX changed'}",`foreach($taskInput in $taskPin.dependencies[0].files){if((Get-F20CHash (Join-Path $taskDependencyCopy $taskInput.relative)) -cne $taskInput.sha256){throw 'Copied dependency pin changed'}}
 if((Get-F20CHash $taskPin.node.path) -cne $taskPin.node.sha256){throw 'Public Node pin changed'}
 if((Get-F20CHash $taskInspection.vsix) -cne $taskInspection.sha256){throw 'VSIX changed'}`);
text=replace(text,"await driver.run(context,resolve);","const result=await driver.run(context,resolve);if(result.nativeRetained)return;");
text=replace(text,"finally{resolve();await vscode.commands.executeCommand('workbench.action.closeWindow');}","finally{resolve();if(!globalThis.__soteraiNativeRetained)await vscode.commands.executeCommand('workbench.action.closeWindow');}");
// A retained native worker also retains this synthetic test editor, no signals.
text=replace(text,'if(result.nativeRetained)return;','if(result.nativeRetained){globalThis.__soteraiNativeRetained=true;return;}');
text=replace(text,"$taskInfo.EnvironmentVariables['APPDATA']=Join-Path $taskProfile 'AppData/Roaming'","$taskInfo.EnvironmentVariables['APPDATA']=Join-Path $taskRoot 'public-vendor'");
text=replace(text,"$taskInfo.EnvironmentVariables['CODEX_HOME']=Join-Path $taskRoot 'code-home'\n[void][IO.Directory]::CreateDirectory((Join-Path $taskRoot 'code-home'))","$taskInfo.EnvironmentVariables['ProgramFiles']='C:\\Program Files'");
text=text.replaceAll('Pinned IDE JavaScript and bundled native execute from an isolated exact public copy; original vendor manifest retained; physical webview route UNVERIFIED.','Pinned Gemini0.55.1 selected manifest/bundle and public picomatch execute from exact isolated copies with pinned Node22.16.0; optional native-addon routes not certified.');
text=text.replaceAll('Restricted native HTTP text Responses','Restricted native HTTP text GenerateContent');
text=text.replaceAll('current product CLI matrix','current product Gemini matrix');
fs.writeFileSync(path.join(__dirname,'run-gemini-product-matrix-01.ps1'),text,{flag:'wx'});
