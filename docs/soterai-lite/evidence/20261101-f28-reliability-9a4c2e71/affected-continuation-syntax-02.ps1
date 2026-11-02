$ErrorActionPreference='Stop'
foreach($n in @('affected-native-binding-02.ps1','affected-owned-output-02.ps1')){
 $tokens=$null;$errors=$null;[void][Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $n),[ref]$tokens,[ref]$errors);if($errors.Count){throw ($errors|Out-String)}
}
foreach($n in @('affected-current-admission-02.cjs','run-affected-current-02.cjs','verify-affected-current-02.cjs','build-owned-output-driver-01.cjs')){& 'C:\Program Files\nodejs\node.exe' --check (Join-Path $PSScriptRoot $n);if($LASTEXITCODE -ne 0){throw 'JavaScript syntax failed'}}
Write-Output 'PASS: PowerShell2 and Node4 syntax. No native execution.'
