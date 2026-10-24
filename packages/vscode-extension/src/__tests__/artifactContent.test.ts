import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeHygieneText, analyzeSourceText } from "../hygiene/HygieneAnalysis";

// F24 test-first pure controls. Every source/map/copy is synthetic in-memory
// data. No fixture process, file/reference read, build or network is required.
const PRIVATE = "TEST_ONLY_F24_CONTENT_PRIVATE_1ea9c2bd";
const PREFIXED = "sk-proj-" + "TESTONLYF24FileCanary".repeat(4);
const KEY = Buffer.alloc(32, 24);
type View = { source: string; text: string; mode: "text" | "source" };
const safeError = (error: unknown) => error instanceof Error && !String(error).includes(PRIVATE) && !String(error).includes(PREFIXED);
async function implementation() {
    const module = await import("../artifacts/ArtifactContent");
    assert.equal(typeof module.artifactViews, "function"); assert.equal(typeof module.artifactPublicationText, "function");
    return module;
}
function sourceMap(contents: readonly (string | null)[], sources = contents.map((_, index) => "src/input-" + index + ".js"), extra: object = {}) {
    return JSON.stringify({ version: 3, file: "public-bundle.js", sources, sourcesContent: contents, names: [], mappings: "", ...extra });
}
function findings(views: readonly View[]) {
    return views.flatMap(view => {
        const input = { source: view.source, text: view.text, environment: false };
        return [...(view.mode === "source" ? analyzeSourceText(input, KEY) : analyzeHygieneText(input, KEY)).findings];
    });
}
function safeFindings(value: unknown) {
    const encoded = JSON.stringify(value); assert(!encoded.includes(PRIVATE)); assert(!encoded.includes(PREFIXED));
}

test("F24 artifact limits are explicit frozen independent file, map and execution budgets", async () => {
    const { ARTIFACT_LIMITS } = await implementation();
    assert.deepEqual(ARTIFACT_LIMITS, { files: 128, fileBytes: 65536, totalBytes: 1048576, milliseconds: 60000,
        mapSources: 128, mapDepth: 64, mapWork: 16384 }); assert(Object.isFrozen(ARTIFACT_LIMITS));
});

test("F24 private text views preserve raw synthetic copy bytes while findings stay keyed", async () => {
    const { artifactViews } = await implementation(), text = "TOKEN=" + PRIVATE + "\r\nPORT=3000\r\n";
    const result = artifactViews("dist/config-copy.txt", text); assert.equal(result.kind, "text"); assert.equal(result.views.length, 1);
    assert.equal(result.views[0].mode, "text"); assert.equal(result.views[0].text, text);
    const detected = findings(result.views); assert.equal(detected.length, 1); safeFindings(detected);
});

test("F24 JS JSX TS TSX MJS and CJS artifacts select canonical parse-only source analysis", async () => {
    const { artifactViews } = await implementation();
    for (const extension of ["js", "jsx", "ts", "tsx", "mjs", "cjs"]) {
        const text = 'const TOKEN="' + PRIVATE + '";\n', result = artifactViews("build/output." + extension, text);
        assert.equal(result.kind, "text"); assert.equal(result.views.length, 1); assert.equal(result.views[0].mode, "source");
        assert.equal(result.views[0].text, text); const detected = findings(result.views); assert.equal(detected.length, 1); safeFindings(detected);
    }
});

test("F24 renamed leading-source copies retain canonical source semantics without trusting their extension", async () => {
    const { artifactViews, artifactPublicationText } = await implementation(), text = 'const TOKEN="' + PRIVATE + '";const PORT=3000;';
    for (const relative of [".cache/output.copy", "caches/renamed.bak", "coverage/retained.txt"]) {
        const result = artifactViews(relative, text); assert.equal(result.kind, "text"); assert.equal(result.views.length, 1); assert.equal(result.views[0].mode, "source");
        assert.equal(findings(result.views).length, 1); const published = artifactPublicationText(relative, text); assert(!published.includes(PRIVATE)); assert(published.includes("PORT=3000"));
    }
});

