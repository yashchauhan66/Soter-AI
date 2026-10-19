import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateClineHook } from "../adapters/ClineHookProtocol";
// Exact name captured from actual pinned Cline's request in native11.
const NAME = "soterai_safe_read__soterai_read_project_file_safely";
const frame = (toolName: string, parameters: Record<string, unknown> = { path: "public.txt" }) => ({ preToolUse: { toolName, parameters } });
test("F18 actual pinned Cline MCP tool name reaches the separate approved reader", async () => {
    let calls = 0; assert.deepEqual(await evaluateClineHook(frame(NAME), async () => { calls++; return "RESTRICTED"; }), { cancel: false }); assert.equal(calls, 0);
});
test("F18 guessed aliases, other namespaces and caller raw authority remain withheld", async () => {
    for (const name of ["mcp__soterai_safe_read__soterai_read_project_file_safely", "mcp_soterai_safe_read_soterai_read_project_file_safely", "other__soterai_read_project_file_safely"]) assert.equal((await evaluateClineHook(frame(name), async () => "PUBLIC")).cancel, true);
    for (const parameters of [{ path: "../outside" }, { path: "public.txt", raw: true }, { path: "public.txt", approved: true }]) assert.equal((await evaluateClineHook(frame(NAME, parameters), async () => "PUBLIC")).cancel, true);
});
