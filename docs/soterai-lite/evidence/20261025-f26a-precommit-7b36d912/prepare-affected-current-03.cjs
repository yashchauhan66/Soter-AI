"use strict";
// Evidence-only authoring/materialization. Never invokes a behavior gate.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), assert = require("node:assert/strict");
const repo = path.resolve(__dirname, "../../../.."), base = path.relative(repo, __dirname).replaceAll("\\", "/");
const TOKEN = "__F26A_AFFECTED03_BOUND__", BOUND = "F26A_CURRENT_FACTS_BOUND", BIND_HASH = "__F26A_NATIVE_CURRENT03_SHA256__";
const FIXTURE = "packages/vscode-extension/src/__tests__/host/litePreCommitGuard.host.ts";
const PIN = { source: "f94d6ca5ea2ff2499dbf76ea5f82239160806a7dc35bad5d42b79a7d5edb6aab", full: "5b381391b7161f21af4dc30c3d6594373bb307f8903ab74d739d4d3a688ad322",
    compiler: "4f78702568234099b8b827d30b929208c4c58b2464482f6ce22cfbb0bf5d8ddd", fullReceipt: "2cfdcf7e1cf975b01dd73a0e2093452e0513d18e836b15ca2af91cb0822ad859",
    nativeBinding: "df37214d1c6af39677175f4cd8245d6cfa314488aed520110e73fa2f582bb612", provenance: "a0889724025f85fdd8fc9705f9c19c55ccbb4b36bdde44510500e41212c3c33c",
    equivalence: "837236c08710d3583eca0349dff7c93078ee3e2c1990b8233e06ea166dc0a20d", host: "8468eff27ee910978aa7d6a9fba10dc4c387631fd39ffa84580a6d1119390fc2",
    oldProvenance: "fc7d56817bec6fe869cf2819ed833c77ac70695d6aff043e40a6245bafcbc2f6", correction: "eca02522e7c155e7ae5312f55aa868657231d6ad40f94593f5f10e78a76b48fb",
    pipe: "246b0ccdb2457fd80f560770b129a1fde67d5d4212e8eae200f965dffd69698c", vsix: "bf23137b018e9c6f479ce537ba58898a4077fcdea8a0a785261a3446ac4cbd91" };
const hash = raw => crypto.createHash("sha256").update(raw).digest("hex");
function absolute(relative) { assert(typeof relative === "string" && relative && !path.isAbsolute(relative)); const file = path.resolve(repo, relative); assert(file.startsWith(repo + path.sep));
    for (let cursor = file;; cursor = path.dirname(cursor)) { assert(!fs.lstatSync(cursor).isSymbolicLink(), "Linked workspace fact."); if (cursor === repo) break; } return file; }
