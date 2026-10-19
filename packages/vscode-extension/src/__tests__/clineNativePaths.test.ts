import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateClineHook } from "../adapters/ClineHookProtocol";
const ROOT = "D:/fixture/project";
const frame = (toolName: string, parameters: Record<string, unknown>) => ({ preToolUse: { toolName, parameters } });
const evaluate = (input: unknown, classify: (file: string, intent: string) => Promise<"PUBLIC" | "RESTRICTED" | "UNAVAILABLE">) => (evaluateClineHook as Function)(input, classify, undefined, ROOT);
test("F18 observed read_files.files schema normalizes owned absolute paths and nullable line bounds", async () => {
    const seen: unknown[] = [];
    const result = await evaluate(frame("read_files", { files: JSON.stringify([{ path: "D:\\fixture\\project\\public.txt", start_line: 1, end_line: null }, { path: "D:/fixture/project/docs/public.md" }]) }), async (file, intent) => { seen.push([file, intent]); return "PUBLIC"; });
    assert.deepEqual(result, { cancel: false }); assert.deepEqual(seen, [["public.txt", "read"], ["docs/public.md", "read"]]);
});
test("F18 published multi-file read with a protected target never permits the batch", async () => {
    const seen: string[] = [];
    assert.equal((await evaluate(frame("read_files", { files: '[{"path":"public.txt"},{"path":".env"}]' }), async file => { seen.push(file); return file === ".env" ? "RESTRICTED" : "PUBLIC"; })).cancel, true);
    assert.deepEqual(seen, ["public.txt", ".env"]);
});
test("F18 native absolute escapes, device/UNC/ADS/dot aliases and caller roots obtain no grant", async () => {
    let calls = 0;
    for (const path of ["E:/outside/public.txt", "D:/fixture/project/../project/public.txt", "D:/fixture/project/public.txt:stream", "\\\\server\\share\\public.txt", "\\\\?\\D:\\fixture\\project\\public.txt"]) assert.equal((await evaluate(frame("read_files", { files: JSON.stringify([{ path }]) }), async () => { calls++; return "PUBLIC"; })).cancel, true);
    assert.equal(calls, 0);
});
test("F18 published editor absolute path and null insert_line retain write classification", async () => {
    const seen: unknown[] = [];
    assert.deepEqual(await evaluate(frame("editor", { path: "D:/fixture/project/public.txt", new_text: "public", old_text: "old", insert_line: "null" }), async (file, intent) => { seen.push([file, intent]); return "PUBLIC"; }), { cancel: false });
    assert.deepEqual(seen, [["public.txt", "write"]]);
});
test("F18 native editor cannot rewrite the managed hooks even if their text classifies public", async () => {
    let calls = 0;
    for (const path of [".clinerules/hooks/TaskStart.ps1", ".clinerules/hooks/PreToolUse.ps1"]) assert.equal((await evaluate(frame("editor", { path, new_text: "disable synthetic hook" }), async () => { calls++; return "PUBLIC"; })).cancel, true);
    assert.equal(calls, 0);
});
test("F18 published per-file authority/range/shape and batch bounds remain refused", async () => {
    let calls = 0;
    for (const files of [[{ path: "public.txt", approved: true }], [{ path: "public.txt", start_line: 0 }], [{ path: "public.txt", start_line: 10, end_line: 2 }], Array.from({ length: 9 }, () => ({ path: "public.txt" })), [{ path: "public.txt", start_line: [1] }]]) assert.equal((await evaluate(frame("read_files", { files: JSON.stringify(files) }), async () => { calls++; return "PUBLIC"; })).cancel, true);
    assert.equal(calls, 0);
});