test("F24 minified recognized literals and static credential comments remain detectable", async () => {
    const { artifactViews, artifactPublicationText } = await implementation();
    const text = '(()=>{const a="' + PREFIXED + '";return 3000})();\n// API_KEY=' + PRIVATE + '-comment\n';
    const result = artifactViews("dist/bundle.min.js", text), detected = findings(result.views); assert.equal(detected.length, 2); safeFindings(detected);
    const published = artifactPublicationText("dist/bundle.min.js", text); assert(!published.includes(PRIVATE)); assert(!published.includes(PREFIXED)); assert(published.includes("return 3000"));
});

test("F24 decoded JS escapes are analyzed canonically and exact encoded source values are excluded from publication", async () => {
    const { artifactViews, artifactPublicationText } = await implementation();
    const escaped = [...PRIVATE].map(character => "\\u" + character.charCodeAt(0).toString(16).padStart(4, "0")).join("");
    const text = 'const PASSWORD="' + escaped + '";const PORT=3000;';
    assert(!text.includes(PRIVATE)); const detected = findings(artifactViews("dist/escaped.js", text).views); assert.equal(detected.length, 1); safeFindings(detected);
    const published = artifactPublicationText("dist/escaped.js", text); assert(!published.includes(escaped)); assert(!published.includes(PRIVATE)); assert(published.includes("PORT=3000"));
});

test("F24 public source CSS and ordinary copy controls remain byte-for-byte useful", async () => {
    const { artifactViews, artifactPublicationText } = await implementation();
    for (const [relative, text] of [["dist/public.js", 'export const PORT=3000;\nconst MODE="public";\n'],
        ["build/public.css", ".public { color: blue; margin: 0; }\n"], [".cache/public.copy", "PORT=3000\nMODE=public\n"]]) {
        assert.equal(findings(artifactViews(relative, text).views).length, 0); assert.equal(artifactPublicationText(relative, text), text);
    }
});

test("F24 raw credential copies are sanitized deterministically and repeated sanitization is idempotent", async () => {
    const { artifactPublicationText } = await implementation(), text = "API_KEY=" + PRIVATE + "\nPORT=3000\n";
    const first = artifactPublicationText("dist/retained.txt", text); assert(!first.includes(PRIVATE)); assert(first.includes("PORT=3000"));
    assert.equal(artifactPublicationText("dist/retained.txt", text), first); assert.equal(artifactPublicationText("dist/retained.txt", first), first);
});

test("F24 source publication uses stable placeholders across repeated capture and never adds execution or imports", async () => {
    const { artifactPublicationText } = await implementation(), text = 'const PASSWORD="' + PRIVATE + '";\nexport const PORT=3000;\n';
    const first = artifactPublicationText("build/app.js", text); assert(!first.includes(PRIVATE)); assert(first.includes("export const PORT=3000"));
    assert.equal(artifactPublicationText("build/app.js", text), first); assert.equal(artifactPublicationText("build/app.js", first), first);
    assert(!first.includes("process.env")); assert(!first.includes("require(")); assert(!first.includes("import "));
});

test("F24 private v3 map sourcesContent is decoded once with null entries skipped", async () => {
    const { artifactViews } = await implementation(), source = 'const TOKEN="' + PRIVATE + '";\r\n';
    const text = sourceMap([source, null, 'export const PORT=3000;\n']), result = artifactViews("dist/bundle.js.map", text);
    assert.equal(result.kind, "source-map"); assert.equal(result.views.length, 2); assert.equal(result.views[0].text, source);
    assert.equal(result.views[1].text, 'export const PORT=3000;\n'); assert(result.views.every(view => view.mode === "source"));
    const detected = findings(result.views); assert.equal(detected.length, 1); safeFindings(detected);
});

test("F24 renamed strict source-map copies are recognized independently of the map suffix", async () => {
    const { artifactViews, artifactPublicationText } = await implementation(), text = sourceMap(['const TOKEN="' + PRIVATE + '";']);
    for (const relative of [".cache/map-copy.json", "caches/renamed.snapshot", "build/bundle.MAP"]) {
        const result = artifactViews(relative, text); assert.equal(result.kind, "source-map"); assert.equal(findings(result.views).length, 1);
        assert.throws(() => artifactPublicationText(relative, text), safeError);
    }
});

