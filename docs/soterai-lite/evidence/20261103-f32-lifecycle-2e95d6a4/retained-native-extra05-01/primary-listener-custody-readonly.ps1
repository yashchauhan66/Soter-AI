$ErrorActionPreference='Stop'
. 'D:\SoterAI-Lite-test-profiles\f32-installed-20261104T073050Z-2651afb2\assets\custody.ps1'
Write-F32ListenerCustody -BindingPath 'D:\SoterAI-Lite-test-profiles\f32-installed-20261104T073050Z-2651afb2\profile-primary\F32Gate\primary\primary-listener-custody-binding.json' -OutputPath 'D:\SoterAI-Lite-test-profiles\f32-installed-20261104T073050Z-2651afb2\profile-primary\F32Gate\primary\primary-listener-custody.json' | ConvertTo-Json -Depth 6
