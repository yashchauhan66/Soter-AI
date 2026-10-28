/** Evidence-only LOW same-lineage review. Real F29 adapter/session/model;
 * existing fake VS Code plumbing only. No Code/native launch or profile/file writes. */
import "../../../../packages/vscode-extension/src/__tests__/phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import * as api from "../../../../packages/vscode-extension/src/__tests__/phase2/vscode-stub";
import type * as vscode from "vscode";
import { initializeBoundaryState, RULES_KEY } from "../../../../packages/vscode-extension/src/ai-boundary/BoundarySnapshot";
import { matchesRule } from "../../../../packages/vscode-extension/src/ai-boundary/policy";

const native = () => import("../../../../packages/vscode-extension/src/protection-center/ProtectionCenter");
const turn = () => new Promise<void>(resolve => setImmediate(resolve));
async function fixture() {
    api.resetState("C:\\f29-review-synthetic"); api.registeredCommands.clear();
    api.state.configInspect.set("soterai.lite.selfHygiene", { defaultValue: false, globalValue: true });
    const m = await native(), context = api.makeExtensionContext("C:\\f29-review-synthetic-component");
    initializeBoundaryState(context.workspaceState);
    const nativeWindow = api.window as unknown as Record<string, unknown>;
    const beforeCreate = nativeWindow.createTreeView, beforeDecoration = nativeWindow.registerFileDecorationProvider;
    const beforeInterval = globalThis.setInterval, beforeClearInterval = globalThis.clearInterval;
    const timers: Array<{ callback: () => void; delay: number }> = [];
    const views = new Map<string, { provider: vscode.TreeDataProvider<unknown>; visible: boolean }>();
    let provider: vscode.FileDecorationProvider | undefined, reads = 0;
    nativeWindow.createTreeView = (id: string, options: { treeDataProvider: vscode.TreeDataProvider<unknown> }) => {
        views.set(id, { provider: options.treeDataProvider, visible: true });
        // API contract permits initial visible=true; no visibility change occurs.
        return { visible: true, dispose() {}, onDidChangeVisibility: new api.EventEmitter<{ visible: boolean }>().event };
    };
    nativeWindow.registerFileDecorationProvider = (value: vscode.FileDecorationProvider) => { provider = value; return new api.Disposable(); };
    globalThis.setInterval = ((callback: () => void, delay: number) => {
        timers.push({ callback, delay }); return { unref() {} };
    }) as typeof globalThis.setInterval;
    globalThis.clearInterval = (() => {}) as typeof globalThis.clearInterval;
    let center: Awaited<ReturnType<typeof m.registerProtectionCenter>>;
    try {
        center = m.registerProtectionCenter(context as unknown as vscode.ExtensionContext, {
            sentinel: { getEvents() { reads++; return []; }, isEnabled: true }, brokerState: () => "offline",
        });
        await center.refresh(); await turn();
    } catch (error) {
        globalThis.setInterval = beforeInterval; globalThis.clearInterval = beforeClearInterval;
        nativeWindow.createTreeView = beforeCreate;
        if (beforeDecoration === undefined) delete nativeWindow.registerFileDecorationProvider; else nativeWindow.registerFileDecorationProvider = beforeDecoration;
        throw error;
    }
    return { context, views, timers, get reads() { return reads; }, get provider() { return provider; },
        close() {
            center.dispose(); for (const disposable of context.subscriptions) disposable.dispose();
            globalThis.setInterval = beforeInterval; globalThis.clearInterval = beforeClearInterval;
            nativeWindow.createTreeView = beforeCreate;
            if (beforeDecoration === undefined) delete nativeWindow.registerFileDecorationProvider; else nativeWindow.registerFileDecorationProvider = beforeDecoration;
        } };
}

test("F29 review: initially visible native trees refresh activity without a visibility-change event", async () => {
    const f = await fixture();
    try {
        assert.equal(f.views.size, 3); assert([...f.views.values()].every(view => view.visible));
        assert.equal(f.timers.length, 1); assert.equal(f.timers[0].delay, 30000); assert(f.reads > 0);
        const before = f.reads; f.timers[0].callback(); await turn();
        assert(f.reads > before, "The actual adapter timer must refresh an initially visible activity tree.");
    } finally { f.close(); }
});

test("F29 review: saved deny lock decoration matches the owner's NFC normalization", async () => {
    const f = await fixture();
    try {
        const folder = api.state.folders[0], pattern = "cafe\u0301.txt", normalized = "caf\u00e9.txt";
        const rule = { kind: "file" as const, pattern };
        // Same normalization used by BoundarySnapshot.manualMatches (source lines104–105).
        assert.equal(matchesRule(normalized.normalize("NFC"), { ...rule, pattern: pattern.normalize("NFC") }), true);
        f.context._inspect.workspaceStore.set(RULES_KEY, { [folder.uri.toString()]: { paths: [{ kind: "file", pattern: "public.txt" }, rule], regions: [] } });
        assert(f.provider);
        const positive = await f.provider.provideFileDecoration(api.Uri.joinPath(folder.uri, "public.txt") as unknown as vscode.Uri, undefined as never);
        assert(positive, "ASCII control must prove real provider and accepted stored rules are wired.");
        const equivalent = await f.provider.provideFileDecoration(api.Uri.joinPath(folder.uri, normalized) as unknown as vscode.Uri, undefined as never);
        assert(equivalent, "NFC-equivalent path enforced by the owner must retain its saved-deny lock decoration.");
    } finally { f.close(); }
});
