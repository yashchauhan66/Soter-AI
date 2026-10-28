import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import * as os from "node:os";
import { AISentinel } from "../sentinel/AISentinel";
import { capturedText, makeExtensionContext, resetState, state, workspace, Uri, EventEmitter } from "./phase2/vscode-stub";

const CANARY = "F27_SYNTHETIC_ACTIVITY_VALUE_8c16e402";
function fixture(enabled = true) {
    resetState();
    state.configInspect.set("soterai.lite.selfHygiene", { defaultValue: false, globalValue: enabled });
    const context = makeExtensionContext(os.tmpdir());
    context.globalState.update = async (key, value) => { context._inspect.globalStore.set(key, value); };
    return { context, sentinel: new AISentinel(context as never) };
}

test("F27 activity keeps public event metadata while withholding caller text from storage, UI and export", () => {
    const { context, sentinel } = fixture();
    try {
        sentinel.recordEvent({ type: "protected_access", risk: "high", source: CANARY, filePath: CANARY,
            decision: "monitor", redactedEvidence: CANARY });
        assert.equal(sentinel.getEvents().length, 1);
        assert.equal(sentinel.getEvents()[0].type, "protected_access");
        for (const text of [JSON.stringify(context._inspect.globalStore.get("soterai.sentinelEvents")), sentinel.exportReport(), capturedText()]) {
            assert.equal(text.includes(CANARY), false, "Activity sink retained a private value");
        }
    } finally { sentinel.dispose(); }
});

test("F27 disabled activity sink withholds a new event and releases queued metadata", () => {
    const { context, sentinel } = fixture(false);
    try {
        sentinel.recordEvent({ type: "file_change", risk: "low", source: CANARY, decision: "monitor", redactedEvidence: CANARY });
        assert.equal(sentinel.getEvents().length, 0);
        assert.equal(JSON.stringify(context._inspect.globalStore.get("soterai.sentinelEvents") ?? []).includes(CANARY), false);
        assert.equal(sentinel.exportReport().includes(CANARY), false);
    } finally { sentinel.dispose(); }
});

test("F27 held document callback cannot read or persist after Sentinel disposal", async () => {
    const { context, sentinel } = fixture();
    const original = workspace.openTextDocument;
    let release!: (value: unknown) => void, reads = 0;
    const held = new Promise(resolve => { release = resolve; });
    workspace.openTextDocument = (() => held) as never;
    try {
        await sentinel.enable();
        const pending = (sentinel as unknown as { onFileChange(uri: Uri, change: string): Promise<void> })
            .onFileChange(Uri.file(os.tmpdir() + "/CLAUDE.md"), "change");
        sentinel.dispose(); release({ getText: () => { reads++; return CANARY; } }); await pending;
        assert.equal(reads, 0); assert.equal(sentinel.getEvents().length, 0);
        assert.equal(context._inspect.globalStore.has("soterai.sentinelEvents"), false);
    } finally { workspace.openTextDocument = original; sentinel.dispose(); }
});

test("F27 flag off and on cannot revive a held activity document callback", async () => {
    const changes = new EventEmitter<any>(), previousChanges = workspace.onDidChangeConfiguration;
    workspace.onDidChangeConfiguration = changes.event;
    const { sentinel } = fixture(); const previousOpen = workspace.openTextDocument;
    let release!: (value: unknown) => void, reads = 0;
    const held = new Promise(resolve => { release = resolve; });
    workspace.openTextDocument = (() => held) as never;
    try {
        await sentinel.enable();
        const pending = (sentinel as unknown as { onFileChange(uri: Uri, change: string): Promise<void> })
            .onFileChange(Uri.file(os.tmpdir() + "/CLAUDE.md"), "change");
        state.configInspect.set("soterai.lite.selfHygiene", { defaultValue: false, globalValue: false });
        changes.fire({ affectsConfiguration: () => true });
        state.configInspect.set("soterai.lite.selfHygiene", { defaultValue: false, globalValue: true });
        changes.fire({ affectsConfiguration: () => true });
        assert.equal(sentinel.isEnabled, true);
        release({ getText: () => { reads++; return CANARY; } }); await pending;
        assert.equal(reads, 0); assert.equal(sentinel.getEvents().length, 0);
    } finally {
        workspace.openTextDocument = previousOpen; workspace.onDidChangeConfiguration = previousChanges;
        sentinel.dispose(); changes.dispose();
    }
});

test("F27 activity storage failure never throws private text toward an outer crash reporter", () => {
    const { context, sentinel } = fixture();
    context.globalState.update = () => { throw new Error(CANARY); };
    try {
        assert.doesNotThrow(() => sentinel.recordEvent({ type: "file_change", risk: "low", source: CANARY, decision: "monitor", redactedEvidence: CANARY }));
        assert.equal(sentinel.exportReport().includes(CANARY), false);
        assert.equal(JSON.parse(sentinel.exportReport()).persistence, "INCOMPLETE");
    } finally { sentinel.dispose(); }
});

test("F27 opted-in activity restart minimizes legacy owned storage before retaining a new copy", async () => {
    resetState(); state.configInspect.set("soterai.lite.selfHygiene", { defaultValue: false, globalValue: true });
    const context = makeExtensionContext(os.tmpdir());
    context.globalState.update = async (key, value) => { context._inspect.globalStore.set(key, value); };
    context._inspect.globalStore.set("soterai.sentinelEvents", [{ id: CANARY, timestamp: Date.now(), type: "file_change", risk: "low",
        source: CANARY, filePath: CANARY, decision: "monitor", redactedEvidence: CANARY }]);
    const sentinel = new AISentinel(context as never);
    try {
        await new Promise<void>(resolve => setImmediate(resolve));
        assert.equal(sentinel.getEvents().length, 1);
        assert.equal(JSON.stringify(context._inspect.globalStore.get("soterai.sentinelEvents")).includes(CANARY), false);
        assert.equal(sentinel.exportReport().includes(CANARY), false);
    } finally { sentinel.dispose(); }
});

test("F27 failed activity opt-in is value-free and cannot leave observation enabled", async () => {
    const { context, sentinel } = fixture();
    context.globalState.update = async () => { throw new Error(CANARY); };
    try {
        await assert.rejects(sentinel.enable(), /Owned activity preference unavailable/);
        assert.equal(sentinel.isEnabled, false); assert.equal(sentinel.exportReport().includes(CANARY), false);
    } finally { sentinel.dispose(); }
});
