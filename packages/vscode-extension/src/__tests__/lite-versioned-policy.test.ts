import assert from "node:assert/strict";
import { test } from "node:test";
import { documentDigest, matchesGlob, parseManualRules } from "../ai-boundary/policy";
import { CREDENTIAL_PATTERNS, STACK_PRESETS, defaultVersionedPolicy, exportVersionedPolicy, MAX_POLICY_BYTES, MAX_SENSITIVE_GLOBS,
    mergeVersionedPolicies, parseStoredPolicy, parseVersionedPolicy, parseVersionedPolicyText, versionedPolicyBlocks, versionedPolicySensitive } from "../ai-boundary/VersionedPolicy";
const empty = () => ({ schemaVersion: 1, presets: [], rules: { paths: [], regions: [] }, sensitiveGlobs: [] });
test("F02-P01 curated credential registry has 200+ distinct valid patterns and real matching samples", () => {
    assert.ok(CREDENTIAL_PATTERNS.length >= 200);
    assert.equal(new Set(CREDENTIAL_PATTERNS.map(row => row.pattern)).size, CREDENTIAL_PATTERNS.length);
    assert.equal(new Set(CREDENTIAL_PATTERNS.map(row => row.id)).size, CREDENTIAL_PATTERNS.length);
    assert.ok(new Set(CREDENTIAL_PATTERNS.map(row => row.family)).size >= 10);
    for (const row of CREDENTIAL_PATTERNS) {
        assert.ok(row.reason.length > 30 && row.sample.length > 0);
        assert.equal(matchesGlob(row.sample, row.pattern), true, row.pattern);
        const near = row.pattern.endsWith("/**") ? row.sample.replace(/\/[^/]+$/, "-public/visible")
            : row.sample.replace(/[^/]+$/, "public-source.ts");
        assert.equal(matchesGlob(near, row.pattern), false, `Per-pattern public near-match: ${row.pattern}`);
    }
});
test("F02-P02 independent credential/public corpus distinguishes exact names and paths", () => {
    const policy = defaultVersionedPolicy();
    for (const filename of ["nested/.env.local", ".aws/credentials", ".config/gcloud/application_default_credentials.json", ".docker/config.json", ".kube/config", "config/master.key", "keys/id_ecdsa", ".cargo/credentials.toml", "infra/stack.tfstate", "credentials.properties", "service-account.json", ".codex/auth.json", "database-password.txt"]) {
        assert.equal(versionedPolicyBlocks(filename, policy), true, filename); assert.equal(versionedPolicySensitive(filename, policy), true, filename);
    }
    for (const filename of ["README.md", "src/auth.ts", ".vscode/settings.json", "config/settings.json", "credentials.schema.json", "service-account.schema.json", ".environment", "public-key.pub", ".config/gcloud/application_default_credentials.schema.json", "src/terraform.ts", "package.json"]) {
        assert.equal(versionedPolicyBlocks(filename, policy), false, filename);
    }
});
test("F02-P03 stack presets add config sensitivity without discarding accepted patterns", () => {
    assert.ok(STACK_PRESETS.length >= 8); assert.equal(new Set(STACK_PRESETS.map(row => row.id)).size, STACK_PRESETS.length);
    const base = defaultVersionedPolicy(), ci = defaultVersionedPolicy(["ci"]), combined = mergeVersionedPolicies(base, ci);
    assert.equal(versionedPolicySensitive(".vscode/settings.json", base), false);
    assert.equal(versionedPolicySensitive(".vscode/settings.json", combined), true);
    for (const pattern of base.sensitiveGlobs) assert.ok(combined.sensitiveGlobs.includes(pattern));
    assert.throws(() => defaultVersionedPolicy(["unknown-stack"]));
});
test("F02-P04 schema rejects missing future unknown non-object and weakening fields", () => {
    for (const raw of [undefined, null, [], "text", {}, { ...empty(), schemaVersion: 2 }, { ...empty(), allow: ["memo.txt"] }, { ...empty(), sensitiveGlobs: undefined }, { ...empty(), presets: ["future"] }]) assert.throws(() => parseVersionedPolicy(raw));
    assert.throws(() => parseVersionedPolicy({ ...empty(), rules: { paths: [{ kind: "file", pattern: "memo.txt", allow: true }], regions: [] } }));
    assert.throws(() => parseVersionedPolicy({ ...empty(), rules: { paths: [{ kind: "glob", pattern: "*.txt", sensitive: true }], regions: [] } }));
});
test("F02-P05 bytes counts syntax and duplicate JSON keys are bounded/rejected", () => {
    assert.throws(() => parseVersionedPolicyText(" ".repeat(MAX_POLICY_BYTES + 1) + JSON.stringify(empty())));
    assert.throws(() => parseVersionedPolicy({ ...empty(), sensitiveGlobs: Array(MAX_SENSITIVE_GLOBS + 1).fill("memo.txt") }));
    assert.throws(() => parseVersionedPolicy({ ...empty(), rules: { paths: Array(257).fill({ kind: "file", pattern: "memo.txt" }), regions: [] } }));
    for (const pattern of ["!memo.txt", "../memo.txt", "a/../memo.txt", "C:/memo.txt", "*.{json,yml}", "a\n.txt", "a//b", "[abc].txt"]) assert.throws(() => parseVersionedPolicy({ ...empty(), sensitiveGlobs: [pattern] }));
    assert.throws(() => parseVersionedPolicyText('{"schemaVersion":99,"schemaVersion":1,"presets":[],"rules":{"paths":[],"regions":[]},"sensitiveGlobs":[]}'));
    assert.throws(() => parseVersionedPolicyText('{"schemaVersion":1,"presets":[],"rules":{"paths":[],"regions":[]},"sensitiveGlobs":[],"sensitive\\u0047lobs":[]}'));
});
test("F02-P06 additive import retains strongest file sensitivity and protected regions", () => {
    const region = { path: "memo.txt", digest: documentDigest("synthetic private text"), start: 0, end: 9 };
    const before = parseVersionedPolicy({ ...empty(), rules: { paths: [{ kind: "file", pattern: "memo.txt", sensitive: true }], regions: [region] }, sensitiveGlobs: ["reports/**"] });
    const added = parseVersionedPolicy({ ...empty(), rules: { paths: [{ kind: "file", pattern: "MEMO.txt" }, { kind: "folder", pattern: "new" }], regions: [] } });
    const merged = mergeVersionedPolicies(before, added);
    assert.deepEqual(merged.rules.paths[0], { kind: "file", pattern: "memo.txt", sensitive: true });
    assert.deepEqual(merged.rules.regions, [region]); assert.ok(merged.sensitiveGlobs.includes("reports/**"));
    assert.deepEqual(mergeVersionedPolicies(merged, parseVersionedPolicy(empty())), merged);
    assert.deepEqual(mergeVersionedPolicies(merged, added), merged);
});
test("F02-P07 NFC case and separators are conservative without allowing traversal", () => {
    const policy = parseVersionedPolicy({ ...empty(), sensitiveGlobs: ["PRIVATE\\caf\u00e9.txt"], rules: { paths: [{ kind: "file", pattern: "custom/caf\u00e9.txt" }], regions: [] } });
    assert.equal(versionedPolicySensitive("private/cafe\u0301.txt", policy), true);
    assert.equal(versionedPolicyBlocks("CUSTOM\\cafe\u0301.txt", policy), true);
    assert.equal(versionedPolicyBlocks("custom/cafe.txt", policy), false);
    assert.throws(() => versionedPolicyBlocks("../custom/caf\u00e9.txt", policy));
});
test("F02-P08 portable export round-trips exact restrictions with no source-content channel", () => {
    const marker = "SYNTHETIC_PRIVATE_CONTENT_NEVER_GIVEN_TO_EXPORT";
    const policy = mergeVersionedPolicies(defaultVersionedPolicy(["python"]), parseVersionedPolicy({ ...empty(), rules: { paths: [{ kind: "file", pattern: "memo.txt", sensitive: true }], regions: [] } }));
    const text = exportVersionedPolicy(policy);
    assert.deepEqual(parseVersionedPolicyText(text), policy); assert.ok(!text.includes(marker));
    assert.equal(text.includes("workspaceRoot"), false); assert.equal(text.includes("fileContent"), false);
    const parsed = parseVersionedPolicy(policy); parsed.rules.paths[0].pattern = "changed.txt";
    assert.equal(policy.rules.paths[0].pattern, "memo.txt");
});
test("F02-P09 same-key envelope preserves metadata and causes old readers to fail closed", () => {
    const manual = { paths: [{ kind: "file", pattern: "memo.txt", sensitive: true }], regions: [] };
    const envelope = { schemaVersion: 2, manual, policy: defaultVersionedPolicy() };
    const decoded = parseStoredPolicy(envelope);
    assert.deepEqual(decoded.manual, manual); assert.ok(decoded.policy!.sensitiveGlobs.length >= 200);
    assert.throws(() => parseManualRules(envelope));
    for (const raw of [{ ...envelope, schemaVersion: 3 }, { ...envelope, policy: { schemaVersion: 99 } }, { ...envelope, manual: null }, { ...envelope, unexpected: true }]) assert.throws(() => parseStoredPolicy(raw));
    assert.deepEqual(parseStoredPolicy(manual), { manual });
});
test("F02-P10 deterministic parser fuzz keeps malformed paths/version types unavailable", () => {
    for (let i = 0; i < 100; i++) {
        assert.throws(() => parseVersionedPolicy({ ...empty(), schemaVersion: String(i) }));
        assert.throws(() => parseVersionedPolicy({ ...empty(), sensitiveGlobs: [`folder${i}/../secret.txt`] }));
    }
});
test("F02-P11 compact export near the byte ceiling stays importable", () => {
    const policy = parseVersionedPolicy({ ...empty(), sensitiveGlobs: Array.from({ length: 509 }, (_, i) => `p${i}/` + "x".repeat(248)) });
    assert.ok(Buffer.byteLength(JSON.stringify(policy, null, 2) + "\n") > MAX_POLICY_BYTES);
    const text = exportVersionedPolicy(policy);
    assert.ok(Buffer.byteLength(text, "utf8") <= MAX_POLICY_BYTES); assert.deepEqual(parseVersionedPolicyText(text), policy);
});
test("F02-P12 canonical Unicode expansion cannot accept a non-exportable stored envelope", () => {
    const raw = { schemaVersion: 2, manual: { paths: Array.from({ length: 230 }, (_, i) => ({ kind: "file", pattern: `p${i}/` + "\u0130".repeat(220) })), regions: [] }, policy: defaultVersionedPolicy() };
    assert.ok(Buffer.byteLength(JSON.stringify(raw), "utf8") < MAX_POLICY_BYTES);
    assert.throws(() => parseStoredPolicy(raw));
});
