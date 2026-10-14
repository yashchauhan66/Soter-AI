const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const write = (name, text) => fs.writeFileSync(path.join(__dirname, name), text, { flag: 'wx' });
const replace = (text, from, to) => {
  if (!text.includes(from)) throw new Error('Expected launcher fragment absent: ' + from);
  return text.replace(from, to);
};
let inspection = fs.readFileSync(path.join(__dirname, 'inspect-vsix-01.ps1'), 'utf8');
for (const [from, to] of [['attempt01.vsix', 'attempt02.vsix'], ['vsix-extracted-01', 'vsix-extracted-02'], ['vsix-inspection-01.json', 'vsix-inspection-02.json']]) inspection = replace(inspection, from, to);
write('inspect-vsix-02.ps1', inspection);
const settings = "'chat.disableAIFeatures'=$true; 'git.enabled'=$false; 'git.autoRepositoryDetection'=$false; 'git.openRepositoryInParentFolders'='never'; 'typescript.disableAutomaticTypeAcquisition'=$true; 'workbench.enableExperiments'=$false; 'extensions.ignoreRecommendations'=$true; 'telemetry.telemetryLevel'='off'";
const disabled = "'--disable-extensions', '--disable-extension=vscode.git', '--disable-extension=vscode.github', '--disable-extension=vscode.github-authentication', '--disable-extension=vscode.microsoft-authentication', '--disable-extension=vscode.typescript-language-features', '--disable-extension=vscode.npm', '--disable-extension=vscode.extension-editing', '--disable-workspace-trust'";
let functional = fs.readFileSync(path.join(__dirname, 'run-functional-02.ps1'), 'utf8');
functional = replace(functional, "$workspace = Join-Path $runRoot 'workspace'", "$workspace = Join-Path (Split-Path -Parent $profile) 'workspace'");
functional = replace(functional, "$publicParent = Join-Path $runRoot 'public-output'", "$publicParent = Join-Path (Split-Path -Parent $profile) 'public-output'");
functional = replace(functional, "'telemetry.telemetryLevel'='off'", settings);
functional = replace(functional, "'--disable-extensions', '--disable-workspace-trust'", disabled);
write('run-functional-03.ps1', functional);
let security = fs.readFileSync(path.join(__dirname, 'run-security-02.ps1'), 'utf8');
security = replace(security, "'telemetry.telemetryLevel'='off'", settings);
security = replace(security, "'--disable-extensions', '--disable-workspace-trust'", disabled);
write('run-security-03.ps1', security);
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const failedRun = 'current-native-d-host-20261014T075325Z-4b1c5c14';
const failedResult = path.join('D:/SoterAI-Lite-test-profiles', failedRun, 'save-results.json');
const failure = JSON.parse(fs.readFileSync(failedResult, 'utf8'));
if (failure.failed !== 7 || failure.passed !== 1) throw new Error('Historical native count mismatch.');
write('source-review-02.md', '# F03 follow-up source review\n\nIndependence LOW: same-lineage read-only reviewer. No concrete blocker found in invalid-root transition notification deduplication. The first invalid transition still revokes owned masked views even without session grants; repeated invalid reads do not emit another refresh, and valid recovery rearms. Root-specific generic revocation and manual-intent S27 remain unchanged. RF01–RF04 safely bound host-like rereads and cover concurrent failures/recovery/disabled policy. Actual earlier renderer OOM cause is UNVERIFIED.\n\nNative fixture correction: accepted permanence is captured only after an actual public managed read enrolls F02 defaults, with explicit schema2/manual/policy positive assertions. Source-drift case changes a comment only, preserving its exact unchanged-permanence assertion. All original deny, masked-value, native diff, real cooldown and restart assertions remain. Prior failing host drivers/results are retained.\n');
const receipt = {
  status: 'VERIFYING_INCOMPLETE', observedAt: new Date().toISOString(),
  currentCodeVersion: '1.141.1', updateCompleted: true,
  historicalCurrentLaunch02: 'Renderer OOM before behavioral results; zero-byte driver-error retained. Cause UNVERIFIED.',
  discardedExecCell7: 'functions.wait returned exec cell 7 not found; no launch03 files existed at resumption. INCOMPLETE orchestration, not product failure.',
  nativeLaunch03: 'D workspace ran all save cases: 1PASS/7FAIL; old diagnostic first-line only.',
  nativeLaunch04: { path: failedResult, sha256: sha(failedResult), passed: failure.passed, failed: failure.failed, cause: 'Native fixture captured legacy pre-enrollment {manual:undefined,policy:undefined} then compared it with correctly enrolled stronger policy. Source fixture also added deny while asserting unchanged permanence.' },
  refresh: { before: 'refresh-before-01.txt:4FAIL', after: 'refresh-after-01.txt:4PASS', focused: 'focused-after-05.txt:65PASS', rollback: 'Repeated-read dedup never releases an invalid root; first invalid transition still clears owned approvals.' },
  delegatedHostDiagnosis: 'Agent errored: You’ve hit your usage limit. Upgrade to Pro (https://chatgpt.com/explore/pro), visit https://chatgpt.com/settings/usage to purchase more credits or try again at 12:57 PM.',
  fullSuite: 'full-tests-06 pending at preparation; earlier 915 test pass belongs to source before RF fix.',
  next: 'Matching typecheck/new VSIX attempt02/native/functional/security/scoped commit; no F04 production.',
};
write('host-resume-02.json', JSON.stringify(receipt, null, 2) + '\n');
fs.appendFileSync(path.resolve(__dirname, '../../ledger.md'), '\n## STEP RECEIPT F03-RESUME-02 — updated host and refresh regression\n\nCurrent Code1.141.1 update complete; no updater/process/profile changes by the agent. Current launch02 ended renderer OOM before behavioral results; cause UNVERIFIED. Missing exec cell7 produced `exec cell 7 not found`, with no launch03 files at resumption: INCOMPLETE orchestration. Authorized new D-workspace launches03/04 each ran eight save cases:1PASS/7FAIL, retained on D with SHA in host-resume-02.json. Detailed scrubbed diagnostics prove fixture captured legacy pre-enrollment manual/policy undefined before actual default enrollment; fixture now captures after actual managed public read, explicitly asserts schema2/manual/policy, and retains exact permanence/deny/masking/native-diff/cooldown/restart assertions. Comment-only source drift avoids adding a deny while claiming unchanged permanence. No earlier host PASS inferred.\n\nFour new RF01–RF04 regressions all failed in refresh-before-01.txt before source fix; refresh-after-01.txt4PASS and focused-after-05.txt65PASS. First invalid-root transition marks before firing and still revokes all owned approvals; repeated invalid provider rereads cannot generate recursive refresh; valid recovery rearms. Generic root/manual-intent revocation remains unchanged. Same-lineage read-only adversarial review LOW found no concrete blocker; no proven renderer OOM causal claim. Delegated host diagnosis usage-limit failure retained verbatim in host-resume-02.json; root continued authorized work.\n\nF03 remains VERIFYING/INCOMPLETE, no F04 production. New matching complete suite/typecheck/artifact attempt02/current host/affected baselines/scoped commit remain the serial barrier. Historical 915 tests and VSIX attempt01 belong to earlier source. All raw receipts and failed results preserved. Exact commands/exits/hashes in immutable *.result.json; changed source hashes will be frozen in the final F03 evidence index. Nine unmanaged leaks and human/actual-tool gaps remain; rating PENDING.\n');
console.log(JSON.stringify({ status: 'PREPARED_NOT_RUN', nextArtifact: 'attempt02', historicalNativeFailureRetained: failedResult, historicalNativeSha256: sha(failedResult) }));
