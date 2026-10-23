import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { SafeReadBridge } from "../agent/SafeReadBridge";
import { requestNativeClassification } from "../adapters/ClineHookProtocol";

test("F18 actual native client accepts the bounded current-session ready/read response", async t => {
    const workspace = "D:/fixture/project";
    const bridge = new SafeReadBridge({ workspace, enabled: () => true, ready: async () => true,
        read: async () => ({ status: "DENIED" }), classify: async file => file === "public.txt" ? "PUBLIC" : "RESTRICTED" });
    t.after(() => bridge.dispose()); const connection = await bridge.start();
    assert.equal(await requestNativeClassification(connection, "__soterai_session__", "ready", undefined, workspace), "PUBLIC");
    assert.equal(await requestNativeClassification(connection, "public.txt", "read", undefined, workspace), "PUBLIC");
    assert.equal(await requestNativeClassification(connection, ".env", "read", undefined, workspace), "RESTRICTED");
    assert.equal(await requestNativeClassification(connection, "public.txt", "read", undefined, "D:/fixture/other-project"), "UNAVAILABLE");
    bridge.rotate();
    assert.equal(await requestNativeClassification(connection, "public.txt", "read", undefined, workspace), "UNAVAILABLE");
});
