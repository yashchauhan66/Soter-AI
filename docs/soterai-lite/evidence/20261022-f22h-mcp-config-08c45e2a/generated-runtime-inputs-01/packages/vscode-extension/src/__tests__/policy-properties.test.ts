import assert from "node:assert/strict";
import test from "node:test";
import {
    documentDigest, matchesGlob, matchesRule, MAX_RULES, mergeManualRules, OMITTED,
    parseAiIgnore, parseManualRules, redactRegions, relativePath, validateGlob,
    type ManualRules, type PathRule,
} from "../ai-boundary/policy";
import { DEFAULT_PROJECT_POLICY, parseProjectPolicy } from "../../../guard-core/src/ProjectPolicy";

// These fixed-seed properties exercise exported product parsers. They do not
// certify filesystem custody, signed policy, independent consent or OS isolation.
const SEED = 0x534f5445;
function generator(seed = SEED) {
    let value = seed >>> 0;
    return (maximum: number): number => {
        value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
        return value % maximum;
    };
}
function segment(next: (maximum: number) => number): string {
    const alphabet = "abcXYZ019_-";
    return Array.from({ length: 1 + next(12) }, () => alphabet[next(alphabet.length)]).join("");
}
function pathParts(next: (maximum: number) => number): string[] {
    return Array.from({ length: 1 + next(5) }, () => segment(next));
}
function identities(rules: ManualRules): Set<string> {
    return new Set([...rules.paths, ...rules.regions].map(rule => JSON.stringify(rule)));
}

test("A05/A13 property: valid relative paths normalize idempotently and preserve segment identity", () => {
    const next = generator();
    for (let index = 0; index < 512; index++) {
        const parts = pathParts(next);
        const canonical = parts.join("/").toLowerCase();
        for (const input of [parts.join("/"), parts.join("\\"), "./" + parts.join("/")]) {
            const normalized = relativePath(input);
            assert.equal(normalized, canonical, `seed=${SEED} case=${index}`);
            assert.equal(relativePath(normalized), normalized);
            assert.equal(normalized.split("/").length, parts.length);
        }
    }
    assert.equal(relativePath("public notes/Report.txt"), "public notes/report.txt");
    assert.equal(relativePath("a".repeat(4096)).length, 4096);
    assert.throws(() => relativePath("a".repeat(4097)));
});

test("A01/A05 property: traversal, absolute paths, control characters and empty segments fail with valid controls", () => {
    const next = generator(SEED + 1);
    for (let index = 0; index < 128; index++) {
        const ordinary = pathParts(next).join("/");
        assert.doesNotThrow(() => relativePath(ordinary));
        for (const invalid of ["../" + ordinary, ordinary + "/..", ordinary + "/./file",
            "/" + ordinary, "C:/" + ordinary, "//server/" + ordinary, ordinary + "/",
            ordinary + "//file", ordinary + "\0", ordinary + "\n", "x:" + ordinary]) {
            assert.throws(() => relativePath(invalid), `seed=${SEED + 1} case=${index}`);
        }
    }
});

test("A05 property: deny globs retain literal identity, root anchoring and folder descendant semantics", () => {
    const next = generator(SEED + 2);
    for (let index = 0; index < 128; index++) {
        const basename = "literal+(" + segment(next) + ").txt";
        assert.equal(validateGlob(basename), basename);
        assert.equal(matchesGlob("public/" + basename, basename), true);
        assert.equal(matchesGlob("public/" + basename, "/" + basename), false);
        assert.equal(matchesGlob(basename, "/" + basename), true);
        assert.equal(matchesGlob("public/" + basename.replace("+(", "("), basename), false);
        const folder = "private-" + segment(next);
        const rule: PathRule = { kind: "folder", pattern: folder };
        assert.equal(matchesRule(folder + "/nested/public.txt", rule), true);
        assert.equal(matchesRule(folder + "-other/public.txt", rule), false);
        assert.equal(matchesGlob("root/public.txt", "root/*.txt"), true);
        assert.equal(matchesGlob("root/nested/public.txt", "root/*.txt"), false);
        assert.equal(matchesGlob("root/nested/public.txt", "root/**/*.txt"), true);
    }
});

