import assert from "node:assert/strict";
import { test } from "node:test";
test("F12-LR01 cmd set/p line budget is conservative before any worker admission", async () => {
    const { parseCmdCommand } = await import("../../../core/src/CmdCommand"); assert.equal(parseCmdCommand("echo " + "x".repeat(1001)), undefined);
});
