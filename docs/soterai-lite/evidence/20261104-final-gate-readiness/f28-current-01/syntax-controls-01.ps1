$ErrorActionPreference='Stop'
foreach($taskF28Name in @('native-admission-current-01.ps1','native-launch-current-01.ps1')){
 $taskF28Tokens=$null;$taskF28Errors=$null
 [void][System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot $taskF28Name),[ref]$taskF28Tokens,[ref]$taskF28Errors)
 if($taskF28Errors.Count){throw ('F28 syntax failure: '+$taskF28Name)}
}
Write-Output 'PASS_TWO_CURRENT_F28_PS_FILES_PARSED_NO_EXECUTION'
