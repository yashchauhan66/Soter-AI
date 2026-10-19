import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateClineHook } from "../adapters/ClineHookProtocol";

const frame = (parameters: Record<string, unknown>) => ({ preToolUse: { toolName: "editor", parameters } });
test("F18 bounded native editor permits only a current public write classification", async () => {
    const calls: unknown[] = [];
    for (const args of [{ path: "public.txt", old_text: "old public", new_text: "new public" }, { path: "new.txt", new_text: "public new file" }, { path: "public.txt", insert_line: "1", new_text: "public insertion" }]) {
        assert.deepEqual(await evaluateClineHook(frame(args), async (file, intent) => { calls.push([file, intent]); return "PUBLIC"; }), { cancel: false });
    }
    assert.deepEqual(calls, [["public.txt", "write"], ["new.txt", "write"], ["public.txt", "write"]]);
});
test("F18 editor protected targets and unavailable classifiers remain withheld", async () => {
    for (const verdict of ["RESTRICTED", "UNAVAILABLE"] as const) assert.equal((await evaluateClineHook(frame({ path: ".env", new_text: "public" }), async () => verdict)).cancel, true);
});
test("F18 editor unknown authority, traversal, ambiguous and oversized inputs obtain no classification", async () => {
    let calls = 0;
    for (const args of [
        { path: "../outside.txt", new_text: "public" }, { path: "public.txt", new_text: "public", approved: true },
        { path: "public.txt", new_text: "x".repeat(2049) }, { path: "public.txt", new_text: "public", old_text: "old", insert_line: "1" },
        { path: "public.txt", new_text: "public", insert_line: "-1" }, { path: "public.txt", new_text: { raw: "public" } },
    ]) assert.equal((await evaluateClineHook(frame(args), async () => { calls++; return "PUBLIC"; })).cancel, true);
    assert.equal(calls, 0);
});
