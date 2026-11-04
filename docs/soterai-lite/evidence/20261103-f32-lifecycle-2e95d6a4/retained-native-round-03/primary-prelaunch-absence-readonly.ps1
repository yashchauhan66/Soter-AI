$ErrorActionPreference='Stop'
. 'D:\SoterAI-Lite-test-profiles\f32-installed-20261104T021038Z-aa54c353\assets\custody.ps1'
Write-F32InitialOwnerAbsence -BindingPath 'D:\SoterAI-Lite-test-profiles\f32-installed-20261104T021038Z-aa54c353\profile-primary\F32Gate\primary\primary-prelaunch-absence-binding.json' -OutputPath 'D:\SoterAI-Lite-test-profiles\f32-installed-20261104T021038Z-aa54c353\profile-primary\F32Gate\primary\primary-prelaunch-absence-observations.json' | ConvertTo-Json -Depth 6
