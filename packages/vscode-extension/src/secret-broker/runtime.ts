import { CapabilityBroker } from "./CapabilityBroker";
import { SecretReferenceManager, type SecretValueStore } from "./SecretReferenceManager";
import { SensitiveContextPolicyEngine, DEFAULT_SENSITIVE_CONTEXT_POLICY } from "./SensitiveContextPolicy";
import { SensitiveContextRedactor } from "./SensitiveContextRedactor";
import { OutputFilter } from "./OutputFilter";
import { EnforcedApiCapabilityBroker } from "./EnforcedApiCapability";

/**
 * Runtime storage stays unavailable until activation recovery completes.
 * SecretStorage encrypts persistent values, but retrieving a
 * value brings plaintext into the extension-host heap. It does not isolate
 * secrets from other code running with that host's authority.
 */
class DelegatingValueStore implements SecretValueStore {
    private target?: SecretValueStore;
    private ready: Promise<void> = Promise.resolve();
    private enabled: () => boolean = () => false;

    setTarget(store: SecretValueStore, ready: Promise<void>, enabled: () => boolean): void {
        this.target = store;
        this.ready = ready;
        this.enabled = enabled;
    }

    isEnabled(): boolean {
        return Boolean(this.target) && this.enabled();
    }

    async get(id: string): Promise<string | undefined> {
        const target = await this.availableTarget();
        return target.get(id);
    }

    async set(id: string, value: string): Promise<void> {
        const target = await this.availableTarget();
        return target.set(id, value);
    }

    async delete(id: string): Promise<void> {
        await this.ready;
        await this.target?.delete(id);
    }

    async clear(): Promise<void> {
        await this.ready;
        await this.target?.clear?.();
    }

    private async availableTarget(): Promise<SecretValueStore> {
        await this.ready;
        if (!this.target || !this.enabled()) throw new Error("Secret reference storage is unavailable while inventory protection is disabled.");
        return this.target;
    }
}

const valueStore = new DelegatingValueStore();
const refs = new SecretReferenceManager(valueStore, { enabled: () => valueStore.isEnabled() });
const policy = new SensitiveContextPolicyEngine(DEFAULT_SENSITIVE_CONTEXT_POLICY);

const outputFilter = new OutputFilter();
let releaseGuard: () => boolean = () => true;
export function setCapabilityReleaseGuard(enabled: () => boolean): void { releaseGuard = enabled; }

export const secretBrokerRuntime = {
    refs,
    policy,
    redactor: new SensitiveContextRedactor(refs, policy),
    broker: new CapabilityBroker(refs, policy),
    outputFilter,
    enforcedApi: new EnforcedApiCapabilityBroker(refs, outputFilter, { releaseGuardEnabled: () => releaseGuard() }),
};

/** Activation recovery runs before a new reference can persist or read values. */
export function setSecretValueStore(store: SecretValueStore, enabled: () => boolean): Promise<void> {
    const ready = store.clear ? store.clear() : Promise.reject(new Error("Secret reference storage requires recovery inventory support."));
    valueStore.setTarget(store, ready, enabled);
    // Recovery may fail before any command is invoked; callers receive the
    // rejection and later storage operations remain closed.
    void ready.catch(() => {});
    return ready;
}
