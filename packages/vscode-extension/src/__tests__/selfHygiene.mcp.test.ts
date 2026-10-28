import assert from "node:assert/strict";
import { test } from "node:test";
import { handleMcpMessage } from "../agent/mcpServer";

const CANARY = "F27_SYNTHETIC_MCP_DIAGNOSTIC_8c16e402";
test("F27 MCP unknown-tool diagnostic does not reflect caller name", () => {
    const reply = handleMcpMessage({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: CANARY } }) as any;
    assert.equal(reply.error.code, -32602); assert.equal(JSON.stringify(reply).includes(CANARY), false);
});
test("F27 MCP unknown-method diagnostic does not reflect caller method", () => {
    const reply = handleMcpMessage({ jsonrpc: "2.0", id: 2, method: CANARY }) as any;
    assert.equal(reply.error.code, -32601); assert.equal(JSON.stringify(reply).includes(CANARY), false);
});
test("F27 MCP detector exception is value-free and subsequent public ping still works", () => {
    const args = Object.defineProperty({}, "text", { get() { throw new Error(CANARY); } });
    const reply = handleMcpMessage({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "soterai_scan_text", arguments: args } }) as any;
    assert.equal(reply.error.code, -32603); assert.equal(JSON.stringify(reply).includes(CANARY), false);
    assert.deepEqual(handleMcpMessage({ jsonrpc: "2.0", id: 4, method: "ping" }), { jsonrpc: "2.0", id: 4, result: {} });
});