test("F24 map JSON escaping and embedded source escaping preserve canonical decoded credentials", async () => {
    const { artifactViews } = await implementation(), source = 'const PASSWORD="prefix\\n' + PRIVATE + '\\u0021";\n';
    const result = artifactViews("build/escaped.map", sourceMap([source])); assert.equal(result.views[0].text, source);
    const detected = findings(result.views); assert.equal(detected.length, 1); safeFindings(detected);
});

test("F24 sourceRoot sources file and URLs are inert metadata and do not become original-path analysis identities", async t => {
    const { artifactViews } = await implementation(); let requests = 0;
    t.mock.method(globalThis, "fetch", async () => { requests++; throw Error("Synthetic reference must not be followed."); });
    const sources = ["../../synthetic-outside/private-source.js", "https://example.invalid/never-read.js", "file:///C:/TEST_ONLY_NO_READ/source.js"];
    const contents = sources.map(() => "export const PORT=3000;\n");
    const result = artifactViews("dist/public.map", sourceMap(contents, sources, { sourceRoot: "https://example.invalid/private-root/", file: "C:/TEST_ONLY_NO_READ/original.js" }));
    assert.equal(result.views.length, 3); assert.equal(requests, 0);
    for (const view of result.views) { assert(!view.source.includes(":")); assert(!view.source.startsWith("/")); assert(!view.source.includes("\\")); assert(!view.source.split("/").some(part => part === "..")); }
    assert.equal(findings(result.views).length, 0);
});

test("F24 every source map is withheld from publication even with harmless or empty embedded sources", async () => {
    const { artifactPublicationText } = await implementation();
    for (const text of [sourceMap([]), sourceMap([null]), sourceMap(["export const PORT=3000;\n"]), sourceMap(['const TOKEN="' + PRIVATE + '";'])])
        assert.throws(() => artifactPublicationText("dist/output.js.map", text), safeError);
});

test("F24 sourceMappingURL-bearing JS CSS and copied text are withheld for explicit reviewed exclusion", async () => {
    const { artifactPublicationText } = await implementation();
    const bodies = [["dist/public.js", "export const PORT=3000;\n//# sourceMappingURL=public.js.map\n"],
        ["build/public.css", "body{color:blue}\n/*# sourceMappingURL=https://example.invalid/never-fetch.map */"],
        [".cache/retained.txt", "public text\n//@ sourceMappingURL=file:///C:/TEST_ONLY_NO_READ/private.map\n"],
        ["dist/inline.js", "export const PORT=3000;\n//# sourceMappingURL=data:application/json;base64," + Buffer.from(sourceMap([])).toString("base64")]];
    for (const [relative, text] of bodies) assert.throws(() => artifactPublicationText(relative, text), safeError);
});

test("F24 inline data-map references remain unsupported instead of being decoded or treated as inspected originals", async () => {
    const { artifactViews } = await implementation(), inline = "data:application/json;base64," + Buffer.from(sourceMap(['const TOKEN="' + PRIVATE + '";'])).toString("base64");
    assert.throws(() => artifactViews("dist/inline.map", inline), safeError);
    assert.throws(() => artifactViews("dist/inline-map.json", JSON.stringify({ version: 3, sections: [{ offset: { line: 0, column: 0 }, url: inline }] })), safeError);
});

test("F24 malformed truncated commented or trailing-comma maps fail with generic value-free errors", async () => {
    const { artifactViews, artifactPublicationText } = await implementation(), complete = sourceMap(['const TOKEN="' + PRIVATE + '";']);
    for (const text of [complete.slice(0, -1), complete + " trailing", "/*" + PRIVATE + "*/" + complete, complete.slice(0, -1) + ",}", "[]", "null", PRIVATE]) {
        assert.throws(() => artifactViews("dist/bad.map", text), safeError); assert.throws(() => artifactPublicationText("dist/bad.map", text), safeError);
    }
});

test("F24 duplicate decoded map keys cannot conceal a competing sourcesContent or version", async () => {
    const { artifactViews } = await implementation(), content = JSON.stringify(['const TOKEN="' + PRIVATE + '";']);
    for (const text of ['{"version":3,"version":3,"sources":["a.js"],"sourcesContent":' + content + ',"names":[],"mappings":""}',
        '{"version":3,"sources":["a.js"],"sourcesContent":[],"sources\\u0043ontent":' + content + ',"names":[],"mappings":""}'])
        assert.throws(() => artifactViews("build/duplicate.map", text), safeError);
});

