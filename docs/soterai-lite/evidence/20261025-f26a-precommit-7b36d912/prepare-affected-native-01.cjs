"use strict";
// DOCS-ONLY migration: reads sealed evidence, writes new templates/custody.
// No child_process, Git, compiler, bundler, network or native launch is used.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), assert = require("node:assert/strict");
const ROOT = path.resolve(__dirname, "../../../.."), H26 = "docs/soterai-lite/evidence/20261025-f26a-precommit-7b36d912";
const H25 = "docs/soterai-lite/evidence/20261024-f25-logs-a41d9e62";
const TOKEN = "__F26A_AFFECTED_BOUND__", BOUND = "F26A_CURRENT_FACTS_BOUND";
const HASH = {
    pre: "87c827ebe9187a6f0e75b0f71ac5cbdea705494632109bfb2840923433907b4d",
    actual: "85112011c50ae8e8f70923385ab1e35693c31028006fc6a0e65ee6b1bce2e233",
    full: "5b381391b7161f21af4dc30c3d6594373bb307f8903ab74d739d4d3a688ad322",
    provenance: "fc7d56817bec6fe869cf2819ed833c77ac70695d6aff043e40a6245bafcbc2f6",
    fullReceipt: "2cfdcf7e1cf975b01dd73a0e2093452e0513d18e836b15ca2af91cb0822ad859",
    compilerReceipt: "1a75c0077efb49a8f98d9f83c66211e2219e0562753aeae50dcafe65e9b310ea",
    baseline: "c1cde060f5f062280b2e0961b49262569151ab716cf425b553363cb6f8646718",
    vsix: "bf23137b018e9c6f479ce537ba58898a4077fcdea8a0a785261a3446ac4cbd91",
    extension: "f1611d1d7931288560e1dc9342cfcd4541d6f1ee5a3b8642c6303f1883b58184",
    worker: "67b2ef79c9d132db6ed70e8cdd9bed85e5e920359beb71532c85dceb0db20449",
};
const VSIX = "packages/soterai-lite/soterai-lite-0.7.0-f26a-20261026-attempt01.vsix";
const BASELINE = "docs/soterai-lite/evidence/20261014-f06-vault-9c361a42/security-comparison-01.json";
const families = ["run-logs-native-01", "run-owned-output-native-01", "run-artifact-native-01", "run-affected-streaming-output-01",
    "run-affected-vault-runtime-01", "run-affected-ps51-01", "run-affected-cmd-01", "run-affected-gitbash-01", "run-affected-history-01",
    "run-mcp-native-01", "run-affected-editor-01", "run-affected-ci-01", "run-affected-service-account-01", "run-affected-registry-01",
    "run-affected-terraform-01", "run-affected-container-01", "run-affected-source-01", "run-affected-hygiene-01", "run-affected-vault-01", "run-retained-native-01"];
