import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { SyntheticPreview, registerSyntheticPreviewCommands } from "../project-privacy/SyntheticPreview";
import * as stub from "./phase2/vscode-stub";
import { tmpdir } from "node:os";

const active: SyntheticPreview[] = [];
afterEach(async () => { await Promise.all(active.splice(0).map(item => item.stop())); });
test("fixed loopback preview supplies usable generated responses and never echoes input", async () => {
    const preview = new SyntheticPreview(); active.push(preview);
    const url = await preview.start();
    assert.match(url, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.deepEqual(await (await fetch(url + "/health")).json(), { syntheticOnly: true, status: "ready", realServiceAccess: false });
    const users = await (await fetch(url + "/api/users?ignored=TEST_ONLY_PRIVATE_REQUEST_VALUE")).text();
    assert.ok(users.includes("Synthetic Developer")); assert.ok(!users.includes("TEST_ONLY_PRIVATE_REQUEST_VALUE"));
    assert.equal((await fetch(url + "/unknown")).status, 404);
    const posted = await fetch(url + "/api/users", { method: "POST", body: "TEST_ONLY_PRIVATE_REQUEST_VALUE" });
    assert.equal(posted.status, 405); assert.ok(!(await posted.text()).includes("TEST_ONLY_PRIVATE_REQUEST_VALUE"));
});
test("repeated starts share one service and stop withdraws it", async () => {
    const preview = new SyntheticPreview(); active.push(preview);
    const addresses = await Promise.all([preview.start(), preview.start()]);
    assert.equal(addresses[0], addresses[1]); await preview.stop();
    await assert.rejects(fetch(addresses[0] + "/health"));
});
test("commands require explicit opt-in and report actual start/stop outcomes", async () => {
    stub.resetState(tmpdir()); const context = stub.makeExtensionContext(tmpdir());
    registerSyntheticPreviewCommands(context as never);
    try {
        assert.deepEqual(await stub.commands.executeCommand("soterai.startSyntheticPreview"), { status: "UNAVAILABLE" });
        stub.state.config.set("soterai.projectPrivacy.syntheticRuntime", true);
        const result = await stub.commands.executeCommand("soterai.startSyntheticPreview") as { status: string; url: string };
        assert.equal(result.status, "STARTED"); assert.equal((await fetch(result.url + "/api/users")).status, 200);
        assert.deepEqual(await stub.commands.executeCommand("soterai.stopSyntheticPreview"), { status: "STOPPED" });
        await assert.rejects(fetch(result.url + "/health"));
    } finally { context.subscriptions.forEach(item => item.dispose()); }
});
