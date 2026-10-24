import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test, mock } from "node:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import os from "node:os";
import * as stub from "./phase2/vscode-stub";
import { registerBrokerCommands } from "../broker/commands";
import { EncryptedBackupSink } from "../broker/EncryptedBackupSink";

for (const route of ["soterai.secureAllAI", "soterai.setupBrokerIntegration"] as const) for (const stage of ["approval", "backup"] as const) {
    test(`F14-R01 ${route} refuses stale owner during ${stage} before config write`, async () => {
        const base = process.platform === "win32" ? "D:/SoterAI-Lite-test-profiles" : os.tmpdir(); await fs.mkdir(base, { recursive: true });
        const root = await fs.mkdtemp(path.join(base, "f14-routing-owner-")), home = path.join(root, "home"), workspace = path.join(root, "workspace");
        const target = path.join(route === "soterai.secureAllAI" ? home : workspace, ".continue/config.json"), original = JSON.stringify({ baseURL: "https://synthetic-provider.example.test/v1" });
        await fs.mkdir(path.dirname(target), { recursive: true }); await fs.mkdir(workspace, { recursive: true }); await fs.writeFile(target, original, { flag: "wx" });
        stub.resetState(workspace); const context = stub.makeExtensionContext(path.join(root, "storage")); let generation = 1;
        const snapshot = () => ({ state: "healthy", session: "synthetic-owner-" + generation, port: 49150 + generation, url: "http://127.0.0.1:" + (49150 + generation) });
        const manager = { ownedSnapshot: snapshot, get port() { return snapshot().port; }, get url() { return snapshot().url; }, getClientToken: async () => "synthetic-client-" + generation,
            start: async () => ({ running: true, state: "healthy", url: snapshot().url }) };
        const mocks: Array<{ mock: { restore(): void } }> = [mock.method(os, "homedir", () => home), mock.method(globalThis, "fetch", async () => ({ status: 200, text: async () => "data: [DONE]\n\n" }) as never),
            mock.method(stub.window, "showInformationMessage", async (message: string) => { if (message.startsWith("Covers:")) return "Review scoped setup"; if (stage === "approval" && message.includes("tool config(s)")) generation++; return "Apply scoped routing changes"; }),
            mock.method(stub.window, "showWarningMessage", async (_message: string, _options: unknown, action: string) => { if (stage === "approval") generation++; return action; }),
            mock.method(stub.window, "showQuickPick", async (items: unknown[]) => items[0]),
        ];
        if (stage === "backup") mocks.push(mock.method(EncryptedBackupSink.prototype, "store", async () => { generation++; return "b".repeat(32); }));
        registerBrokerCommands(context as never, manager as never, () => undefined);
        try { await stub.commands.executeCommand(route).catch(error => assert.match(String(error), /Owned broker session changed/)); assert.equal(await fs.readFile(target, "utf8"), original, "Stale ownership must withhold this configuration write."); }
        finally { for (const entry of mocks.reverse()) entry.mock.restore(); context.subscriptions.forEach(d => d.dispose()); stub.resetState(); }
    });
}