const controls = ["run-current-affected-suite-01", "run-affected-hosts-01", "run-functional-01", "run-security-01", "run-native-gates-01"];
const manifestName = "affected-native-template-manifest-01.json", receiptName = "affected-native-materialization-01.json";
const sum = value => crypto.createHash("sha256").update(value).digest("hex");
function absolute(relative) {
    assert(typeof relative === "string" && relative && !path.isAbsolute(relative));
    const result = path.resolve(ROOT, relative), part = path.relative(ROOT, result);
    assert(part && !part.startsWith("..") && !path.isAbsolute(part), "Evidence path escaped workspace.");
    for (let cursor = result; cursor !== ROOT; cursor = path.dirname(cursor)) if (fs.existsSync(cursor)) assert(!fs.lstatSync(cursor).isSymbolicLink(), "Linked evidence refused.");
    return result;
}
function bytes(relative) { const file = absolute(relative), stat = fs.lstatSync(file); assert(stat.isFile() && stat.nlink === 1); return fs.readFileSync(file); }
function fact(relative) { const value = bytes(relative); return { path: relative, bytes: value.length, sha256: sum(value) }; }
function json(relative) { return JSON.parse(bytes(relative).toString("utf8").replace(/^\uFEFF/, "")); }
function pinned(relative, hash, length) { const value = fact(relative); assert.equal(value.sha256, hash); if (length !== undefined) assert.equal(value.bytes, length); return value; }
function text(relative) { const value = bytes(relative); assert(!value.includes(0), "NUL source refused; retained failures cannot supply acceptance helpers."); return value.toString("utf8").replace(/\r\n/g, "\n"); }
function newFiles(outputs) {
    assert.equal(new Set(outputs.map(item => item.path)).size, outputs.length);
    for (const item of outputs) { assert(item.path.startsWith(H26 + "/")); assert(!fs.existsSync(absolute(item.path)), "Existing output refused: " + item.path); }
    for (const item of outputs) fs.writeFileSync(absolute(item.path), item.bytes, { flag: "wx" });
}
function checkedReceipt(name, hash) {
    const relative = H26 + "/" + name, frozen = pinned(relative, hash), value = json(relative);
    assert.equal(value.exitCode, 0, "Current gate is not actual exit0.");
    const raw = path.relative(ROOT, value.output).replaceAll("\\", "/"); assert(raw.startsWith(H26 + "/"));
    pinned(raw, String(value.sha256).toLowerCase()); return frozen;
}
function current() {
    const inputProof = pinned(H26 + "/full-inputs-02.json", HASH.full), full = json(inputProof.path);
    assert.equal(full.fileCount, 989); assert.equal(full.files.length, 989); assert.equal(new Set(full.files.map(item => item.path)).size, 989);
    for (const item of full.files) pinned(item.path, item.sha256, item.bytes);
    const provenance = pinned(H26 + "/native-driver-provenance-02.json", HASH.provenance), built = json(provenance.path);
    assert.equal(built.status, "BUILT_NOT_RUN_ESM_PARSER_INLINED"); assert.equal(built.drivers.length, 21);
    assert.equal(built.inputProof.path, inputProof.path); assert.equal(built.inputProof.sha256, HASH.full); assert.equal(built.inputProof.fileCount, 989);
    assert.equal(new Set(built.drivers.map(item => item.path)).size, 21);
    for (const item of built.drivers) { assert(/^prebuilt-native-hosts-02\/lite-[a-z0-9-]+-host[.]js$/.test(item.path)); pinned(H26 + "/" + item.path, item.sha256, item.bytes); }
    const fullReceipt = checkedReceipt("full-tests-02.txt.result.json", HASH.fullReceipt);
    const compilerReceipt = checkedReceipt("compiler-13.txt.result.json", HASH.compilerReceipt);
    pinned(VSIX, HASH.vsix); pinned(BASELINE, HASH.baseline);
    const baseline = json(BASELINE); assert.equal(baseline.rows.length, 17);
    assert.equal(baseline.rows.filter(row => row.current === "BLOCKED_SCOPED").length, 8);
    assert.equal(baseline.rows.filter(row => row.current === "LEAK_CONFIRMED").length, 9);
    assert.equal(new Set(baseline.rows.map(row => row.attack)).size, 17);
    return { inputProof, provenance, fullReceipt, compilerReceipt, drivers: built.drivers };
}
function sealed() {
    const preFact = pinned(H25 + "/pre-native-snapshots-01.json", HASH.pre), pre = json(preFact.path);
    assert.equal(pre.records.length, 48);
    for (const item of pre.records) {
        assert.equal(item.snapshot.sha256, item.sha256); assert.equal(item.snapshot.bytes, item.bytes);
        pinned(item.snapshot.path, item.sha256, item.bytes);
    }
    const actualFact = pinned(H25 + "/actual-native-execution-snapshots-01.json", HASH.actual), actual = json(actualFact.path);
    const retained = [
        ["functional10-driver.js", "retained-functional10-driver-01.js", "b64a85f99d9c5c3194b2bd427822116b7c59f8565dc3fc5477c27b92208a8b3b"],
        ["security17-driver.js", "retained-security17-driver-01.js", "de3e734ece51d89adaa58caec792c5d39b142d9e88cd17b2cda312099d0d38c9"],
    ].map(([source, target, hash]) => {
        const records = actual.records.filter(item => item.path === H25 + "/actual-native-execution-snapshots-01/" + source); assert.equal(records.length, 1);
        const item = records[0]; assert.equal(item.sha256, hash); pinned(item.path, hash, item.bytes);
        return { source: item, target: H26 + "/" + target, bytes: bytes(item.path) };
    });
    return { preFact, actualFact, pre, retained };
}
const oldGuard = "if('F25_CURRENT_FACTS_BOUND' -cne 'F25_CURRENT_FACTS_BOUND'){throw 'F25 template is PREPARED_NOT_BOUND; bind current checked facts in a new owned copy before execution.'}";
const newGuard = "if('" + TOKEN + "' -cne '" + BOUND + "'){throw 'F26A affected helper is PREPARED_NOT_BOUND; materialize a new checked owned copy.'}\n"
    + ". (Join-Path $PSScriptRoot 'affected-native-binding-01.ps1')\nAssert-F26AAffectedInputs";
