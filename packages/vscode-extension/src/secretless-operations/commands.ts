import * as vscode from "vscode";
import { createHash, randomUUID } from "node:crypto";
import { SecretlessOperationBroker, parseOperationBinding, type OperationBinding, type SecretlessOperationResult } from "../../../core/src/SecretlessOperationBroker";
import { VaultTokenLeaseProvider, parseVaultOperationConfiguration, type VaultHttpTransport, type VaultOperationConfiguration } from "./VaultTokenLeaseProvider";

const CONFIG = "soterai.lite.secretlessVaultOperation.v1", BOOTSTRAP = "soterai.lite.secretlessVaultBootstrap.v1";
const TOKEN = /^[A-Za-z0-9._~+/-]{16,4096}={0,2}$/;
const withheld = (): SecretlessOperationResult => Object.freeze({ status: "WITHHELD" });
export interface TrustedOperationBridge extends vscode.Disposable {
    list(): ReadonlyArray<Readonly<{ id: string; label: string }>>;
    policyDigest(): string;
    executeApproved(id: string, binding: OperationBinding, signal?: AbortSignal): Promise<SecretlessOperationResult>;
}
/** Test-only trusted transport seam. No command can supply this dependency. */
export interface SecretlessOperationDependencies { readonly transport?: VaultHttpTransport }

/** Native configuration stores only public metadata in globalState. The issuer
 * bootstrap lives in SecretStorage; neither command arguments nor guest IPC
 * can configure credentials, issue tokens, approve grants or choose URLs. */
