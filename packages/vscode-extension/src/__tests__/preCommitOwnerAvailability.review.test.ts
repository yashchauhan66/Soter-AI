import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import http from "node:http";
import { syncBuiltinESMExports } from "node:module";
import { test } from "node:test";
import { PreCommitOwnerService } from "../history-hooks/PreCommitOwnerService";

test("F26a actual owned loopback server error withdraws availability before natural close completes", async t => {
    const original = http.createServer; let owned: http.Server | undefined;
    t.mock.method(http, "createServer", ((...args: Parameters<typeof http.createServer>) => {
        owned = Reflect.apply(original, http, args); return owned;
    }) as typeof http.createServer); syncBuiltinESMExports();
    t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
    const key = generateKeyPairSync("ed25519").privateKey;
    const owner = new PreCommitOwnerService({ root: "C:\\Synthetic F26a Availability", generation: "a1234567-1234-4567-8123-123456789abc",
        workerSha256: "a".repeat(64), runtimeSha256: "b".repeat(64), valid: () => true, loadKey: async () => key });
    t.after(async () => { await owner.close(); });
    assert.equal(owner.available, false); const descriptor = await owner.start(); assert.ok(descriptor);
    assert.ok(owned); const address = owned.address(); assert.ok(address && typeof address !== "string" && address.address === "127.0.0.1");
    assert.equal(owner.available, true); assert.equal(owner.busy, false);
    owned.emit("error", Error("Synthetic owned server failure."));
    assert.equal(owner.available, false, "Transport failure cannot retain a live publication witness.");
    await owner.close(); assert.equal(owned.listening, false); assert.equal(owner.available, false);
    assert.equal(await owner.start(), undefined, "A stopped owner remains one-shot.");
});