function raw(relative) { const file = absolute(relative), stat = fs.lstatSync(file); assert(stat.isFile() && stat.nlink === 1); return fs.readFileSync(file); }
const read = relative => JSON.parse(raw(relative).toString("utf8").replace(/^\uFEFF/, ""));
function fact(relative) { const value = raw(relative); return { path: relative, bytes: value.length, sha256: hash(value) }; }
function check(item) { assert.deepEqual(fact(item.path), { path: item.path, bytes: item.bytes, sha256: item.sha256 }); }
function pinned(relative, sha) { const result = fact(relative); assert.equal(result.sha256, sha); return result; }
function emit(outputs) {
    assert.equal(new Set(outputs.map(item => item.path)).size, outputs.length);
    for (const item of outputs) { assert(item.path.startsWith(base + "/") && !fs.existsSync(path.resolve(repo, item.path)), "Existing successor refused."); }
    for (const item of outputs) fs.writeFileSync(path.resolve(repo, item.path), item.bytes, { flag: "wx" });
}
function source02() {
    const correction = pinned(base + "/affected-pipe-ownership-correction-02.json", PIN.correction), value = read(correction.path);
    assert.equal(value.records.length, 25); assert.equal(value.correctedLaunchers, 22); assert.equal(value.aggregateRedirects, 3); check(value.helper); assert.equal(value.helper.sha256, PIN.pipe);
    for (const item of value.records) { check(item.source); check(item.beforeSnapshot); check(item.target); }
    return { correction, value };
}
function current() {
    const bindingFact = pinned(base + "/native-current-binding-03.json", PIN.nativeBinding), binding = read(bindingFact.path);
    assert.equal(binding.status, "NATIVE_FIXTURE_ONLY_EQUIVALENCE_CHECKED"); assert.equal(binding.unchangedOtherInputs, 988);
    assert.equal(binding.unchangedAffectedDrivers, 20); assert.equal(binding.changedFixture, FIXTURE);
    for (const item of [binding.sourceProof, binding.fullSourceProof, binding.fullReceipt, binding.compilerReceipt, binding.driverProvenance, binding.vsix, binding.equivalence, binding.hostBinding]) check(item);
    const expected = [["sourceProof", "native-source-inputs-03.json", PIN.source], ["fullSourceProof", "full-inputs-02.json", PIN.full],
        ["fullReceipt", "full-tests-02.txt.result.json", PIN.fullReceipt], ["compilerReceipt", "compiler-14.txt.result.json", PIN.compiler],
        ["driverProvenance", "native-driver-provenance-03.json", PIN.provenance], ["equivalence", "native-fixture-equivalence-03.json", PIN.equivalence], ["hostBinding", "host-current-binding-02.ps1", PIN.host]];
    for (const [field, name, digest] of expected) { assert.equal(binding[field].path, base + "/" + name); assert.equal(binding[field].sha256, digest); }
    assert.equal(binding.driverProvenance.path, base + "/native-driver-provenance-03.json"); assert.equal(binding.vsix.path, "packages/soterai-lite/soterai-lite-0.7.0-f26a-20261026-attempt01.vsix"); assert.equal(binding.vsix.sha256, PIN.vsix);
    for (const role of ["fullReceipt", "compilerReceipt"]) { const result = read(binding[role].path); assert.equal(result.exitCode, 0); const output = path.relative(repo, result.output).replaceAll("\\", "/"); assert(output.startsWith(base + "/")); pinned(output, String(result.sha256).toLowerCase()); }
    const equivalence = read(binding.equivalence.path);
    assert.equal(equivalence.status, "NATIVE_FIXTURE_ONLY_EQUIVALENCE_CHECKED"); assert.deepEqual(equivalence.sourceProof, binding.sourceProof); assert.deepEqual(equivalence.fullSourceProof, binding.fullSourceProof);
    assert.equal(equivalence.changedFixture, FIXTURE); assert.equal(equivalence.unchangedOtherInputs, 988); assert.equal(equivalence.unchangedAffectedDrivers, 20); assert.equal(equivalence.equality.length, 20); assert.deepEqual(equivalence.vsix, binding.vsix);
    for (const [name, receipt] of [["historicalFull", binding.fullReceipt], ["compiler", binding.compilerReceipt], ["build", undefined]]) {
        const gate = equivalence[name]; check(gate.raw); check(gate.receipt); if (receipt) assert.deepEqual(gate.receipt, receipt);
        const result = read(gate.receipt.path); assert.equal(result.exitCode, 0); assert.equal(String(result.sha256).toLowerCase(), gate.raw.sha256);
        assert.equal(path.relative(repo, result.output).replaceAll("\\", "/"), gate.raw.path);
        if (name === "build") { assert.equal(gate.raw.path, base + "/native-build-03.txt"); assert.equal(gate.receipt.path, base + "/native-build-03.txt.result.json"); }
    }
    const old = read(binding.fullSourceProof.path), source = read(binding.sourceProof.path); assert.equal(old.fileCount, 989); assert.equal(old.files.length, 989); assert.equal(new Set(old.files.map(item => item.path)).size, 989); assert.equal(source.fileCount, 989); assert.equal(source.files.length, 989);
    assert.equal(source.status, "NATIVE_ONLY_FIXTURE_CORRECTED_INPUT_PROOF_NOT_NEW_FULL_EXECUTION"); assert.equal(source.allowedNativeOnlyDelta, FIXTURE); assert.equal(source.unchangedFullInputs, 988);
    assert.equal(new Set(source.files.map(item => item.path)).size, 989); const changes = [];
    for (const item of source.files) { check(item); const previous = old.files.filter(row => row.path === item.path); assert.equal(previous.length, 1); if (item.bytes !== previous[0].bytes || item.sha256 !== previous[0].sha256) changes.push(item.path); }
    assert.deepEqual(changes, [FIXTURE]);
    const before = old.files.find(item => item.path === FIXTURE), archive = base + "/litePreCommitGuard.host.ts.before-CodeExpectedError-01.txt";
    const beforeFact = fact(archive); assert.equal(beforeFact.bytes, before.bytes); assert.equal(beforeFact.sha256, before.sha256);
    const beforeText = raw(archive).toString("utf8"), afterText = raw(FIXTURE).toString("utf8"); assert.equal(beforeText.split('"ExpectedError"').length - 1, 1); assert.equal(beforeText.replace('"ExpectedError"', '"CodeExpectedError"'), afterText);
    const oldFact = pinned(base + "/native-driver-provenance-02.json", PIN.oldProvenance), previous = read(oldFact.path), built = read(binding.driverProvenance.path);
    assert.equal(built.status, "BUILT_NOT_RUN_ESM_PARSER_INLINED"); assert.equal(built.drivers.length, 21); assert.equal(previous.drivers.length, 21); assert.equal(new Set(built.drivers.map(item => path.basename(item.path))).size, 21);
    assert.equal(built.inputProof.path, binding.sourceProof.path); assert.equal(built.inputProof.sha256, PIN.source); assert.equal(built.inputProof.fileCount, 989);
    let unchanged = 0, changed = 0; const equalityNames = new Set();
    for (const item of built.drivers) { assert(/^prebuilt-native-hosts-03\/lite-[a-z0-9-]+-host[.]js$/.test(item.path)); check({ ...item, path: base + "/" + item.path });
        const prior = previous.drivers.filter(row => path.basename(row.path) === path.basename(item.path)); assert.equal(prior.length, 1); check({ ...prior[0], path: base + "/" + prior[0].path });
        if (path.basename(item.path) === "lite-precommit-guard-host.js") { assert.notEqual(item.sha256, prior[0].sha256); changed++; }
        else { assert.equal(item.bytes, prior[0].bytes); assert.equal(item.sha256, prior[0].sha256); unchanged++;
            const equal = equivalence.equality.filter(row => row.name === path.basename(item.path)); assert.equal(equal.length, 1); assert(!equalityNames.has(equal[0].name)); equalityNames.add(equal[0].name);
            assert.deepEqual(equal[0].before, { path: base + "/" + prior[0].path, bytes: prior[0].bytes, sha256: prior[0].sha256 });
            assert.deepEqual(equal[0].after, { path: base + "/" + item.path, bytes: item.bytes, sha256: item.sha256 });
        }
    }
    assert.equal(unchanged, 20); assert.equal(changed, 1); assert.equal(equalityNames.size, 20); return { bindingFact, binding, fixtureBefore: beforeFact, oldProvenance: oldFact };
}
function prepare() {
    const previous = source02(), records = [], outputs = [], names = previous.value.records.map(item => path.posix.basename(item.target.path));
    for (const item of previous.value.records) {
        let source = raw(item.target.path).toString("utf8");
        const oldGuard = "if('F26A_CURRENT_FACTS_BOUND' -cne 'F26A_CURRENT_FACTS_BOUND')";
        assert.equal(source.split(oldGuard).length - 1, 1); source = source.replace(oldGuard, "if('" + TOKEN + "' -cne '" + BOUND + "')");
        source = source.replaceAll("'affected-native-binding-01.ps1'", "'affected-native-binding-03.ps1'").replaceAll("'host-current-binding-01.ps1'", "'host-current-binding-02.ps1'").replaceAll("prebuilt-native-hosts-02", "prebuilt-native-hosts-03");
        for (const name of names) source = source.replaceAll("'" + name + "'", "'" + name.replace(/-02[.]ps1$/, "-03.ps1") + "'");
        assert(!source.includes("'host-current-binding-01.ps1'") && !source.includes("'affected-native-binding-01.ps1'") && !source.includes("prebuilt-native-hosts-02"));
        const afterTimers = [...source.matchAll(/(?:TotalSeconds -lt |WaitForExit\()([0-9]+)/g)].map(row => row[0]); assert.deepEqual(afterTimers, item.timeoutExpressionsUnchanged);
        if (item.correctedOwnedProcessSites) { assert(source.includes("Complete-F26AOwnedProcess") && source.includes("'native-pipe-ownership-02.ps1'")); assert(!/finally\s*\{\s*\$(?:taskProcess|process)[.]Dispose\(/.test(source)); }
        const target = item.target.path.replace(/-02[.]ps1$/, "-03.template.ps1"), value = Buffer.from(source);
        outputs.push({ path: target, bytes: value }); records.push({ source: item.target, target: { path: target, bytes: value.length, sha256: hash(value) }, correctedOwnedProcessSites: item.correctedOwnedProcessSites, timeoutExpressionsUnchanged: afterTimers });
    }
    const guard = fact(base + "/affected-native-binding-03.template.ps1");
    const result = { status: "PREPARED_NOT_BOUND_CURRENT03_PENDING_ACTUAL_BUILD_EQUIVALENCE", createdAt: new Date().toISOString(), generator: fact(base + "/prepare-affected-current-03.cjs"),
        previousCorrection: previous.correction, pipeOwnershipHelper: previous.value.helper, guard, records,
        requiredBinding: base + "/native-current-binding-03.json", requiredHostGuard: base + "/host-current-binding-02.ps1",
        sourceProof: { path: base + "/native-source-inputs-03.json", sha256: PIN.source }, historicalFull: { path: base + "/full-inputs-02.json", sha256: PIN.full },
        scope: "25 new unbound launcher/control templates plus separate new03guard. Counts/timeout expressions/pipe-safe finally retained; only current fixture/provenance/host bindings and successor references change. No old01/02 mutation or native execution." };
    outputs.push({ path: base + "/affected-native-template-manifest-03.json", bytes: Buffer.from(JSON.stringify(result, null, 2) + "\n") }); emit(outputs);
    console.log(JSON.stringify({ status: result.status, templates: 26, manifest: fact(base + "/affected-native-template-manifest-03.json") }));
}
function materialize() {
    const now = current(), previous = source02(), manifest = read(base + "/affected-native-template-manifest-03.json"), outputs = [];
    assert.equal(manifest.status, "PREPARED_NOT_BOUND_CURRENT03_PENDING_ACTUAL_BUILD_EQUIVALENCE"); assert.equal(manifest.records.length, 25);
    check(manifest.generator); check(manifest.previousCorrection); check(manifest.pipeOwnershipHelper); check(manifest.guard);
    assert.deepEqual(manifest.previousCorrection, previous.correction); assert.deepEqual(manifest.pipeOwnershipHelper, previous.value.helper);
    assert.deepEqual(manifest.records.map(item => item.source), previous.value.records.map(item => item.target));
    assert.equal(manifest.guard.path, base + "/affected-native-binding-03.template.ps1");
    const guards = ["host-current-binding-02.ps1", "artifact-binding-01.ps1"].map(name => { const relative = base + "/" + name, source = raw(relative).toString("utf8"); assert(source.includes(BOUND) && !/__F26A_[A-Z0-9_]+__/.test(source), "Root current guard remains unbound."); return fact(relative); });
    for (const item of [...manifest.records.map(row => row.target), manifest.guard]) {
        check(item); let value = raw(item.path).toString("utf8"); assert.equal(value.split(TOKEN).length - 1, 1); value = value.replace(TOKEN, BOUND);
        if (item.path === manifest.guard.path) { assert.equal(value.split(BIND_HASH).length - 1, 1); value = value.replace(BIND_HASH, now.bindingFact.sha256); }
        assert(!/__F26A_[A-Z0-9_]+__/.test(value)); outputs.push({ path: item.path.replace(".template.ps1", ".ps1"), bytes: Buffer.from(value) });
    }
    const result = { status: "MATERIALIZED_CURRENT03_NOT_EXECUTED", createdAt: new Date().toISOString(), manifest: fact(base + "/affected-native-template-manifest-03.json"), current: now, guards,
        pipeOwnershipHelper: manifest.pipeOwnershipHelper, outputs: outputs.map(item => ({ path: item.path, bytes: item.bytes.length, sha256: hash(item.bytes) })),
        historicalFullAttribution: "FULL02_CURRENT_PRODUCT_AND_UNIT_WITH_ONLY_EXACT_NATIVE_FIXTURE_LITERAL_DELTA;NOT_A_NEW_FULL_RUN", nativeExecution: "NOT_RUN", syntax: "SEPARATE_PARSE_REQUIRED" };
    outputs.push({ path: base + "/affected-native-materialization-03.json", bytes: Buffer.from(JSON.stringify(result, null, 2) + "\n") }); emit(outputs);
    console.log(JSON.stringify({ status: result.status, outputs: result.outputs.length, receipt: fact(base + "/affected-native-materialization-03.json") }));
}
assert.equal(process.argv.length, 3, "Specify --prepare or --materialize explicitly; neither launches a gate.");
if (process.argv[2] === "--prepare") prepare(); else if (process.argv[2] === "--materialize") materialize(); else throw Error("Only explicit evidence preparation/materialization modes admitted.");
