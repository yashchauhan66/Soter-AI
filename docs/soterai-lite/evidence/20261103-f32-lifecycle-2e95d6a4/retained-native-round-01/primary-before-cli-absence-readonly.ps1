$ErrorActionPreference='Stop'
. 'D:\SoterAI-Lite-test-profiles\f32-installed-20261104T015437Z-9bc207a9\assets\custody.ps1'
Write-F32InitialOwnerAbsence -BindingPath 'D:\SoterAI-Lite-test-profiles\f32-installed-20261104T015437Z-9bc207a9\profile-primary\F32Gate\primary\primary-before-cli-absence-binding.json' -OutputPath 'D:\SoterAI-Lite-test-profiles\f32-installed-20261104T015437Z-9bc207a9\profile-primary\F32Gate\primary\primary-before-cli-absence-observations.json' | ConvertTo-Json -Depth 6
