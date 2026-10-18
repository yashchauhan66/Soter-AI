import { RegisteredSecretMatcher } from "../../../core/src/RegisteredSecretMatcher";
export interface GatewayRegistrationLease {
    available(): boolean;
    use<T>(consume: (values: readonly string[]) => Promise<T>): Promise<T>;
    dispose(): void;
}
export interface GatewayRegistrySource { createGatewayRegistry(enabled: () => boolean): Promise<GatewayRegistrationLease> }
/** Private controller-only capability, never a value-bearing UI/command result. */
export class GatewayRegistryLease implements GatewayRegistrationLease {
    #values: readonly string[];
    #guard: () => boolean;
    #closed = false;
    constructor(values: readonly string[], guard: () => boolean) {
        if (new RegisteredSecretMatcher(values).inspectRequest([]).status !== "CLEAN") throw Error("Gateway registry unavailable");
        this.#values = Object.freeze([...values]);this.#guard = guard;
        if (!this.available()) throw Error("Gateway registry unavailable");
    }
    available(): boolean {
        if (this.#closed) return false;
        try { if (this.#guard() === true) return true; } catch { /* Constant failure, no registry details. */ }
        this.dispose();return false;
    }
    async use<T>(consume: (values: readonly string[]) => Promise<T>): Promise<T> {
        if (!this.available()) throw Error("Gateway registry unavailable");
        const result = await consume(this.#values);
        if (!this.available()) throw Error("Gateway registry unavailable");return result;
    }
    dispose(): void { this.#closed = true;this.#values = [];this.#guard = () => false; }
}