test("A13 property: invalid deny syntax and parser limits cannot become an empty accepted policy", () => {
    const next = generator(SEED + 3);
    for (let index = 0; index < 128; index++) {
        const ordinary = "private/" + segment(next) + ".txt";
        assert.deepEqual(parseAiIgnore("\uFEFF# public comment\r\n\r\n" + ordinary + "\r\n"), [ordinary]);
        for (const invalid of ["!" + ordinary, "../" + ordinary, "a//" + ordinary,
            "C:/" + ordinary, "a/[ab]", "a/{b,c}", ordinary + "\0"]) {
            assert.throws(() => parseAiIgnore(invalid), `seed=${SEED + 3} case=${index}`);
        }
    }
    assert.equal(parseAiIgnore(Array(MAX_RULES).fill("public.txt").join("\n")).length, MAX_RULES);
    assert.throws(() => parseAiIgnore(Array(MAX_RULES + 1).fill("public.txt").join("\n")));
    assert.throws(() => parseAiIgnore("#" + "a".repeat(64 * 1024)));
    assert.equal(validateGlob("a".repeat(256)).length, 256);
    assert.throws(() => validateGlob("a".repeat(257)));
});

test("A05/A13 property: accepted rule union is monotone, idempotent and isolated from caller mutation", () => {
    const next = generator(SEED + 4);
    for (let index = 0; index < 128; index++) {
        const before: ManualRules = { paths: [], regions: [] };
        const added: ManualRules = { paths: [], regions: [] };
        const priorCount = 1 + next(12);
        const addedCount = 1 + next(12);
        for (let rule = 0; rule < priorCount; rule++) {
            before.paths.push({ kind: "folder", pattern: `prior-${index}-${rule}/${segment(next)}` });
        }
        for (let rule = 0; rule < addedCount; rule++) {
            added.paths.push({ kind: "file", pattern: `new-${index}-${rule}.txt` });
        }
        before.regions.push({ path: "notes.txt", digest: documentDigest("synthetic protected text"), start: 0, end: 9 });
        const beforeCopy = structuredClone(before);
        const merged = mergeManualRules(before, added);
        const mergedIds = identities(merged);
        for (const identity of [...identities(before), ...identities(added)]) assert.ok(mergedIds.has(identity));
        for (const rule of before.paths) assert.equal(merged.paths.some(candidate => matchesRule(rule.pattern + "/public.txt", candidate)), true);
        assert.deepEqual(mergeManualRules(merged, merged), merged);
        assert.deepEqual([...identities(mergeManualRules(added, before))].sort(), [...mergedIds].sort());
        merged.paths[0].pattern = "mutated-public.txt";
        merged.regions[0].start = 3;
        assert.deepEqual(before, beforeCopy);
    }
    const maximum: ManualRules = { paths: Array.from({ length: MAX_RULES }, (_, index) => ({ kind: "file", pattern: `private-${index}.txt` })), regions: [] };
    assert.deepEqual(mergeManualRules(maximum, maximum), maximum);
    assert.throws(() => mergeManualRules(maximum, { paths: [{ kind: "file", pattern: "another-private.txt" }], regions: [] }));
});

test("A05/A13 property: malformed stored rule and region families fail while a valid region remains accepted", () => {
    const next = generator(SEED + 5);
    for (let index = 0; index < 64; index++) {
        const valid: ManualRules = { paths: [{ kind: "file", pattern: segment(next) + ".txt" }],
            regions: [{ path: "notes.txt", digest: documentDigest("synthetic text " + index), start: 1, end: 4 }] };
        assert.deepEqual(parseManualRules(valid), valid);
        for (const mutate of [
            (rules: ManualRules) => { rules.paths[0].pattern = "../private.txt"; },
            (rules: ManualRules) => { (rules.paths[0] as { kind: string }).kind = "allow"; },
            (rules: ManualRules) => { rules.regions[0].digest = "g".repeat(64); },
            (rules: ManualRules) => { rules.regions[0].start = -1; },
            (rules: ManualRules) => { rules.regions[0].start = 0.5; },
            (rules: ManualRules) => { rules.regions[0].end = rules.regions[0].start; },
            (rules: ManualRules) => { rules.regions[0].end = Infinity; },
            (rules: ManualRules) => { rules.regions[0].path = "C:/private.txt"; },
        ]) {
            const changed = structuredClone(valid); mutate(changed);
            assert.throws(() => parseManualRules(changed), `seed=${SEED + 5} case=${index}`);
        }
    }
    for (const malformed of [null, false, [], {}, { paths: null, regions: [] }, { paths: [], regions: {} }]) {
        assert.throws(() => parseManualRules(malformed));
    }
    assert.deepEqual(parseManualRules(undefined), { paths: [], regions: [] });
});

