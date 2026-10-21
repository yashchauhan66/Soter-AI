import "../../../../packages/vscode-extension/src/__tests__/phase2/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";
test("Native peer fixture waits for a completed JSON receipt rather than file existence", async () => {
    const host: any = await import("../../../../packages/vscode-extension/src/__tests__/host/liteSafeReadMcp.host"); const dir = await mkdtemp("D:\\SoterAI-Lite-test-profiles\\f21-receipt-fixture-"), file = join(dir, "peer-ready.json");
    assert.equal(await host.readNativePeerReceipt(file), undefined); await writeFile(file, '{"url":'); assert.equal(await host.readNativePeerReceipt(file), undefined);
    await appendFile(file, '"http://127.0.0.1:12345","session":"SYNTHETIC_ONLY"}'); assert.deepEqual(await host.readNativePeerReceipt(file), { url: "http://127.0.0.1:12345", session: "SYNTHETIC_ONLY" }); assert.equal(await readFile(file, "utf8"), '{"url":"http://127.0.0.1:12345","session":"SYNTHETIC_ONLY"}');
});
test("Native peer receipt fixture refuses invalid/non-object JSON without changing it", async () => {
    const host: any = await import("../../../../packages/vscode-extension/src/__tests__/host/liteSafeReadMcp.host"); const dir = await mkdtemp("D:\\SoterAI-Lite-test-profiles\\f21-receipt-invalid-"), file = join(dir, "peer-closed.json");
    for (const text of ["{", "null", "[]", '"PUBLIC"']) { await writeFile(file, text); assert.equal(await host.readNativePeerReceipt(file), undefined); assert.equal(await readFile(file, "utf8"), text); }
    await writeFile(file, '{"closed":true}'); assert.deepEqual(await host.readNativePeerReceipt(file), { closed: true });
});
