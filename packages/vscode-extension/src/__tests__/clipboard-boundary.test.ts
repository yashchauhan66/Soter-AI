import "./phase2/register.mjs";
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import * as stub from "./phase2/vscode-stub";
import { registerClipboardGuard } from "../clipboard/ClipboardGuard";
import { ExtensionState } from "../state";

test("Safe Paste inserts the scanned snapshot even if the clipboard changes during scanning", async () => {
    stub.resetState();
    const inserted: string[] = [];
    const selection = { start: 0, end: 0 };
    stub.state.activeEditor = { document: { version: 1 }, selections: [selection], edit: async (run: (builder: unknown) => void) => {
        run({ replace: (_range: unknown, value: string) => inserted.push(value) }); return true;
    } };
    stub.state.clipboard = "Public scanned control.";
    stub.commands.registerCommand("editor.action.clipboardPasteAction", () => inserted.push(stub.state.clipboard));
    const state = ExtensionState.getInstance();
    const previous = state.engine.scan;
    state.engine.scan = (async () => { stub.state.clipboard = "SYNTHETIC_UNSCANNED_PRIVATE_VALUE"; return { decision: "allow" }; }) as never;
    const context = stub.makeExtensionContext("synthetic-only");
    registerClipboardGuard(context as never);
    try {
        await stub.commands.executeCommand("soterai.safePaste");
        assert.deepEqual(inserted, ["Public scanned control."]);
    } finally { state.engine.scan = previous; context.subscriptions.forEach(item => item.dispose()); }
});

test("Safe Paste fails closed when the target is outside the supported text editor", async () => {
    stub.resetState();
    let rawPastes = 0;
    stub.commands.registerCommand("editor.action.clipboardPasteAction", () => rawPastes++);
    const context = stub.makeExtensionContext("synthetic-only");
    registerClipboardGuard(context as never);
    try { await stub.commands.executeCommand("soterai.safePaste"); assert.equal(rawPastes, 0); }
    finally { context.subscriptions.forEach(item => item.dispose()); }
});

test("project privacy withholds a risky original paste even when that choice is returned", async () => {
    stub.resetState();
    const inserted: string[] = [];
    stub.state.activeEditor = { document: { version: 1 }, selections: [{ start: 0, end: 0 }], edit: async (run: (builder: unknown) => void) => {
        run({ replace: (_range: unknown, value: string) => inserted.push(value) }); return true;
    } };
    stub.state.clipboard = "SYNTHETIC_PRIVATE_VALUE";
    const state = ExtensionState.getInstance(); const previous = state.engine.scan;
    state.engine.scan = (async () => ({ decision: "block", findings: [], riskScore: 95 })) as never;
    const dialog = mock.method(stub.window, "showWarningMessage", async () => "Paste Original");
    const context = stub.makeExtensionContext("synthetic-only"); registerClipboardGuard(context as never);
    try {
        await stub.commands.executeCommand("soterai.safePaste"); assert.deepEqual(inserted, []);
        stub.state.config.set("soterai.projectPrivacy.enabled", false);
        await stub.commands.executeCommand("soterai.safePaste"); assert.deepEqual(inserted, ["SYNTHETIC_PRIVATE_VALUE"]);
    } finally { dialog.mock.restore(); state.engine.scan = previous; context.subscriptions.forEach(item => item.dispose()); }
});