test("A05/A22 property: exact-region masking preserves public controls and any revision change withholds the file", () => {
    const next = generator(SEED + 6);
    for (let index = 0; index < 128; index++) {
        const prefix = "public-prefix-" + segment(next) + ":";
        const secret = "SYNTHETIC-PROTECTED-" + index + "-" + segment(next);
        const suffix = ":public-suffix-" + segment(next);
        const text = prefix + secret + suffix;
        const regions = [{ path: "notes.txt", digest: documentDigest(text), start: prefix.length, end: prefix.length + secret.length }];
        assert.equal(redactRegions("notes.txt", text, regions), prefix + OMITTED + suffix);
        assert.equal(redactRegions("notes.txt", text, regions, 0, prefix.length), prefix);
        assert.equal(redactRegions("notes.txt", text, regions, prefix.length, prefix.length + secret.length), OMITTED);
        assert.equal(redactRegions("notes.txt", text, regions, prefix.length + secret.length, text.length), suffix);
        assert.equal(redactRegions("public.txt", text, regions), text);
        assert.equal(redactRegions("notes.txt", "edited " + text, regions), OMITTED);
        assert.equal(redactRegions("notes.txt", text, regions, -1, text.length), OMITTED);
        assert.ok(!JSON.stringify(regions).includes(secret));
    }
});

test("A13 property: project-policy defaults reject malformed enums, bound durations and require explicit raw-content opt-in", () => {
    const next = generator(SEED + 7);
    const invalid: unknown[] = [undefined, null, false, 0, "invalid", [], {}, NaN, Infinity];
    const defaultsBefore = structuredClone(DEFAULT_PROJECT_POLICY);
    for (let index = 0; index < 256; index++) {
        const value = invalid[next(invalid.length)];
        const parsed = parseProjectPolicy({ mode: value, protectedFiles: value, sensitivePaths: value,
            aiContext: { defaultAction: value, protectedFileAction: value, sensitivePathAction: value, allowSessionMinutes: value },
            cloud: { enabled: value, sendRawContent: value } });
        assert.equal(parsed.mode, DEFAULT_PROJECT_POLICY.mode);
        assert.deepEqual(parsed.protectedFiles, DEFAULT_PROJECT_POLICY.protectedFiles);
        assert.deepEqual(parsed.sensitivePaths, DEFAULT_PROJECT_POLICY.sensitivePaths);
        assert.deepEqual(parsed.aiContext, DEFAULT_PROJECT_POLICY.aiContext);
        assert.deepEqual(parsed.cloud, { enabled: false, sendRawContent: false });
        parsed.protectedFiles.push("private-added.txt");
        parsed.sensitivePaths.push("sensitive-added.txt");
    }
    assert.deepEqual(DEFAULT_PROJECT_POLICY, defaultsBefore);
    const protectedFiles = ["private/**"];
    const control = parseProjectPolicy({ version: 1, mode: "strict", protectedFiles,
        aiContext: { defaultAction: "block", allowSessionMinutes: 10 }, cloud: { enabled: true, sendRawContent: true } });
    assert.equal(control.mode, "strict");
    assert.equal(control.aiContext.defaultAction, "block");
    assert.equal(control.aiContext.allowSessionMinutes, 10);
    assert.deepEqual(control.cloud, { enabled: true, sendRawContent: true });
    control.protectedFiles.push("another-private.txt");
    assert.deepEqual(protectedFiles, ["private/**"]);
});
