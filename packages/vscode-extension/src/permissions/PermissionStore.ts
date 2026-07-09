import * as vscode from "vscode";

export interface PermissionEntry {
    id: string;
    timestamp: number;
    type: "file_access" | "protected_file" | "terminal_command" | "mcp_tool" | "broker_request" | "memory_write" | "dependency_install" | "network_egress";
    target: string;
    scope: "once" | "session" | "workspace";
    outcome: "pending" | "allow" | "deny" | "redact_and_allow";
    contentHash: string;
    expiresAt?: number;
}

const APPROVALS_KEY = "soterai.permissionApprovals";

export class PermissionStore implements vscode.Disposable {
    private approvals: PermissionEntry[] = [];

    constructor(private readonly context: vscode.ExtensionContext) {
        const stored = context.globalState.get<PermissionEntry[]>(APPROVALS_KEY);
        if (stored) this.approvals = stored;
    }

    /**
     * Check for an existing approval. If none exists, create a "pending" entry
     * so it surfaces in getPending() for review. Returns the existing or newly
     * created entry.
     */
    request(type: PermissionEntry["type"], target: string, contentHash: string): PermissionEntry {
        const existing = this.approvals.find(
            (a) =>
                a.type === type &&
                a.target === target &&
                a.contentHash === contentHash &&
                a.outcome !== "pending" &&
                (!a.expiresAt || a.expiresAt > Date.now()),
        );
        if (existing) return existing;

        const pending: PermissionEntry = {
            id: `perm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
            type,
            target,
            scope: "once",
            outcome: "pending",
            contentHash,
        };
        this.approvals.push(pending);
        void this.persist();
        return pending;
    }

    async approve(type: PermissionEntry["type"], target: string, contentHash: string, scope: PermissionEntry["scope"]): Promise<PermissionEntry> {
        // Update existing pending entry in-place to avoid duplicates.
        const existing = this.approvals.find(
            (a) => a.type === type && a.target === target && a.contentHash === contentHash && a.outcome === "pending",
        );
        if (existing) {
            existing.outcome = "allow";
            existing.scope = scope;
            existing.timestamp = Date.now();
            existing.expiresAt = scope === "once" ? Date.now() + 60_000 : scope === "session" ? Date.now() + 3600_000 : undefined;
            await this.persist();
            return existing;
        }
        const entry: PermissionEntry = {
            id: `perm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
            type,
            target,
            scope,
            outcome: "allow",
            contentHash,
            expiresAt: scope === "once" ? Date.now() + 60_000 : scope === "session" ? Date.now() + 3600_000 : undefined,
        };
        this.approvals.push(entry);
        await this.persist();
        return entry;
    }

    async deny(type: PermissionEntry["type"], target: string, contentHash: string): Promise<PermissionEntry> {
        const existing = this.approvals.find(
            (a) => a.type === type && a.target === target && a.contentHash === contentHash && a.outcome === "pending",
        );
        if (existing) {
            existing.outcome = "deny";
            existing.scope = "once";
            existing.timestamp = Date.now();
            await this.persist();
            return existing;
        }
        const entry: PermissionEntry = {
            id: `perm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
            type,
            target,
            scope: "once",
            outcome: "deny",
            contentHash,
        };
        this.approvals.push(entry);
        await this.persist();
        return entry;
    }

    async redactApprove(type: PermissionEntry["type"], target: string, contentHash: string): Promise<PermissionEntry> {
        const existing = this.approvals.find(
            (a) => a.type === type && a.target === target && a.contentHash === contentHash && a.outcome === "pending",
        );
        if (existing) {
            existing.outcome = "redact_and_allow";
            existing.scope = "once";
            existing.timestamp = Date.now();
            await this.persist();
            return existing;
        }
        const entry: PermissionEntry = {
            id: `perm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
            type,
            target,
            scope: "once",
            outcome: "redact_and_allow",
            contentHash,
        };
        this.approvals.push(entry);
        await this.persist();
        return entry;
    }

    getPending(): PermissionEntry[] {
        return this.approvals.filter((a) => a.outcome === "pending" && (!a.expiresAt || a.expiresAt > Date.now()));
    }

    /** Entries that are active approvals (allow or redact_and_allow) and not expired. */
    getActive(): PermissionEntry[] {
        return this.approvals.filter(
            (a) => (a.outcome === "allow" || a.outcome === "redact_and_allow") && (!a.expiresAt || a.expiresAt > Date.now()),
        );
    }

    getAll(): ReadonlyArray<PermissionEntry> { return this.approvals; }

    async clear(): Promise<void> {
        this.approvals = [];
        await this.persist();
    }

    private async persist(): Promise<void> {
        await this.context.globalState.update(APPROVALS_KEY, this.approvals);
    }

    dispose(): void { /* state persisted */ }
}
