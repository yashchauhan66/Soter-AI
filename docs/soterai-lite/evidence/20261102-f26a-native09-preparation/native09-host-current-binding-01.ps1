# Read-only current F26a source/artifact/vendor/byte-barrier admission interface.
# Defining or invoking these functions grants no native09 execution authority.
function Get-F26ANative09Binding {
 $taskNative09Guard=Join-Path $PSScriptRoot 'native09-current-admission-01.cjs'
 if(-not(Test-Path -LiteralPath $taskNative09Guard -PathType Leaf) -or (Get-FileHash -LiteralPath $taskNative09Guard -Algorithm SHA256).Hash.ToLowerInvariant() -cne '71caae8c07839edff9ee0f0dbd33362c2b68d2784830900851bcc93226ba6c7e'){throw 'Exact current F26a metadata guard differs.'}
 $taskNative09Raw=& 'C:\Program Files\nodejs\node.exe' $taskNative09Guard --emit-binding
 if($LASTEXITCODE -ne 0){throw 'Current exact F26a source/artifact/host/supplementary-driver admission failed.'}
 $taskNative09Binding=$taskNative09Raw|ConvertFrom-Json
 if($taskNative09Binding.status -cne 'F26A_CURRENT1076_NATIVE09_BOUND_NOT_AUTHORIZED_NOT_RUN' -or $taskNative09Binding.fileCount -ne 1076 -or $taskNative09Binding.nativeOracles.primary -ne 30 -or $taskNative09Binding.nativeOracles.restart -ne 4){throw 'Current1076/original34 F26a metadata binding required.'}
 return $taskNative09Binding
}
function Assert-F26AEditorHost {
 $taskNative09Binding=Get-F26ANative09Binding
 $taskNative09Repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
 $taskNative09Review=Get-Content -LiteralPath (Join-Path $taskNative09Repo $taskNative09Binding.hostReview.path) -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskNative09Review.currentHost.version -cne '1.144.0' -or $taskNative09Review.currentHost.executable.sha256 -cne '9f33ede68f3317402280fa997bc8963f93e67f2905e416d6bb092c03d60a37eb'){throw 'Original current reviewed Code1.144 facts required.'}
 if((Get-Variable -Name CodePath -ErrorAction SilentlyContinue) -and [IO.Path]::GetFullPath($CodePath) -ine [IO.Path]::GetFullPath($taskNative09Review.currentHost.executable.path)){throw 'Exact reviewed Code executable path required.'}
}
