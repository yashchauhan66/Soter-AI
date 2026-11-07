import { types } from "node:util";

export interface OwnedLifecycleStopDependencies {
    withdraw(): Promise<unknown>;
    snapshots(): Promise<unknown>;
    stopBroker(): Promise<unknown>;
}
type StopResult = Readonly<{ state: "stopped" | "STOP_UNCONFIRMED" }>;
const STOPPED: StopResult = Object.freeze({ state: "stopped" });
const PENDING: StopResult = Object.freeze({ state: "STOP_UNCONFIRMED" });

function record(value: unknown): Record<string, PropertyDescriptor> {
    if (!value || typeof value !== "object" || types.isProxy(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error();
    const fields = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(fields).length > 32 || Reflect.ownKeys(fields).some(key => typeof key !== "string" || !Object.hasOwn(fields[key], "value"))) throw Error();
    return fields;
}
function rows(value: unknown, maximum: number): unknown[] {
    if (!Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum) throw Error();
    const fields = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(fields).length !== value.length + 1) throw Error();
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index++) {
        const field = fields[String(index)]; if (!field || !Object.hasOwn(field, "value")) throw Error(); result.push(field.value);
    }
    return result;
}
function settled(value: unknown): boolean {
    const state = record(value), terminals = rows(state.terminals?.value, 32), vault = record(state.vault?.value);
    for (const terminal of terminals) {
        const row = record(terminal);
        if (row.ownership?.value !== "SAVED" || row.terminals?.value !== 0 || rows(row.recovered?.value, 64).length !== 0) return false;
        if (rows(row.workers?.value, 64).some(worker => !["EXITED", "CANCELLED", "BLOCKED"].includes(record(worker).state?.value))) return false;
    }
    return rows(vault.jobs?.value, 128).every(job => ["EXITED", "STOPPED", "CANCELLED", "BLOCKED"].includes(record(job).state?.value));
}

/** No PID adoption/signalling. Current owners must expose settled closure states.
 * Recovered rows stay unconfirmed; a successful broker stop cannot erase them. */
export async function stopOwnedLifecycle(deps: OwnedLifecycleStopDependencies, ..._ignoredCallerArgs: unknown[]): Promise<StopResult> {
    try {
        await deps.withdraw();
        if (!settled(await deps.snapshots())) return PENDING;
        if (record(await deps.stopBroker()).state?.value !== "stopped") return PENDING;
        return settled(await deps.snapshots()) ? STOPPED : PENDING;
    } catch { return PENDING; }
}
