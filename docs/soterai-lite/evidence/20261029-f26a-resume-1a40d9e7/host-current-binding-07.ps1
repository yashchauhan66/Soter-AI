# Current1036/full4464/new VSIX and unchanged34 fixture, metadata admission only.
function Assert-F26AEditorHost {
 & 'C:\Program Files\nodejs\node.exe' (Join-Path $PSScriptRoot 'diagnostic-admission-07.cjs') | Out-Null
 if($LASTEXITCODE -ne 0){throw 'Current exact F26a source/artifact/host admission failed'}
 if((Get-Variable -Name CodePath -ErrorAction SilentlyContinue) -and [IO.Path]::GetFullPath($CodePath) -ine [IO.Path]::GetFullPath('C:\Users\USER\AppData\Local\Programs\Microsoft VS Code\Code.exe')){throw 'Exact reviewed Code path required'}
}
