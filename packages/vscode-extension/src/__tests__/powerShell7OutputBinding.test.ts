import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { beforeEach, afterEach, test } from "node:test";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type * as vscode from "vscode";
import * as stub from "./phase2/vscode-stub";
import { VaultManager } from "../firewall/VaultManager";
import { BoundarySnapshot, initializeBoundaryState } from "../ai-boundary/BoundarySnapshot";
import type { ManagedOutputFilter } from "../terminal/ManagedOutputFilter";
let context: ReturnType<typeof stub.makeExtensionContext>, manager: VaultManager, root: string, filters: ManagedOutputFilter[];
function flag(name: string, value: boolean) { stub.state.config.set("soterai.lite." + name, value); stub.state.configInspect.set("soterai.lite." + name, { globalValue: value, defaultValue: true }); }
async function filter(route?: string) { const create = manager.createManagedOutputFilter.bind(manager) as unknown as (root: vscode.Uri, enabled: () => boolean, route?: string) => Promise<ManagedOutputFilter>; const value = await create(stub.Uri.file(root) as unknown as vscode.Uri, () => true, route); filters.push(value); return value; }
beforeEach(async () => {
    const base = await mkdtemp(join(tmpdir(), "soterai-f11-route-binding-")); root = join(base, "project"); await mkdir(root); await mkdir(join(base, "storage")); stub.resetState(root); context = stub.makeExtensionContext(base); context.globalStorageUri = stub.Uri.file(join(base, "storage")); filters = [];
    initializeBoundaryState(context.workspaceState as never); await BoundarySnapshot.load(); for (const name of ["ps51Terminal", "ps7Terminal", "vaultMode", "secretMatching", "outputRedactor"]) flag(name, true); manager = new VaultManager(context as never);
});
afterEach(() => { filters.forEach(value => value.dispose()); context.subscriptions.forEach(value => value.dispose()); stub.resetState(); });
test("F11-OB01 real private PS7 factory remains available with PS5.1 flag off", async () => { flag("ps51Terminal", false); const value = await filter("ps7"); assert.equal(value.available(), true); value.push("stdout", Buffer.from("public")); assert.equal(value.finish(0).stdout, "public"); });
test("F11-OB02 PS7 flag off withholds factory despite PS5.1 flag on", async () => { flag("ps7Terminal", false); await assert.rejects(() => filter("ps7")); });
test("F11-OB03 selected PS7 flag is checked again before completed publication", async () => { const value = await filter("ps7"); value.push("stdout", Buffer.from("public")); flag("ps7Terminal", false); assert.equal(value.finish(0).status, "WITHHELD"); });
test("F11-OB04 default PS5.1 factory retains its own positive control when PS7 is off", async () => { flag("ps7Terminal", false); const value = await filter(); assert.equal(value.available(), true); value.push("stdout", Buffer.from("public")); assert.equal(value.finish(0).stdout, "public"); });
test("F11-OB05 unknown route cannot choose another availability gate", async () => { await assert.rejects(() => filter("unknown")); });
test("F11-OB06 shared output matching dependency still withholds cmd", async () => { flag("secretMatching", false); await assert.rejects(() => filter("ps7")); });