export function registerSecretlessOperationCommands(context: vscode.ExtensionContext, refresh: () => void,
    dependencies: SecretlessOperationDependencies = {}): TrustedOperationBridge {
    let disposed = false, busy = false, epoch = 0;
    const active = new Set<AbortController>(), subscriptions: vscode.Disposable[] = [];
    const available = () => !disposed && vscode.workspace.isTrusted && !vscode.env.remoteName;
    const configuration = (): VaultOperationConfiguration | undefined => {
        try { return parseVaultOperationConfiguration(context.globalState.get<unknown>(CONFIG)); } catch { return; }
    };
    const encoded = () => JSON.stringify(configuration() ?? null);
    const invalidate = () => { epoch++; for (const controller of active) controller.abort(); };
    const bridge: TrustedOperationBridge = {
        list() { const config = available() ? configuration() : undefined; return Object.freeze(config ? [Object.freeze({ id: config.operation.id, label: config.operation.label })] : []); },
        policyDigest() { return createHash("sha256").update(JSON.stringify({ available: available(), configuration: configuration() ?? null })).digest("hex"); },
        async executeApproved(id, input, signal) {
            const config = available() ? configuration() : undefined, binding = parseOperationBinding(input);
            if (!config || !binding || id !== config.operation.id || signal?.aborted || busy || active.size >= 4) return withheld();
            const controller = new AbortController(), snapshot = JSON.stringify(config), issuedEpoch = epoch;
            const abort = () => controller.abort(); signal?.addEventListener("abort", abort, { once: true });
            if (signal?.aborted) controller.abort(); active.add(controller);
            const current = () => available() && epoch === issuedEpoch && !controller.signal.aborted && encoded() === snapshot;
            const provider = new VaultTokenLeaseProvider({ configuration: config, enabled: current, transport: dependencies.transport,
                getBootstrapToken: async () => { if (!current()) return; const token = await context.secrets.get(BOOTSTRAP); return current() ? token : undefined; } });
            const broker = new SecretlessOperationBroker({ operations: [config.operation], credentialProvider: provider,
                transport: provider.readTransport(), isCurrent: selected => current() && JSON.stringify(selected) === JSON.stringify(binding) });
            try {
                // Missing bootstrap custody is unavailable before native approval;
                // no issuer request is made while checking local configuration.
                const present = await context.secrets.get(BOOTSTRAP);
                if (typeof present !== "string" || !TOKEN.test(present) || !current()) return withheld();
                const review = broker.prepareReview(id, binding); if (!review) return withheld();
                const choice = await vscode.window.showWarningMessage("Approve this one-use Vault read?", { modal: true, detail: JSON.stringify({
                    method: "GET", url: config.operation.url, account: config.operation.account, resource: config.operation.resource,
                    responseFields: config.operation.responseFields, tokenRole: config.role, expectedPolicies: config.expectedPolicies,
                    tokenMaximumSeconds: config.ttlSeconds, tokenUses: 1, binding: review.binding, approvalExpiresAt: review.expiresAt,
                    scope: "The host issues a short-lived token for this read. The agent receives only checked allowed fields. Server ACL and role configuration remain trusted." }, null, 2) }, "Approve one read");
                if (choice !== "Approve one read" || !current()) return withheld();
                const grant = broker.approve(review); if (!grant) return withheld();
                return await broker.execute(grant.id, binding, controller.signal);
            } catch { return withheld(); }
            finally { broker.dispose(); controller.abort(); signal?.removeEventListener("abort", abort); active.delete(controller); }
        },
        dispose() { if (disposed) return; disposed = true; invalidate(); subscriptions.forEach(subscription => subscription.dispose()); },
    };
    const reg = (id: string, run: () => Promise<unknown> | unknown) => {
        subscriptions.push(vscode.commands.registerCommand(id, (...args: unknown[]) => args.length ? { status: "UNAVAILABLE" } : run()));
    };
    const input = async (title: string, prompt: string, value = "", password = false) => vscode.window.showInputBox({ title, prompt, value, password, ignoreFocusOut: true });
    reg("soterai.configureSecretlessVaultOperation", async () => {
        if (!available() || busy) return { status: "UNAVAILABLE" }; busy = true;
        try {
            const previous = configuration(), before = encoded(), beforeEpoch = epoch;
            const origin = await input("Vault HTTPS origin", "Use the exact trusted Vault origin, without a path or query.", previous?.origin ?? "https://vault.example.com"); if (origin === undefined) return { status: "CANCELLED" };
            const role = await input("Vault token role", "The server role must allow only the reviewed read policy and short-lived one-use service tokens.", previous?.role ?? "soterai-read"); if (role === undefined) return { status: "CANCELLED" };
            const policyText = await input("Expected Vault policies", "Comma-separated exact effective policy names returned by token creation, including default if present.", previous?.expectedPolicies.join(",") ?? "default,soterai-status-read"); if (policyText === undefined) return { status: "CANCELLED" };
            const readPath = await input("Exact Vault GET path", "One /v1/ path without query parameters. Health/status scalar fields are supported; nested KV responses are not.", previous?.operation.resource ?? "/v1/sys/health"); if (readPath === undefined) return { status: "CANCELLED" };
            const fieldText = await input("Allowed response fields", "Comma-separated top-level scalar fields. All others are omitted; known secrets withhold the response.", previous?.operation.responseFields.join(",") ?? "initialized,sealed,standby"); if (fieldText === undefined) return { status: "CANCELLED" };
            const ttl = await input("Maximum issued-token lifetime", "Seconds from 10 to 120. This is enforced in the token request and checked against the issuer response.", String(previous?.ttlSeconds ?? 60)); if (ttl === undefined) return { status: "CANCELLED" };
            const config = parseVaultOperationConfiguration({ schemaVersion: 1, origin, role, expectedPolicies: policyText.split(",").map(value => value.trim()), ttlSeconds: /^\d{1,3}$/.test(ttl) ? Number(ttl) : 0,
                operation: { id: previous?.operation.id ?? "vault-read-" + randomUUID(), label: "Read approved Vault status", account: new URL(origin).hostname,
                    resource: readPath, url: origin + readPath, responseFields: fieldText.split(",").map(value => value.trim()) } });
            if (!config || !available() || epoch !== beforeEpoch || encoded() !== before) return { status: "UNAVAILABLE" };
            const token = await input("Vault issuer bootstrap token", "Stored only in VS Code SecretStorage. It must be allowed to create tokens for the configured role; it is never sent to the agent.", "", true);
            if (token === undefined) return { status: "CANCELLED" };
            if (!TOKEN.test(token) || !available() || epoch !== beforeEpoch || encoded() !== before) return { status: "UNAVAILABLE" };
            const confirmed = await vscode.window.showWarningMessage("Save this optional Vault operation?", { modal: true,
                detail: JSON.stringify({ origin: config.origin, role: config.role, expectedPolicies: config.expectedPolicies, ttlSeconds: config.ttlSeconds,
                    method: "GET", resource: config.operation.resource, responseFields: config.operation.responseFields,
                    scope: "No Vault connection is tested now. Each use asks for approval. The server role/ACL must enforce the expected policies and token lifetime." }, null, 2) }, "Save Vault operation");
            if (confirmed !== "Save Vault operation") return { status: "CANCELLED" };
            if (!available() || epoch !== beforeEpoch || encoded() !== before) return { status: "UNAVAILABLE" };
            const priorToken = await context.secrets.get(BOOTSTRAP); if (!available() || epoch !== beforeEpoch || encoded() !== before) return { status: "UNAVAILABLE" };
            invalidate();
            try {
                await context.secrets.store(BOOTSTRAP, token); await context.globalState.update(CONFIG, config);
                if (encoded() !== JSON.stringify(config) || await context.secrets.get(BOOTSTRAP) !== token) throw Error();
            } catch {
                // Restore only the exact value this attempt wrote, retaining an
                // intervening owner/extension update instead of overwriting it.
                if (await context.secrets.get(BOOTSTRAP) === token && (encoded() === before || encoded() === JSON.stringify(config))) {
                    if (priorToken === undefined) await context.secrets.delete(BOOTSTRAP); else await context.secrets.store(BOOTSTRAP, priorToken);
                    await context.globalState.update(CONFIG, previous);
                }
                return { status: "UNAVAILABLE" };
            }
            refresh(); return { status: "CONFIGURED_UNVERIFIED", operationId: config.operation.id };
        } catch { return { status: "UNAVAILABLE" }; }
        finally { busy = false; }
    });
    reg("soterai.removeSecretlessVaultOperation", async () => {
        if (!available() || busy) return { status: "UNAVAILABLE" }; busy = true;
        try {
            const config = configuration(); if (!config) return { status: "UNAVAILABLE" }; const before = JSON.stringify(config), beforeEpoch = epoch;
            const choice = await vscode.window.showWarningMessage("Remove this Vault operation and its stored bootstrap token?", { modal: true, detail: config.origin + "\n" + config.operation.resource }, "Remove Vault operation");
            if (choice !== "Remove Vault operation") return { status: "CANCELLED" };
            if (!available() || epoch !== beforeEpoch || encoded() !== before) return { status: "UNAVAILABLE" };
            invalidate(); await context.secrets.delete(BOOTSTRAP); await context.globalState.update(CONFIG, undefined); refresh(); return { status: "REMOVED" };
        } catch { return { status: "UNAVAILABLE" }; }
        finally { busy = false; }
    });
    reg("soterai.secretlessOperationStatus", () => ({ configured: bridge.list().length === 1, operations: bridge.list(), verification: "OWNER_CONFIGURATION_ONLY" }));
    subscriptions.push(context.secrets.onDidChange(event => { if (event.key === BOOTSTRAP) invalidate(); }),
        vscode.workspace.onDidChangeWorkspaceFolders(invalidate), vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration("soterai")) invalidate(); }));
    context.subscriptions.push(bridge); return bridge;
}
