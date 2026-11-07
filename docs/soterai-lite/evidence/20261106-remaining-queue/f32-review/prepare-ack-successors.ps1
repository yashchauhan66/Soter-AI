$ErrorActionPreference = 'Stop'
# Preparation only: reads retained fixtures and writes new inert files here.
# It never invokes Node, Code, a test host, or another process.
$reviewRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$originalRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../20261103-f32-lifecycle-2e95d6a4'))
$utf8 = New-Object Text.UTF8Encoding($false)
function Replace-Exactly([string]$Text, [string]$Before, [string]$After) {
    $first = $Text.IndexOf($Before, [StringComparison]::Ordinal)
    if ($first -lt 0 -or $first -ne $Text.LastIndexOf($Before, [StringComparison]::Ordinal)) { throw 'Expected one exact source replacement.' }
    return $Text.Replace($Before, $After)
}
function Write-NewReviewFile([string]$Name, [string]$Text) {
    $target = [IO.Path]::GetFullPath((Join-Path $reviewRoot $Name))
    if ([IO.Path]::GetDirectoryName($target) -cne $reviewRoot -or (Test-Path -LiteralPath $target)) { throw 'Only new direct-child review files are allowed.' }
    [IO.File]::WriteAllText($target, $Text, $utf8)
    return [pscustomobject]@{ path=$target; bytes=(Get-Item -LiteralPath $target).Length; sha256=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() }
}
$observerHandshake = @'
// F32_COMPLETION_HANDSHAKE_BEGIN
async function awaitRendererCompletion(b, completionNonce, observerResult, timeout = 90000) {
  const receiptPath = path.join(b.gate, b.phase + '-renderer-results.json');
  const receipt = await until(() => {
    if (!fs.existsSync(receiptPath)) return undefined;
    const stat = fs.lstatSync(receiptPath);
    assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size <= 2 * 1024 * 1024);
    // Another owned process may be between exclusive open and its first write.
    try { return read(receiptPath); } catch (error) { if (error instanceof SyntaxError) return undefined; throw error; }
  }, timeout, 'Owned renderer completion acknowledgment missing');
  assert.equal(receipt.schemaVersion, 1); assert.equal(receipt.feature, 'F32');
  assert.equal(receipt.phase, b.phase); assert.equal(receipt.status, 'OBSERVED_REAL_KEYBOARD');
  assert.equal(receipt.signalsRequested, 0); assert.equal(receipt.productPromptInterception, false);
  assert.equal(receipt.productApiReplacement, false); assert.equal(receipt.completionNonce, completionNonce);
  assert.deepEqual(receipt.observerResult, observerResult);
}
// F32_COMPLETION_HANDSHAKE_END

'@
$rendererHandshake = @'
// F32_COMPLETION_HANDSHAKE_BEGIN
function rendererCompletion(b) {
  const file = path.join(b.gate, b.phase + '-observer-results.json');
  const stat = fs.lstatSync(file);
  assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size <= 2 * 1024 * 1024);
  const raw = fs.readFileSync(file), value = JSON.parse(raw.toString('utf8'));
  assert.equal(value.schemaVersion, 1); assert.equal(value.feature, 'F32'); assert.equal(value.phase, b.phase);
  assert.equal(value.status, b.phase === 'upgrade-old' ? 'PASS_SCOPED_OLD_INSTALLED_SEED' : 'PASS_SCOPED_OBSERVER_API');
  assert.equal(value.failed, 0); assert.equal(value.notRun, 0); assert.equal(value.signalsRequested, 0);
  assert(Array.isArray(value.observations)); assert.equal(value.passed, value.observations.length);
  assert(typeof value.completionNonce === 'string' && /^[a-f0-9]{32}$/.test(value.completionNonce));
  return { completionNonce: value.completionNonce, observerResult: { path: file, bytes: raw.length, sha256: sha(raw) } };
}
// F32_COMPLETION_HANDSHAKE_END

