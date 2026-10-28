import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { DashboardPanel } from "../webview/DashboardPanel";
import { resetState, state } from "./phase2/vscode-stub";

for (const enabled of [false, true]) test(`F27 actual dashboard rejection with owner flag ${enabled} withholds caller text`, async () => {
    resetState();
    state.configInspect.set("soterai.lite.selfHygiene", { defaultValue: false, globalValue: enabled });
    const canary = "F27_SYNTHETIC_UNKNOWN_DASHBOARD_8c16e402", emitted: unknown[] = [];
    let receive!: (message: unknown) => Promise<void>;
    const prototype = DashboardPanel.prototype as unknown as { _update(): void };
    const update = prototype._update, warn = console.warn;
    prototype._update = () => {};
    console.warn = (...args: unknown[]) => { emitted.push(args); };
    try {
        const Panel = DashboardPanel as unknown as new (panel: unknown, uri: unknown) => unknown;
        new Panel({ onDidDispose() {}, webview: { onDidReceiveMessage(callback: typeof receive) { receive = callback; } } }, {});
        await receive({ command: canary });
        assert.doesNotMatch(JSON.stringify(emitted), new RegExp(canary));
        assert.equal(emitted.length, enabled ? 1 : 0, "owner-off withholds; owner-on retains one public diagnostic");
    } finally { prototype._update = update; console.warn = warn; }
});
