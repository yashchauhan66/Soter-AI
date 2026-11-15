import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDebugContext, buildEnvironmentContract, CONTEXT_LIMIT, reviewContext } from "../secret-broker/ReviewedContext";
import { OutputFilter } from "../secret-broker/OutputFilter";

const output = new OutputFilter();
const filter = (text: string) => output.filter(text);
test("environment contract depends on names only, never original values or comments", () => {
    const one = buildEnvironmentContract("DB_PASSWORD=BlueMango7!\nAPI_URL=https://private.internal/path\nPORT=9317\nDEBUG=true\n# private comment", filter);
    const two = buildEnvironmentContract("DEBUG=false\nPORT=1234\nAPI_URL=https://different.internal\nDB_PASSWORD=OtherPrivateValue987!", filter);
    assert.equal(one.status, "PREPARED"); assert.deepEqual(one, two);
    const serialized = JSON.stringify(one);
    for (const raw of ["BlueMango7!", "private.internal", "9317", "private comment", "OtherPrivateValue987!"]) assert.ok(!serialized.includes(raw));
    assert.match(serialized, /DB_PASSWORD/); assert.match(serialized, /https:\/\/example.invalid/);
});
test("ambiguous, multiline, invalid and oversized environment inputs are withheld", () => {
    for (const input of ["TOKEN=a\nTOKEN=b", "A=\"unterminated", "A='line\nbreak'", "A=public\nmalformed", "A=public\u202esecret", "A=" + "é".repeat(CONTEXT_LIMIT), Array.from({ length: 129 }, (_, i) => `FIELD_${i}=public`).join("\n"), "A=public\\"]) {
        assert.equal(buildEnvironmentContract(input, filter).status, "WITHHELD");
    }
});
test("failed matching and a known value inside a variable name cannot escape the contract filter", () => {
    assert.equal(buildEnvironmentContract("PUBLIC_NAME=value", () => ({ allowed: false, text: "private" })).status, "WITHHELD");
    const value = "sensitive_name_value_123456";
    const result = buildEnvironmentContract(value + "=public", text => output.filter(text, [value]));
    assert.ok(!JSON.stringify(result).includes(value));
});
test("debug context removes recognized assignments while retaining useful error details", () => {
    const result = buildDebugContext("Error: connection failed HTTP 503\nDB_PASSWORD=BlueMango7!\n    at connect (app.js:12:4)\nnode v22.16.0", filter);
    assert.equal(result.status, "PREPARED");
    if (result.status !== "PREPARED") return;
    assert.ok(!result.text.includes("BlueMango7!"));
    for (const useful of ["HTTP 503", "app.js:12:4", "v22.16.0", "untrusted diagnostic data"]) assert.ok(result.text.includes(useful));
});
test("debug preparation withholds unsupported size/control input and unavailable filters", () => {
    for (const input of ["", "public\x1b[31m", "é".repeat(CONTEXT_LIMIT)]) assert.equal(buildDebugContext(input, filter).status, "WITHHELD");
    assert.equal(buildDebugContext("Public error", () => { throw Error("PRIVATE_EXCEPTION"); }).status, "WITHHELD");
    assert.equal(buildDebugContext("Public error", () => ({ allowed: true, text: "x".repeat(CONTEXT_LIMIT + 1) })).status, "WITHHELD");
    assert.ok(!JSON.stringify(buildDebugContext("Public error", () => { throw Error("PRIVATE_EXCEPTION"); })).includes("PRIVATE_EXCEPTION"));
});
test("preview precedes deliberate clipboard copy; keeping or cancelling never copies", async () => {
    for (const action of ["copy", "keep", undefined] as const) {
        const calls: string[] = [];
        const result = await reviewContext("public reviewed content", { current: () => true,
            preview: async text => { calls.push("preview:" + text); return { current: () => true }; },
            choose: async () => { calls.push("choose"); return action; }, copy: async text => { calls.push("copy:" + text); } });
        assert.equal(result.status, action === "copy" ? "COPIED" : action === "keep" ? "PREVIEWED" : "CANCELLED");
        assert.deepEqual(calls, ["preview:public reviewed content", "choose", ...(action === "copy" ? ["copy:public reviewed content"] : [])]);
    }
});
test("source/configuration changes and preview edits invalidate late copy decisions", async () => {
    for (const target of ["source", "preview"]) {
        let sourceCurrent = true, previewCurrent = true, copies = 0;
        const result = await reviewContext("public", { current: () => sourceCurrent, preview: async () => ({ current: () => previewCurrent }),
            choose: async () => { if (target === "source") sourceCurrent = false; else previewCurrent = false; return "copy"; }, copy: async () => { copies++; } });
        assert.equal(result.status, "UNAVAILABLE"); assert.equal(copies, 0);
    }
});
test("preview failure, stale initial source and invalid copy decisions cannot disclose text", async () => {
    let copies = 0;
    const deps = { current: () => false, preview: async () => { throw Error("PRIVATE_SOURCE"); }, choose: async () => "copy" as const, copy: async () => { copies++; } };
    assert.equal((await reviewContext("public", deps)).status, "UNAVAILABLE");
    assert.equal((await reviewContext("public", { ...deps, current: () => true })).status, "UNAVAILABLE");
    assert.equal(copies, 0);
});
