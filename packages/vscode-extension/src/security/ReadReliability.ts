/** Process-local bounds for the shared managed reader, not a filesystem sandbox. */
export const READ_RELIABILITY_LIMITS = Object.freeze({ readBytes: 1048576, readMilliseconds: 5000,
    concurrentReads: 8, pathComponents: 64, startupMilliseconds: 1500 });
const unavailable = () => new Error("Managed read unavailable. Review reliability status.");
export interface ReadLease {
    check(): void;
    readonly expired: Promise<never>;
    /** Call only after all opened handles have actually closed. Idempotent. */
    release(): void;
    closureFailed(): void;
}
export class ReadReliability {
    private active = 0;
    private epoch = 0;
    private disposed = false;
    private degraded = false;
    private startupMilliseconds: number | undefined;
    private readonly pending = new Set<() => void>();
    constructor(private readonly dependencies: { enabled(): boolean; now?: () => number }) {}
    private clock(): number { return (this.dependencies.now ?? (() => performance.now()))(); }
    private available(): boolean {
        try { return !this.disposed && !this.degraded && this.dependencies.enabled() === true; } catch { return false; }
    }
    startupClock(): number { return this.clock(); }
    finishStartup(start: number): void {
        const now = this.clock(), elapsed = now - start;
        if (!Number.isFinite(start) || !Number.isFinite(now) || elapsed < 0 || elapsed >= READ_RELIABILITY_LIMITS.startupMilliseconds) {
            this.degraded = true; this.withdraw();
        }
        this.startupMilliseconds = Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : undefined;
    }
    status() {
        return Object.freeze({ status: this.disposed ? "STOPPED" as const : this.degraded ? "DEGRADED" as const
            : !this.available() ? "DISABLED" as const : this.active >= READ_RELIABILITY_LIMITS.concurrentReads ? "BUSY" as const : "READY" as const,
        activeReads: this.active, startupMilliseconds: this.startupMilliseconds, limits: READ_RELIABILITY_LIMITS });
    }
    withdraw(): void { this.epoch++; for (const cancel of [...this.pending]) cancel(); }
    dispose(): void { this.disposed = true; this.withdraw(); }
    begin(signal?: AbortSignal): ReadLease {
        if (!this.available() || signal?.aborted || this.active >= READ_RELIABILITY_LIMITS.concurrentReads) throw unavailable();
        const start = this.clock(), epoch = this.epoch;
        if (!Number.isFinite(start)) throw unavailable();
        let last = start, cancelled = false, released = false, reject!: (error: Error) => void;
        const expired = new Promise<never>((_resolve, rejectPromise) => { reject = rejectPromise; });
        const cancel = () => { if (!cancelled && !released) { cancelled = true; reject(unavailable()); } };
        this.active++; this.pending.add(cancel); signal?.addEventListener("abort", cancel, { once: true });
        const timer = setTimeout(cancel, READ_RELIABILITY_LIMITS.readMilliseconds); timer.unref?.();
        if (signal?.aborted) cancel();
        return Object.freeze({ expired,
            check: () => {
                let now: number;
                try { now = this.clock(); } catch { cancel(); throw unavailable(); }
                if (released || cancelled || signal?.aborted || !this.available() || this.epoch !== epoch
                    || !Number.isFinite(now) || now < last || now < start || now - start >= READ_RELIABILITY_LIMITS.readMilliseconds) {
                    cancel(); throw unavailable();
                }
                last = now;
            },
            release: () => {
                if (released) return; released = true; clearTimeout(timer); signal?.removeEventListener("abort", cancel);
                this.pending.delete(cancel); this.active--;
            },
            closureFailed: () => { this.degraded = true; this.withdraw(); },
        });
    }
}
// Host-free callers retain the same checked bounded reader. VS Code installs its
// owner before registering consumers and leaves it stopped on deactivation.
let owner = new ReadReliability({ enabled: () => true });
export function installReadReliabilityOwner(value: ReadReliability): void { owner.withdraw(); owner = value; }
export function acquireBoundaryRead(signal?: AbortSignal): ReadLease { return owner.begin(signal); }
