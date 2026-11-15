import "./phase2/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as stub from "./phase2/vscode-stub";
import { acquireBoundaryRead, installReadReliabilityOwner, ReadReliability } from "../security/ReadReliability";
const flag = "soterai.lite.reliability";
test("F28-O01: runtime and Lite manifests have parity and a restricted default-true owner flag", () => {
    for (const name of ["packages/vscode-extension/package.json", "packages/soterai-lite/package.json"]) {
        const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../..", name), "utf8"));
        const property = manifest.contributes.configuration.properties[flag];
        assert(property); assert.equal(property.default, true); assert.equal(property.scope, "machine");
        assert(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes(flag));
        assert.equal(manifest.contributes.commands.filter((c: any) => c.command === "soterai.readReliabilityStatus").length, 1);
    }
});
test("F28-O02: machine/global values override repository attempts and inspection failure denies", async t => {
    stub.resetState("C:\\Synthetic F28\\workspace");
    const { reliabilityEnabled } = await import("../security/ReadReliabilityOwner");
    stub.state.configInspect.set(flag, { defaultValue: true, workspaceValue: false }); assert.equal(reliabilityEnabled(), true);
    stub.state.configInspect.set(flag, { defaultValue: true, globalValue: false, workspaceValue: true }); assert.equal(reliabilityEnabled(), false);
    stub.state.configInspect.set(flag, { defaultValue: true, globalValue: "true" }); assert.equal(reliabilityEnabled(), false);
    t.mock.method(stub.workspace, "getConfiguration", () => { throw Error("SYNTHETIC_PRIVATE_DIAGNOSTIC"); });
    assert.equal(reliabilityEnabled(), false);
});
test("F28-O03: actual owner registration withdraws leases on config/trust and stops on dispose", async t => {
    stub.resetState("C:\\Synthetic F28\\workspace"); stub.state.configInspect.set(flag, { defaultValue: true });
    const configuration = new stub.EventEmitter<{ affectsConfiguration(section: string): boolean }>();
    t.mock.method(stub.workspace, "onDidChangeConfiguration", configuration.event as never);
    const context = stub.makeExtensionContext("C:\\Synthetic F28\\profile");
    t.after(() => { context.subscriptions.forEach(d => d.dispose()); configuration.dispose(); installReadReliabilityOwner(new ReadReliability({ enabled: () => true })); });
    const { registerReadReliability } = await import("../security/ReadReliabilityOwner");
    const owner = registerReadReliability(context as never); owner.finishStartup();
    const handler = stub.registeredCommands.get("soterai.readReliabilityStatus"); assert(handler);
    assert.equal((handler("SYNTHETIC_PRIVATE_ARGUMENT", { enabled: true }) as any).status, "READY");
    const lease = acquireBoundaryRead(); const expired = lease.expired.catch(() => "expired");
    stub.state.configInspect.set(flag, { defaultValue: true, globalValue: false, workspaceValue: true });
    configuration.fire({ affectsConfiguration: section => section === "soterai" });
    assert.equal(await expired, "expired"); assert.throws(() => lease.check()); assert.throws(() => acquireBoundaryRead()); lease.release();
    assert.equal((handler() as any).status, "DISABLED");
    context.subscriptions.forEach(d => d.dispose()); assert.throws(() => acquireBoundaryRead()); assert.equal((owner.status() as any).status, "STOPPED");
});
