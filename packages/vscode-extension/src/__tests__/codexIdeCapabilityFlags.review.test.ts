import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import * as stub from "./phase2/vscode-stub";
import { BrokerManager } from "../broker/BrokerManager";
for (const [cli, ide] of [[false, false], [false, true], [true, false], [true, true]])
    test("F20B shared Responses capability follows independently enabled machine adapters: " + cli + "/" + ide, () => {
        stub.resetState("D:/SoterAI-Lite-test-profiles/f20b-flags-memory-only");
        stub.state.configInspect.set("soterai.lite.codexCliAdapter", { defaultValue: true, globalValue: cli, workspaceValue: !cli });
        stub.state.configInspect.set("soterai.lite.codexIdeAdapter", { defaultValue: true, globalValue: ide, workspaceValue: !ide });
        assert.equal(Reflect.get(BrokerManager.prototype, "codexResponsesEnabled").call({}), cli || ide);
    });
for (const key of ["lite.codexCliAdapter", "lite.codexIdeAdapter"])
    test("F20B individual adapter drift changes broker binding while the other remains enabled: " + key, async () => {
        stub.resetState("D:/SoterAI-Lite-test-profiles/f20b-flags-memory-only");
        const manager = new BrokerManager(stub.makeExtensionContext("D:/SoterAI-Lite-test-profiles/f20b-flags-memory-only/storage") as never);
        try {
            const before = Reflect.get(manager, "binding").call(manager);
            stub.state.configInspect.set("soterai." + key, { defaultValue: true, globalValue: false });
            assert.notEqual(Reflect.get(manager, "binding").call(manager), before);
        } finally { await manager.stop(); manager.dispose(); }
    });
