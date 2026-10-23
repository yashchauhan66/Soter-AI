$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'host-current-binding-03.ps1')
Assert-F23EditorHost