const triple = "'extension.js','local-ai-broker.js','soterai-mcp-server.js'", four = triple + ",'pre-commit-client.js'";
function exactReplace(source, before, after, count, label) {
    const actual = source.split(before).length - 1; assert.equal(actual, count, label + ": source occurrence count changed"); return source.split(before).join(after);
}
function convert(stem, source) {
    let result = exactReplace(source, oldGuard, newGuard, 1, stem + " bound guard");
    assert(result.includes("Assert-F25EditorHost")); result = result.replaceAll("Assert-F25EditorHost", "Assert-F26AEditorHost");
    result = result.replaceAll("'f25-", "'f26a-").replaceAll("F25 savedlogs25/ownedoutput19", "F26a newly executed savedlogs25/ownedoutput19");
    result = result.replaceAll("prebuilt-native-hosts-01", "prebuilt-native-hosts-02");
    const copiesRuntime = families.includes(stem) || ["run-functional-01", "run-security-01"].includes(stem);
    result = exactReplace(result, triple, four, copiesRuntime ? 1 : 0, stem + " four-runtime loop");
    if (stem === "run-affected-hosts-01") {
        result = exactReplace(result, "$taskFunctionalDriver=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/p03-prebuilt-hosts/privacy-host.js'", "$taskFunctionalDriver=Join-Path $PSScriptRoot 'retained-functional10-driver-01.js'", 1, "functional sealed driver");
        result = exactReplace(result, "$taskSecurityDriver=Join-Path $taskRepo 'docs/soterai-lite/evidence/20261013-l0-resume-88fb9432/p03-prebuilt-hosts/security-host.js'", "$taskSecurityDriver=Join-Path $PSScriptRoot 'retained-security17-driver-01.js'", 1, "security sealed driver");
    }
    if (stem === "run-functional-01") {
        result = exactReplace(result, "$freeze = @{ runId=$runId;", "$freeze = @{ runtimeBindings=@(Get-F26ARuntimeBindings -ExecutionRoot $snapshot); runId=$runId;", 1, "functional execution runtime freeze");
        result = exactReplace(result, "exit $hostExit", "[void](Get-F26ARuntimeBindings -ExecutionRoot $snapshot)\nexit $hostExit", 1, "functional final runtime binding");
    }
    if (stem === "run-security-01") {
        result = exactReplace(result, "$launchRecord = @{ runId=$runId;", "$launchRecord = @{ runtimeBindings=@(Get-F26ARuntimeBindings -ExecutionRoot $extensionRoot); runId=$runId;", 1, "security execution runtime freeze");
        result = exactReplace(result, "exit $hostExitCode", "[void](Get-F26ARuntimeBindings -ExecutionRoot $extensionRoot)\nexit $hostExitCode", 1, "security final runtime binding");
    }
    assert(!result.includes("prebuilt-native-hosts-01") && !result.includes("Assert-F25EditorHost") && !result.includes(oldGuard));
    assert(result.includes("actual owned exit and both EOF") || !["run-functional-01", "run-security-01"].includes(stem), "Strict F24/F25 actual exit plus both EOF lost.");
    return result;
}
function binding(retained) {
    const retainedLines = retained.map(item => " @{path='" + path.basename(item.target) + "';bytes=" + item.bytes.length + ";sha256='" + sum(item.bytes) + "'}").join(",\n");
    return `if('${TOKEN}' -cne '${BOUND}'){throw 'F26A affected binding is PREPARED_NOT_BOUND.'}
function Assert-F26AAffectedInputs {
 $taskF26Repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
 . (Join-Path $PSScriptRoot 'host-current-binding-01.ps1')
 . (Join-Path $PSScriptRoot 'artifact-binding-01.ps1')
 Assert-F26AEditorHost
 if($ExpectedVsixSha256.ToLowerInvariant() -cne '${HASH.vsix}' -or $ExpectedBundleSha256.ToLowerInvariant() -cne '${HASH.extension}'){throw 'Only current exact F26a attempt01 artifact is admitted.'}
 if([IO.Path]::GetFullPath($VsixPath) -ine [IO.Path]::GetFullPath((Join-Path $taskF26Repo '${VSIX}'))){throw 'No historical artifact substitution.'}
 foreach($taskF26Fact in @(
  @{name='full-inputs-02.json';sha256='${HASH.full}'},
  @{name='native-driver-provenance-02.json';sha256='${HASH.provenance}'},
  @{name='full-tests-02.txt.result.json';sha256='${HASH.fullReceipt}'},
  @{name='compiler-13.txt.result.json';sha256='${HASH.compilerReceipt}'})){
  if((Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $taskF26Fact.name) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskF26Fact.sha256){throw 'Current F26a proof bytes changed.'}
 }
 $taskF26Full=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'full-inputs-02.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskF26Full.fileCount -ne 989 -or @($taskF26Full.files).Count -ne 989){throw 'Current989 source input proof required.'}
 foreach($taskF26Gate in @('full-tests-02.txt','compiler-13.txt')){
  $taskF26Receipt=Get-Content -LiteralPath (Join-Path $PSScriptRoot ($taskF26Gate+'.result.json')) -Raw -Encoding UTF8|ConvertFrom-Json
  if($taskF26Receipt.exitCode -ne 0 -or (Get-FileHash -LiteralPath (Join-Path $PSScriptRoot $taskF26Gate) -Algorithm SHA256).Hash.ToLowerInvariant() -cne ([string]$taskF26Receipt.sha256).ToLowerInvariant()){throw 'Actual current gate exit/raw binding required.'}
 }
 $taskF26Provenance=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'native-driver-provenance-02.json') -Raw -Encoding UTF8|ConvertFrom-Json
 if($taskF26Provenance.status -cne 'BUILT_NOT_RUN_ESM_PARSER_INLINED' -or @($taskF26Provenance.drivers).Count -ne 21 -or $taskF26Provenance.inputProof.sha256 -cne '${HASH.full}' -or $taskF26Provenance.inputProof.fileCount -ne 989){throw 'Current21-driver provenance required.'}
 $taskF26Allowed=@()
 foreach($taskF26Driver in $taskF26Provenance.drivers){
  if($taskF26Driver.path -notmatch '^prebuilt-native-hosts-02/lite-[a-z0-9-]+-host[.]js$'){throw 'Unexpected current driver path.'}
  $taskF26File=Join-Path $PSScriptRoot $taskF26Driver.path
  if((Get-Item -LiteralPath $taskF26File).Length -ne $taskF26Driver.bytes -or (Get-FileHash -LiteralPath $taskF26File -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskF26Driver.sha256){throw 'Current built driver bytes changed.'}
  $taskF26Allowed+=[IO.Path]::GetFullPath($taskF26File)
 }
 foreach($taskF26Driver in @(
${retainedLines})){
  $taskF26File=Join-Path $PSScriptRoot $taskF26Driver.path
  if((Get-Item -LiteralPath $taskF26File).Length -ne $taskF26Driver.bytes -or (Get-FileHash -LiteralPath $taskF26File -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskF26Driver.sha256){throw 'Sealed retained functional/security driver changed.'}
  $taskF26Allowed+=[IO.Path]::GetFullPath($taskF26File)
 }
 $taskF26HostVariable=Get-Variable -Name HostTestsPath -ErrorAction SilentlyContinue
 if($taskF26HostVariable -and ([string]::IsNullOrWhiteSpace([string]$taskF26HostVariable.Value) -or $taskF26Allowed -inotcontains [IO.Path]::GetFullPath([string]$taskF26HostVariable.Value))){throw 'Only exact current21 or sealed functional/security drivers are admitted; no rebuild fallback.'}
 $taskF26Extension=Join-Path $PSScriptRoot 'vsix-extracted-01/extension'
 $taskF26ExtensionVariable=Get-Variable -Name ExtensionRoot -ErrorAction SilentlyContinue
 if($taskF26ExtensionVariable -and -not [string]::IsNullOrWhiteSpace([string]$taskF26ExtensionVariable.Value)){$taskF26Extension=[IO.Path]::GetFullPath([string]$taskF26ExtensionVariable.Value)}
 Assert-F15bRuntimeBinding -VsixPath $VsixPath -ExpectedVsixSha256 $ExpectedVsixSha256 -ExtensionRoot $taskF26Extension -ExpectedBundleSha256 $ExpectedBundleSha256
 if((Get-FileHash -LiteralPath (Join-Path $taskF26Extension 'dist/pre-commit-client.js') -Algorithm SHA256).Hash.ToLowerInvariant() -cne '${HASH.worker}'){throw 'Exact new fourth worker bytes required.'}
 $taskF26Manifest=Get-Content -LiteralPath (Join-Path $taskF26Extension 'package.json') -Raw -Encoding UTF8|ConvertFrom-Json
 $taskF26Machines=@($taskF26Manifest.contributes.configuration.properties.PSObject.Properties|Where-Object{$_.Value.scope -ceq 'machine'})
 if($taskF26Machines.Count -ne 82 -or $taskF26Manifest.contributes.configuration.properties.'soterai.lite.historyHooks.preCommit'.default -ne $false -or $taskF26Manifest.contributes.configuration.properties.'soterai.lite.historyHooks.preCommit'.scope -cne 'machine'){throw 'Current82 machine settings/default-off hook registration required.'}
 $taskF26Baseline=Join-Path $taskF26Repo '${BASELINE}'
 if((Get-FileHash -LiteralPath $taskF26Baseline -Algorithm SHA256).Hash.ToLowerInvariant() -cne '${HASH.baseline}'){throw 'Retained security baseline bytes changed.'}
}
function Get-F26ARuntimeBindings {
 param([Parameter(Mandatory=$true)][string]$ExecutionRoot)
 Assert-F26AAffectedInputs
 $taskF26Source=Join-Path $PSScriptRoot 'vsix-extracted-01/extension'
 foreach($taskF26Name in @('extension.js','local-ai-broker.js','soterai-mcp-server.js','pre-commit-client.js')){
  $taskF26Original=Join-Path $taskF26Source ('dist/'+$taskF26Name);$taskF26Executed=Join-Path $ExecutionRoot ('dist/'+$taskF26Name)
  $taskF26Sha=(Get-FileHash -LiteralPath $taskF26Original -Algorithm SHA256).Hash.ToLowerInvariant();$taskF26Bytes=(Get-Item -LiteralPath $taskF26Original).Length
  if((Get-Item -LiteralPath $taskF26Executed).Length -ne $taskF26Bytes -or (Get-FileHash -LiteralPath $taskF26Executed -Algorithm SHA256).Hash.ToLowerInvariant() -cne $taskF26Sha){throw 'Execution runtime differs from exact current VSIX extraction.'}
  @{name=$taskF26Name;bytes=$taskF26Bytes;sha256=$taskF26Sha;source=$taskF26Original;execution=$taskF26Executed}
 }
}
`;
}
function prepare() {
    const proof = current(), history = sealed(), outputs = [], records = [];
    for (const stem of [...families, ...controls]) {
        const matches = history.pre.records.filter(item => path.posix.basename(item.snapshot.path) === stem + ".ps1"); assert.equal(matches.length, 1);
        const source = matches[0].snapshot, target = H26 + "/" + stem + ".template.ps1", converted = Buffer.from(convert(stem, text(source.path)));
        records.push({ source, target, bytes: converted.length, sha256: sum(converted), kind: families.includes(stem) ? "CURRENT_NATIVE_FAMILY" : "AFFECTED_CONTROL" });
        outputs.push({ path: target, bytes: converted });
    }
    const guard = Buffer.from(binding(history.retained)), guardPath = H26 + "/affected-native-binding-01.template.ps1";
    records.push({ target: guardPath, bytes: guard.length, sha256: sum(guard), kind: "CURRENT_INPUT_ARTIFACT_PROVENANCE_BINDING" }); outputs.push({ path: guardPath, bytes: guard });
    for (const item of history.retained) outputs.push({ path: item.target, bytes: item.bytes });
    const manifest = { status: "PREPARED_NOT_BOUND_NO_NATIVE_EXECUTION", createdAt: new Date().toISOString(), generator: fact(H26 + "/prepare-affected-native-01.cjs"),
        sealedPreNative: history.preFact, sealedActualNative: history.actualFact, sealedSnapshotFilesVerified: 48,
        current: proof, artifact: { path: VSIX, sha256: HASH.vsix, extensionSha256: HASH.extension, workerSha256: HASH.worker, runtimeCount: 4, machineSettings: 82 },
        familyCount: 20, plannedNativeChecks: 509, plannedPhases: 37, functionalChecks: 10, securityChecks: 17, securityBaseline: { path: BASELINE, sha256: HASH.baseline, blocked: 8, leakConfirmed: 9 },
        templates: records, retainedDrivers: history.retained.map(item => ({ source: item.source, target: item.target, bytes: item.bytes.length, sha256: sum(item.bytes), role: "SEALED_DRIVER_BYTES_TO_RERUN_NEW_ARTIFACT_NOT_OLD_RESULT" })),
        sharedGuardsOwnedByRoot: ["host-current-binding-01.ps1", "artifact-binding-01.ps1"],
        execution: "NOT_RUN; NO_H25_ACCEPTANCE_TRANSFER; PRECOMMIT_NATIVE_LAUNCHER_SEPARATE_ROOT_OWNED", syntax: "NOT_YET_CHECKED" };
    outputs.push({ path: H26 + "/" + manifestName, bytes: Buffer.from(JSON.stringify(manifest, null, 2) + "\n") });
    newFiles(outputs); console.log(JSON.stringify({ status: manifest.status, templates: records.length, sealedDrivers: 2, manifest: fact(H26 + "/" + manifestName) }));
}
function materialize() {
    const proof = current(), manifest = json(H26 + "/" + manifestName), outputs = [], guards = [];
    assert.equal(manifest.status, "PREPARED_NOT_BOUND_NO_NATIVE_EXECUTION"); assert.equal(manifest.familyCount, 20); assert.equal(manifest.templates.length, 26);
    assert.deepEqual(manifest.current, proof); assert.equal(manifest.generator.sha256, fact(H26 + "/prepare-affected-native-01.cjs").sha256);
    for (const name of manifest.sharedGuardsOwnedByRoot) {
        const relative = H26 + "/" + name, source = text(relative); assert(!/__F26A_[A-Z0-9_]+__/.test(source), "Root guard remains unbound.");
        assert(source.includes(BOUND)); guards.push(fact(relative));
    }
    for (const item of manifest.retainedDrivers) pinned(item.target, item.sha256, item.bytes);
    for (const item of manifest.templates) {
        pinned(item.target, item.sha256, item.bytes); const source = text(item.target); assert.equal(source.split(TOKEN).length - 1, 1);
        const converted = source.replace(TOKEN, BOUND); assert(!/__F26A_[A-Z0-9_]+__/.test(converted));
        outputs.push({ path: item.target.replace(".template.ps1", ".ps1"), bytes: Buffer.from(converted) });
    }
    const result = { status: "MATERIALIZED_NOT_EXECUTED", createdAt: new Date().toISOString(), manifest: fact(H26 + "/" + manifestName), current: proof, guards,
        outputs: outputs.map(item => ({ path: item.path, bytes: item.bytes.length, sha256: sum(item.bytes) })), nativeExecution: "NOT_RUN", syntax: "SEPARATE_PARSE_REQUIRED" };
    outputs.push({ path: H26 + "/" + receiptName, bytes: Buffer.from(JSON.stringify(result, null, 2) + "\n") });
    newFiles(outputs); console.log(JSON.stringify({ status: result.status, outputs: result.outputs.length, receipt: fact(H26 + "/" + receiptName) }));
}
assert.deepEqual(process.argv.slice(2).length, 1, "Specify exactly --prepare or --materialize; neither launches native code.");
if (process.argv[2] === "--prepare") prepare(); else if (process.argv[2] === "--materialize") materialize(); else throw Error("Only explicit docs preparation/materialization modes are admitted.");
