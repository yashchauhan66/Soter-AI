$ErrorActionPreference='Stop'
$taskRepo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$taskManifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'affected-preparation-materialization-01.json') -Raw | ConvertFrom-Json
$taskFiles=@($taskManifest.outputs | ForEach-Object { $_.target })
foreach($taskName in @('compiled-runtime-fixture-01.cjs','run-content-01.cjs','watch-content-01.cjs','affected-preparation-chain-01.template.cjs','affected-preparation-guard-01.template.cjs')) {
    $taskFile=Join-Path $PSScriptRoot $taskName
    $taskFiles+= [pscustomobject]@{path=$taskFile;bytes=(Get-Item -LiteralPath $taskFile).Length;sha256=(Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant()}
}
$taskResults=@()
foreach($taskPin in $taskFiles) {
    $taskFile=if([IO.Path]::IsPathRooted($taskPin.path)){$taskPin.path}else{Join-Path $taskRepo $taskPin.path}
    $taskFile=[IO.Path]::GetFullPath($taskFile)
    if(-not $taskFile.StartsWith($PSScriptRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Prepared parser target escaped evidence root.'}
    $taskItem=Get-Item -LiteralPath $taskFile -Force
    if($taskItem.PSIsContainer -or ($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $taskItem.Length -ne $taskPin.bytes -or (Get-FileHash -LiteralPath $taskFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskPin.sha256){throw 'Prepared parser target pin changed.'}
    if($taskFile.EndsWith('.ps1')) {
        $taskTokens=$null;$taskErrors=$null
        $null=[System.Management.Automation.Language.Parser]::ParseFile($taskFile,[ref]$taskTokens,[ref]$taskErrors)
        if($taskErrors.Count -gt 0){throw 'Prepared PowerShell syntax refused.'}
        $taskResults+=[pscustomobject]@{name=$taskItem.Name;parser='PowerShell AST';errors=0;sha256=$taskPin.sha256}
    } elseif($taskFile.EndsWith('.js') -or $taskFile.EndsWith('.cjs')) {
        $taskParserOutput=@(& 'C:\Program Files\nodejs\node.exe' --check $taskFile 2>&1)
        if($LASTEXITCODE -ne 0){throw 'Prepared JavaScript syntax refused.'}
        $taskResults+=[pscustomobject]@{name=$taskItem.Name;parser='Node --check';errors=0;sha256=$taskPin.sha256}
    }
}
[ordered]@{status='PARSER_ONLY_PASS_NOT_NATIVE_OR_BEHAVIOR';checked=$taskResults.Count;results=$taskResults;native='NOT_RUN';signalsRequested=0} | ConvertTo-Json -Depth 5