test("F24 finite map schema refuses version shape mismatches mismatched arrays and unknown root fields", async () => {
    const { artifactViews } = await implementation(), base = { version: 3, sources: ["public.js"], sourcesContent: ["export const PORT=3000;"], names: [], mappings: "" };
    for (const value of [{ ...base, version: "3" }, { ...base, version: 2 }, { ...base, version: 3.1 }, { ...base, sources: "public.js" },
        { ...base, sources: [1] }, { ...base, sourcesContent: "public source" }, { ...base, sourcesContent: [false] },
        { ...base, sourcesContent: [] }, { ...base, sourcesContent: ["public", "extra"] }, { ...base, names: [false] },
        { ...base, mappings: [] }, { ...base, unknownSchema: PRIVATE }])
        assert.throws(() => artifactViews("dist/schema.map", JSON.stringify(value)), safeError);
});

test("F24 indexed inline sections and external section URLs are explicitly unsupported", async () => {
    const { artifactViews } = await implementation(), embedded = JSON.parse(sourceMap(["export const PORT=3000;"]));
    for (const section of [{ offset: { line: 0, column: 0 }, map: embedded },
        { offset: { line: 0, column: 0 }, url: "https://example.invalid/" + PRIVATE + ".map" },
        { offset: { line: 0, column: 0 }, url: "file:///C:/TEST_ONLY_NO_READ/never.map" }])
        assert.throws(() => artifactViews("build/indexed.map", JSON.stringify({ version: 3, sections: [section] })), safeError);
});

test("F24 maps enforce128 embedded source slots and refuse a129th before unbounded analysis", async () => {
    const { artifactViews } = await implementation(), exact = Array.from({ length: 128 }, (_, index) => "export const PORT=" + index + ";");
    assert.equal(artifactViews("build/exact.map", sourceMap(exact)).views.length, 128);
    assert.throws(() => artifactViews("build/over.map", sourceMap([...exact, "export const PORT=129;"])), safeError);
});

test("F24 deep or excessive map work fails generically without stack-dependent output", async () => {
    const { artifactViews } = await implementation();
    let nested: unknown = "public"; for (let index = 0; index < 66; index++) nested = [nested];
    const deep = JSON.stringify({ version: 3, sources: [], sourcesContent: [], names: [], mappings: "", nested });
    assert.throws(() => artifactViews("dist/deep.map", deep), safeError);
    const work = sourceMap([], [], { names: Array.from({ length: 16385 }, () => "") }); assert(Buffer.byteLength(work) <= 65536);
    assert.throws(() => artifactViews("dist/work.map", work), safeError);
});

test("F24 raw and decoded map source controls reject NUL ESC unsupportedC0 and lone surrogates", async () => {
    const { artifactViews, artifactPublicationText } = await implementation();
    for (const bad of ["\0", "\x01", "\x1b", "\x7f", "\ud800"]) {
        assert.throws(() => artifactViews(".cache/binary.copy", PRIVATE + bad), safeError);
        assert.throws(() => artifactPublicationText(".cache/binary.copy", PRIVATE + bad), safeError);
        assert.throws(() => artifactViews("dist/control.map", sourceMap(['const TOKEN="' + PRIVATE + '";\n' + bad])), safeError);
    }
});

test("F24 single-file64KiB bound measures UTF8 bytes and applies before source-map expansion", async () => {
    const { artifactViews, artifactPublicationText } = await implementation(), exact = "a".repeat(65536);
    assert.equal(artifactViews("dist/public.txt", exact).views[0].text, exact); assert.equal(artifactPublicationText("dist/public.txt", exact), exact);
    for (const text of ["a".repeat(65537), "é".repeat(32769), sourceMap(["a".repeat(65537)])]) {
        assert.throws(() => artifactViews("dist/large.copy", text), safeError); assert.throws(() => artifactPublicationText("dist/large.copy", text), safeError);
    }
});

