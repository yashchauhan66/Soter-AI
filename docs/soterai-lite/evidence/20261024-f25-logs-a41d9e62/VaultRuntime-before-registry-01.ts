import * as vscode from "vscode";
import { randomUUID } from "node:crypto";
import { parseVaultAppDescriptor, VAULT_RUNTIME_LIMITS, type VaultAppDescriptor } from "../../../core/src/VaultAppDescriptor";
import { VaultManager, vaultRuntimeEnabled } from "../firewall/VaultManager";
import { samePath } from "../firewall/VaultStorage";
import { runtimeBinding } from "./RuntimeBinding";
import { VaultAppJob, type VaultAppJobSnapshot } from "./VaultAppJob";

const DESCRIPTORS = "soterai.lite.vaultApps.v1", OWNERSHIP = "soterai.lite.vaultJobs.v1";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const unavailable = (): never => { throw new Error("Managed application unavailable. Review the app and vault settings before trying again."); };
export interface UnverifiedVaultJob { readonly id: string; readonly state: "UNVERIFIED"; readonly pid?: number }
export type VaultRuntimeSnapshot = VaultAppJobSnapshot | UnverifiedVaultJob;
function recovered(value: unknown): UnverifiedVaultJob[] {
    if (!Array.isArray(value) || value.length > 64) return unavailable();
    const ids = new Set<string>();
    return value.map(row => {
        if (!row || typeof row !== "object" || Array.isArray(row) || ![Object.prototype, null].includes(Object.getPrototypeOf(row))) return unavailable();
        const fields = Object.getOwnPropertyDescriptors(row);
        if (Reflect.ownKeys(fields).some(key => typeof key !== "string" || !["id", "state", "pid", "exitCode"].includes(key)
            || !Object.hasOwn(fields[key], "value") || !fields[key].enumerable)) return unavailable();
        const id = fields.id?.value, state = fields.state?.value, pid = fields.pid?.value, code = fields.exitCode?.value;
        if (typeof id !== "string" || !UUID.test(id) || ids.has(id) || !["READY", "RUNNING", "STOP_REQUESTED", "STOP_UNCONFIRMED", "UNVERIFIED"].includes(state)
            || pid !== undefined && (!Number.isInteger(pid) || pid <= 0) || code !== undefined && (!Number.isInteger(code) || code < -2147483648 || code > 2147483647)) return unavailable();
        ids.add(id); return Object.freeze({ id, state: "UNVERIFIED", ...(pid === undefined ? {} : { pid }) });
    });
}
/** Coordinates only processes it created in this activation. Persisted PIDs
 * are disclosure metadata; never adopted, signalled or treated as exit proof. */
