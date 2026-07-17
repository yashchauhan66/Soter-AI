import { CapabilityBroker } from "./CapabilityBroker";
import { SecretReferenceManager, MemorySecretValueStore, type SecretValueStore } from "./SecretReferenceManager";
import { SensitiveContextPolicyEngine, DEFAULT_SENSITIVE_CONTEXT_POLICY } from "./SensitiveContextPolicy";
import { SensitiveContextRedactor } from "./SensitiveContextRedactor";
import { OutputFilter } from "./OutputFilter";
import { EnforcedApiCapabilityBroker } from "./EnforcedApiCapability";

/**
 * Delegating store so the runtime can start with a memory store (unit tests,
 * pre-activation) and be re-pointed at VS Code SecretStorage during
 * activation. Raw secret values then live in the OS keychain, not the
 * extension-host heap, for their TTL.
 */
class DelegatingValueStore implements SecretValueStore {
    private target: SecretValueStore = new MemorySecretValueStore();

    setTarget(store: SecretValueStore): void {
        this.target = store;
    }

    get(id: string): Promise<string | undefined> {
        return this.target.get(id);
    }

    set(id: string, value: string): Promise<void> {
        return this.target.set(id, value);
    }

    delete(id: string): Promise<void> {
        return this.target.delete(id);
    }

    async clear(): Promise<void> {
        await this.target.clear?.();
    }
}

const valueStore = new DelegatingValueStore();
const refs = new SecretReferenceManager(valueStore);
const policy = new SensitiveContextPolicyEngine(DEFAULT_SENSITIVE_CONTEXT_POLICY);

const outputFilter = new OutputFilter();

export const secretBrokerRuntime = {
    refs,
    policy,
    redactor: new SensitiveContextRedactor(refs, policy),
    broker: new CapabilityBroker(refs, policy),
    outputFilter,
    enforcedApi: new EnforcedApiCapabilityBroker(refs, outputFilter),
};

/** Called once at activation to back secret values with VS Code SecretStorage. */
export function useSecretValueStore(store: SecretValueStore): void {
    valueStore.setTarget(store);
}