test("F24 relative paths reject traversal Windows streams devices ambiguous names and controls", async () => {
    const { artifactViews, artifactPublicationText } = await implementation();
    for (const relative of ["", "/dist/public.js", "C:/dist/public.js", "../public.js", "dist/../public.js", "./public.js", "dist//public.js",
        "dist\\public.js", "dist/public.js:stream", "dist/NUL.txt", "dist/CON.js", "dist/public.js.", "dist/public.js ", "dist/" + PRIVATE + "\n.js"]) {
        assert.throws(() => artifactViews(relative, "public text"), safeError); assert.throws(() => artifactPublicationText(relative, "public text"), safeError);
    }
});

test("F24 recognized filename canaries are withheld before publication metadata can expose original names", async () => {
    const { artifactPublicationText } = await implementation();
    assert.throws(() => artifactPublicationText("dist/" + PREFIXED + ".js", "export const PORT=3000;"), safeError);
    assert.throws(() => artifactPublicationText("dist/public.map", sourceMap(["public"], ["src/" + PREFIXED + ".js"])), safeError);
});

test("F24 unsupported dynamic or malformed source is never released through a generic-text fallback", async () => {
    const { artifactPublicationText } = await implementation();
    for (const text of ['const TOKEN="' + PRIVATE + '"+suffix;', 'const PASSWORD=getCredential("' + PRIVATE + '");',
        'const TOKEN=tag`' + PRIVATE + '`;', 'const TOKEN=`' + PRIVATE + '${suffix}`;', 'const TOKEN="' + PRIVATE + ';'])
        assert.throws(() => artifactPublicationText("dist/bad.js", text), safeError);
});

test("F24 artifact parsing and publication never evaluate generated JavaScript", async () => {
    const { artifactViews, artifactPublicationText } = await implementation();
    const marker = globalThis as typeof globalThis & { __SOTERAI_F24_SYNTHETIC_EXECUTION__?: boolean };
    assert.equal(marker.__SOTERAI_F24_SYNTHETIC_EXECUTION__, undefined);
    const text = 'globalThis.__SOTERAI_F24_SYNTHETIC_EXECUTION__=true;const TOKEN="' + PRIVATE + '";';
    assert.equal(findings(artifactViews("build/not-executed.js", text).views).length, 1);
    assert(!artifactPublicationText("build/not-executed.js", text).includes(PRIVATE));
    assert.equal(marker.__SOTERAI_F24_SYNTHETIC_EXECUTION__, undefined);
});

test("F24 recognized credentials in ignored source metadata literals withhold publication", async () => {
    const { artifactPublicationText } = await implementation();
    const escaped = [...PREFIXED].map(c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")).join("");
    for (const text of [`import item from "${PREFIXED}";export const PORT=3000;`,
        `import item from "${escaped}";export const PORT=3000;`,
        `type Client = "${escaped}";export const PORT=3000;`,
        `export const publicObject={"${escaped}":"public"};`]) {
        assert.throws(() => artifactPublicationText("dist/metadata.ts", text), safeError);
    }
});

test("F24 forged placeholder text cannot conceal a recognized credential in source metadata", async () => {
    const { artifactPublicationText } = await implementation();
    assert.throws(() => artifactPublicationText("dist/metadata.js",
        `import item from "${PREFIXED}[SOTERAI_PROTECTED_FORGED]";export const PORT=3000;`), safeError);
});

test("F24 inline mapping payload in generated source stays visibly unsupported during analysis", async () => {
    const { artifactViews } = await implementation();
    const inline = Buffer.from(sourceMap([`const PASSWORD="${PRIVATE}";`])).toString("base64");
    assert.throws(() => artifactViews("dist/inline.js", "export const PORT=3000;\n//# sourceMappingURL=data:application/json;base64," + inline), safeError);
});

test("F24 forged placeholder names cannot hide recognized filename or source-map metadata credentials", async () => {
    const { artifactPublicationText, artifactViews } = await implementation();
    const concealed = PREFIXED + "[SOTERAI_PROTECTED_FORGED]";
    assert.throws(() => artifactPublicationText("dist/" + concealed + ".js", "export const PORT=3000;"), safeError);
    assert.throws(() => artifactViews("dist/metadata.map", sourceMap(["export const PORT=3000;"], [concealed + ".js"])), safeError);
});
