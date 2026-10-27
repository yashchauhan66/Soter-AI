
# SoterAI Lite PSReadLine history v1 a1234567-1234-4567-8123-123456789abc
# Uses conservative credential-shape history exclusion; public history stays enabled.
# Does not inspect existing history or dynamically load registered vault values.
# Unknown short values/encodings and later handler replacements remain outside this hook.
& {
    $taskModule = @(Get-Module -Name PSReadLine)
    if ($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1 -or $taskModule.Count -ne 1 -or $taskModule[0].Version.ToString() -cne '2.0.0') { throw 'SoterAI history hook unavailable for this runtime.' }
    $taskPrior = (Get-PSReadLineOption).AddToHistoryHandler
    $taskPatterns = @(
        [regex]::new('\bsk-[A-Za-z0-9_-]{20,}T3BlbkFJ[A-Za-z0-9_-]{20,}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\bsk-(?:proj|svcacct)-[A-Za-z0-9_-]{30,}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\bsk-ant-[A-Za-z0-9_-]{30,}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\bAIza[A-Za-z0-9_-]{35}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\bgsk_[A-Za-z0-9_-]{30,}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\bsk-[a-f0-9]{48,}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\bsk-[A-Za-z0-9_-]{16,}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\b(?:AKIA|ASIA)[A-Z0-9]{16}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\b[A-Za-z0-9_.\-]{0,40}(?:aws_secret_access_key|secret_key)["'']?\s*[:=]\s*["'']?[A-Za-z0-9/+=]{40}["'']?',[Text.RegularExpressions.RegexOptions]769,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,255}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\bglpat-[A-Za-z0-9_-]{20,}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\bBearer\s+[A-Za-z0-9_\-.~+/]+=*\b',[Text.RegularExpressions.RegexOptions]769,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|mssql):\/\/[^\s"''<>]{8,}',[Text.RegularExpressions.RegexOptions]769,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\bhttps?:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]{8,}\/B[A-Z0-9]{8,}\/[A-Za-z0-9]{20,}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\b(?:sk|pk|rk)_(?:test|live)_[A-Za-z0-9]{20,}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\brzp_(?:test|live)_[A-Za-z0-9]{14,}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\b[A-Za-z0-9_.\-]{0,40}(?:api[_-]?key|secret[_-]?key|access[_-]?token|client[_-]?secret)["'']?\s*[:=]\s*["'']?[A-Za-z0-9_\-./+=]{16,}["'']?',[Text.RegularExpressions.RegexOptions]769,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\b[A-Za-z0-9_.\-]{0,40}(?:password|passwd|pwd)["'']?\s*[:=]\s*["'']?[^"''\s]{8,}["'']?',[Text.RegularExpressions.RegexOptions]769,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\bxox(?:b|p|o|a|r|s)-[A-Za-z0-9-]{10,}\b',[Text.RegularExpressions.RegexOptions]769,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\bhf_[A-Za-z0-9]{20,}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\bnpm_[A-Za-z0-9]{36,}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\bpypi-[A-Za-z0-9_-]{20,}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\bAC[a-f0-9]{32}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('(?:DefaultEndpointsProtocol|AccountKey)=[A-Za-z0-9+/=]{20,}',[Text.RegularExpressions.RegexOptions]769,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\b[MN][A-Za-z0-9]{23,}\.[\w-]{6}\.[\w-]{27,}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\bdop_v1_[a-f0-9]{64}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\bshpat_[a-fA-F0-9]{32}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\bdapi[a-f0-9]{32,}\b',[Text.RegularExpressions.RegexOptions]769,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\bsb[pa]_[A-Za-z0-9_-]{20,}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\bATBB[A-Za-z0-9]{20,}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\bkey-[0-9a-zA-Z]{32}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\b[A-Za-z0-9_.\-]{0,40}(?:twilio[_-]?(?:auth[_-]?)?token)["'']?\s*[:=]\s*["'']?[0-9a-f]{32}["'']?',[Text.RegularExpressions.RegexOptions]769,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\bdckr_pat_[A-Za-z0-9_-]{20,}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\bgithub_pat_[A-Za-z0-9_]{20,}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\bgl(?:cbt|dt|rt)-[A-Za-z0-9_-]{20,}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\batlasv1\.[A-Za-z0-9]{50,}\b',[Text.RegularExpressions.RegexOptions]768,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\b(?:Server|Data Source|Host)=[^;\s]+;[^\n]{0,200}?(?:Password|Pwd)=[^;\s]{6,}',[Text.RegularExpressions.RegexOptions]769,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\b[A-Za-z0-9_.\-]{0,40}(?:token|secret|credentials?|auth|api[_-]?key|auth[_-]?key)["'']?\s*[:=]\s*["'']?([A-Za-z0-9+/=_-]{32,})["'']?',[Text.RegularExpressions.RegexOptions]769,[TimeSpan]::FromMilliseconds(20))
        [regex]::new('\b[A-Za-z0-9_.\-]{0,40}(?:secret|token|credentials?|password|passwd|auth|api[_-]?key|access[_-]?key)["'']?\s*[:=]\s*["'']?[A-Za-z0-9+/=_-]{28,}["'']?',[Text.RegularExpressions.RegexOptions]769,[TimeSpan]::FromMilliseconds(20))
    )
    $taskCallback = {
        param([string]$line)
        try {
            if ([string]::IsNullOrWhiteSpace($line) -or $line.Length -gt 4096 -or $line -match '[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]') { return [Microsoft.PowerShell.AddToHistoryOption]::SkipAdding }
            $taskClock = [Diagnostics.Stopwatch]::StartNew()
            foreach ($taskPattern in $taskPatterns) {
                if ($taskClock.ElapsedMilliseconds -ge 250 -or $taskPattern.IsMatch($line)) { return [Microsoft.PowerShell.AddToHistoryOption]::SkipAdding }
            }
            if ($taskClock.ElapsedMilliseconds -ge 250) { return [Microsoft.PowerShell.AddToHistoryOption]::SkipAdding }
            if ($null -eq $taskPrior) { return [Microsoft.PowerShell.AddToHistoryOption]::MemoryAndFile }
            $taskPrevious = $taskPrior.Invoke($line)
            if ($taskPrevious -is [bool]) {
                if ($taskPrevious) { return [Microsoft.PowerShell.AddToHistoryOption]::MemoryAndFile }
                return [Microsoft.PowerShell.AddToHistoryOption]::SkipAdding
            }
            if ($taskPrevious -is [Microsoft.PowerShell.AddToHistoryOption]) {
                if ($taskPrevious -eq [Microsoft.PowerShell.AddToHistoryOption]::MemoryAndFile -or $taskPrevious -eq [Microsoft.PowerShell.AddToHistoryOption]::MemoryOnly -or $taskPrevious -eq [Microsoft.PowerShell.AddToHistoryOption]::SkipAdding) { return $taskPrevious }
                return [Microsoft.PowerShell.AddToHistoryOption]::SkipAdding
            }
            if ($taskPrevious -is [string]) {
                switch -CaseSensitive ($taskPrevious) {
                    'MemoryAndFile' { return [Microsoft.PowerShell.AddToHistoryOption]::MemoryAndFile }
                    'MemoryOnly' { return [Microsoft.PowerShell.AddToHistoryOption]::MemoryOnly }
                    'SkipAdding' { return [Microsoft.PowerShell.AddToHistoryOption]::SkipAdding }
                }
            }
            return [Microsoft.PowerShell.AddToHistoryOption]::SkipAdding
        } catch { return [Microsoft.PowerShell.AddToHistoryOption]::SkipAdding }
    }.GetNewClosure()
    Set-PSReadLineOption -AddToHistoryHandler $taskCallback
}
# End SoterAI Lite PSReadLine history v1
