$ErrorActionPreference='Stop'
$fixtureBase='docs/soterai-lite/evidence/20261020-f20c-gemini-cli-8a6d3e70'
$fixtureRunner='docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/run-check.ps1'
$fixtureExpected='8e8e1742ae7197b98f1d9739a8f71c1231bccf21'
if ((git rev-parse HEAD).Trim() -ne $fixtureExpected) { throw 'Checkpoint parent changed' }
if (git diff --cached --name-only) { throw 'Unowned staged files present' }
& $fixtureRunner -FilePath git -ArgumentList @('-c','core.autocrlf=false','add',('--pathspec-from-file='+$fixtureBase+'/checkpoint-allowlist-01.nul'),'--pathspec-file-nul') -OutputFile ($fixtureBase+'/checkpoint-stage-01.txt')
if ((Get-Content -Raw -LiteralPath ($fixtureBase+'/checkpoint-stage-01.txt.result.json') | ConvertFrom-Json).exitCode -ne 0) { throw 'Checkpoint staging failed' }
& $fixtureRunner -FilePath node -ArgumentList @($fixtureBase+'/verify-checkpoint-01.cjs','--staged') -OutputFile ($fixtureBase+'/checkpoint-staged-verification-01.txt')
if ((Get-Content -Raw -LiteralPath ($fixtureBase+'/checkpoint-staged-verification-01.txt.result.json') | ConvertFrom-Json).exitCode -ne 0) { throw 'Staged checkpoint bytes failed' }
& $fixtureRunner -FilePath git -ArgumentList @('-c','core.autocrlf=false','-c','core.hooksPath=docs/soterai-lite/evidence/20261013-l0-disk-gate-51f892d0/offline-hooks','commit','-m','docs: retain incomplete F20C native diagnostics checkpoint') -OutputFile ($fixtureBase+'/checkpoint-commit-01.txt')
if ((Get-Content -Raw -LiteralPath ($fixtureBase+'/checkpoint-commit-01.txt.result.json') | ConvertFrom-Json).exitCode -ne 0) { throw 'Checkpoint commit failed' }
& $fixtureRunner -FilePath node -ArgumentList @($fixtureBase+'/verify-checkpoint-01.cjs') -OutputFile ($fixtureBase+'/checkpoint-committed-verification-01.txt')
if ((Get-Content -Raw -LiteralPath ($fixtureBase+'/checkpoint-committed-verification-01.txt.result.json') | ConvertFrom-Json).exitCode -ne 0) { throw 'Committed checkpoint bytes failed' }