export class VaultRuntime implements vscode.Disposable {
    #context: vscode.ExtensionContext;
    #vault: VaultManager;
    #epoch = 0;
    #disposed = false;
    #pending = 0;
    #jobs = new Map<string, VaultAppJob>();
    #active = new Set<string>();
    #prior = new Map<string, UnverifiedVaultJob>();
    #reserved = new Set<string>();
    #writeQueue: Promise<void> = Promise.resolve();
    #ownershipAvailable = true;
    constructor(context: vscode.ExtensionContext, vault: VaultManager) {
        this.#context = context; this.#vault = vault;
        try {
            const saved = context.workspaceState.get<unknown>(OWNERSHIP, []);
            for (const value of recovered(saved)) this.#prior.set(value.id, value);
        } catch { this.#ownershipAvailable = false; this.#prior.clear(); }
        const revoke = () => { this.#epoch++; for (const id of this.#active) this.#jobs.get(id)?.requestStop(); };
        context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration("soterai")) revoke(); }),
            vscode.workspace.onDidChangeWorkspaceFolders(revoke));
    }
    descriptors(): readonly VaultAppDescriptor[] {
        try {
            const stored = this.#context.workspaceState.get<unknown>(DESCRIPTORS, []);
            if (!Array.isArray(stored) || stored.length > VAULT_RUNTIME_LIMITS.maxDescriptors) return Object.freeze([]);
            const result: VaultAppDescriptor[] = [], ids = new Set<string>();
            for (const value of stored) { const descriptor = parseVaultAppDescriptor(value); if (!descriptor || ids.has(descriptor.id)) continue; ids.add(descriptor.id); result.push(descriptor); }
            return Object.freeze(result);
        } catch { return Object.freeze([]); }
    }
    async save(value: unknown): Promise<VaultAppDescriptor> {
        try {
            const descriptor = parseVaultAppDescriptor(value); if (!descriptor || !this.#allowed(descriptor)) return unavailable();
            runtimeBinding(descriptor); const epoch = this.#epoch;
            const operation = this.#writeQueue.then(async () => {
                if (epoch !== this.#epoch || !this.#allowed(descriptor)) return unavailable();
                const all = [...this.descriptors()], index = all.findIndex(item => item.id === descriptor.id);
                if (index >= 0) all[index] = descriptor; else all.push(descriptor);
                if (all.length > VAULT_RUNTIME_LIMITS.maxDescriptors) return unavailable();
                await this.#context.workspaceState.update(DESCRIPTORS, all);
                if (epoch !== this.#epoch || !this.#allowed(descriptor) || JSON.stringify(this.descriptors().find(item => item.id === descriptor.id)) !== JSON.stringify(descriptor)) return unavailable();
            });
            this.#writeQueue = operation.catch(() => {}); await operation; return descriptor;
        } catch { return unavailable(); }
    }
    async run(id: string, signal?: AbortSignal): Promise<VaultAppJob | undefined> {
        const descriptor = this.descriptors().find(item => item.id === id);
        if (!descriptor || !this.#allowed(descriptor) || this.#pending + this.#active.size >= VAULT_RUNTIME_LIMITS.maxJobs
            || this.#prior.size + this.#reserved.size + this.#active.size >= 64) return undefined;
        try { runtimeBinding(descriptor); } catch { return undefined; }
        this.#pending++; const epoch = this.#epoch, serialized = JSON.stringify(descriptor), jobId = randomUUID(); this.#reserved.add(jobId);
        const enabled = () => !signal?.aborted && epoch === this.#epoch && this.#allowed(descriptor)
            && JSON.stringify(this.descriptors().find(item => item.id === id)) === serialized;
        let job: VaultAppJob | undefined;
        try {
            await this.#persist(); if (!enabled()) return undefined;
            job = await this.#vault.withRuntimeValues(descriptor, (values, guard) => {
                if (!enabled() || !guard()) return unavailable(); runtimeBinding(descriptor);
                const owned = new VaultAppJob({ descriptor: { ...descriptor, id: jobId }, values,
                    runtime: { executable: process.execPath, electron: !!process.versions.electron }, parentEnvironment: process.env,
                    enabled: () => enabled() && guard() });
                this.#jobs.set(jobId, owned); this.#active.add(jobId); this.#reserved.delete(jobId);
                const abort = () => owned.requestStop(); signal?.addEventListener("abort", abort, { once: true });
                void owned.start().then(() => this.#persist()).catch(() => {});
                void owned.completion.then(() => {
                    signal?.removeEventListener("abort", abort);
                    this.#active.delete(jobId); this.#trim(); void this.#persist().catch(() => {});
                }); return owned;
            }, enabled);
            return job;
        } catch { return undefined; }
        finally { this.#pending--; this.#reserved.delete(jobId); if (!job) void this.#persist().catch(() => {}); }
    }
    stop(jobId: string): void { if (this.#active.has(jobId)) this.#jobs.get(jobId)?.requestStop(); }
    jobs(): readonly VaultRuntimeSnapshot[] { return Object.freeze([...this.#prior.values(), ...[...this.#jobs.values()].map(job => job.snapshot())]); }
    dispose(): void { if (this.#disposed) return; this.#disposed = true; this.#epoch++; for (const id of this.#active) this.#jobs.get(id)?.requestStop(); void this.#persist().catch(() => {}); }
    async shutdown(): Promise<void> { this.dispose(); await this.#persist(); }
    #allowed(descriptor: VaultAppDescriptor): boolean {
        if (this.#disposed || !this.#ownershipAvailable || !vaultRuntimeEnabled()) return false;
        const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(descriptor.source));
        return !!folder && folder.uri.scheme === "file" && !folder.uri.authority && !folder.uri.query && !folder.uri.fragment && samePath(folder.uri.fsPath, descriptor.root);
    }
    #trim(): void {
        if (this.#jobs.size <= 32) return;
        for (const id of this.#jobs.keys()) { if (!this.#active.has(id)) this.#jobs.delete(id); if (this.#jobs.size <= 32) break; }
    }
    #persist(): Promise<void> {
        const write = this.#writeQueue.then(async () => {
            if (!this.#ownershipAvailable) return unavailable();
            try { recovered(this.#context.workspaceState.get<unknown>(OWNERSHIP, [])); }
            catch { this.#ownershipAvailable = false; return unavailable(); }
            const records: VaultRuntimeSnapshot[] = [...this.#prior.values(), ...[...this.#reserved].map(id => ({ id, state: "READY" as const })),
                ...[...this.#active].map(id => this.#jobs.get(id)!.snapshot())];
            if (records.length > 64) return unavailable(); await this.#context.workspaceState.update(OWNERSHIP, records);
        }); this.#writeQueue = write.catch(() => {}); return write;
    }
}