'@
$outputs = @()
$originals = @()
foreach ($pair in @(
    @('installed-observer-proposed-05.cjs', 'installed-observer-proposed-06.cjs'),
    @('installed-upgrade-old-observer-proposed-04.cjs', 'installed-upgrade-old-observer-proposed-05.cjs')
)) {
    $inputPath = Join-Path $originalRoot $pair[0]
    $beforeHash = (Get-FileHash -LiteralPath $inputPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $original = [IO.File]::ReadAllText($inputPath).Replace("`r`n", "`n")
    $text = Replace-Exactly $original "let observedStage = 'PRELUDE';" ($observerHandshake + "let observedStage = 'PRELUDE';")
    if ($pair[0] -eq 'installed-observer-proposed-05.cjs') {
        $before = "  write(path.join(b.gate, b.phase + '-observer-results.json'), {"
        $after = "  const completionNonce = crypto.randomBytes(16).toString('hex');`n  const observerResultFile = path.join(b.gate, b.phase + '-observer-results.json');`n  write(observerResultFile, {`n    completionNonce,"
    } else {
        $before = "  write(path.join(b.gate, 'upgrade-old-observer-results.json'), {"
        $after = "  const completionNonce = crypto.randomBytes(16).toString('hex');`n  const observerResultFile = path.join(b.gate, 'upgrade-old-observer-results.json');`n  write(observerResultFile, {`n    completionNonce,"
    }
    $text = Replace-Exactly $text $before $after
    $text = Replace-Exactly $text "`n  await vscode.commands.executeCommand('workbench.action.closeWindow');" "`n  await awaitRendererCompletion(b, completionNonce, fact(observerResultFile));`n  await vscode.commands.executeCommand('workbench.action.closeWindow');"
    if ([regex]::Matches($original, 'await check\(').Count -ne [regex]::Matches($text, 'await check\(').Count) { throw 'Acceptance observation call count changed.' }
    $outputs += Write-NewReviewFile $pair[1] $text
    if ((Get-FileHash -LiteralPath $inputPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $beforeHash) { throw 'Frozen observer changed.' }
    $originals += [pscustomobject]@{path=$inputPath;sha256=$beforeHash}
}
$inputPath = Join-Path $originalRoot 'installed-renderer-proposed-05.cjs'
$beforeHash = (Get-FileHash -LiteralPath $inputPath -Algorithm SHA256).Hash.ToLowerInvariant()
$text = [IO.File]::ReadAllText($inputPath).Replace("`r`n", "`n")
$text = Replace-Exactly $text "let observedStage='PRELUDE',safeTrustMetadata,modalPhase,modalDiagnostic;" ($rendererHandshake + "let observedStage='PRELUDE',safeTrustMetadata,modalPhase,modalDiagnostic;")
$text = Replace-Exactly $text '  let browser;' '  let browser, completedRendererResult;'
$text = Replace-Exactly $text "        write(path.join(b.gate, b.phase + '-renderer-results.json'), {" "        completedRendererResult = {`n          ...rendererCompletion(b),"
$text = Replace-Exactly $text "          domActions: 'READ_ONLY_OBSERVATION', signalsRequested: 0,`n        });" "          domActions: 'READ_ONLY_OBSERVATION', signalsRequested: 0,`n        };"
$text = Replace-Exactly $text '    if (browser) await browser.close();' "    if (browser) await browser.close();`n    // Publish only after the attach-only CDP transport has disconnected.`n    if (completedRendererResult) write(path.join(b.gate, b.phase + '-renderer-results.json'), completedRendererResult);"
$outputs += Write-NewReviewFile 'installed-renderer-proposed-06.cjs' $text
if ((Get-FileHash -LiteralPath $inputPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $beforeHash) { throw 'Frozen renderer changed.' }
$originals += [pscustomobject]@{path=$inputPath;sha256=$beforeHash}
$record = [ordered]@{status='INERT_ACK_SUCCESSORS_PREPARED_NOT_EXECUTED';observedAt=[DateTime]::UtcNow.ToString('o');originals=$originals;outputs=$outputs;nativeLaunches=0;signalsRequested=0;newAcceptanceObservations=0}
$null = Write-NewReviewFile 'ack-preparation.json' (($record | ConvertTo-Json -Depth 8) + "`n")
$record | ConvertTo-Json -Depth 8
