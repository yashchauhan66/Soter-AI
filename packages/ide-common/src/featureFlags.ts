import {
    GuardFeature,
    type GuardFeatureKey,
    type AdapterCapability,
    type FeatureSupport,
} from "@soterai/ide-protocol";

/**
 * A declared capability set for one adapter. Feeds honest capability reporting
 * and the feature-parity matrix — it does NOT gate detector behaviour (that is
 * the broker's job). Adapters declare only what their host UI can actually do.
 */
export class AdapterProfile {
    private readonly map = new Map<GuardFeatureKey, AdapterCapability>();

    constructor(readonly adapterId: string, capabilities: AdapterCapability[] = []) {
        for (const capability of capabilities) this.map.set(capability.feature, capability);
    }

    declare(feature: GuardFeatureKey, support: FeatureSupport, note?: string): this {
        this.map.set(feature, { feature, support, note });
        return this;
    }

    /** True only when the feature is fully supported or broker-backed. */
    isUsable(feature: GuardFeatureKey): boolean {
        const capability = this.map.get(feature);
        if (!capability) return false;
        return capability.support === "supported" || capability.support === "needs-broker";
    }

    support(feature: GuardFeatureKey): FeatureSupport {
        return this.map.get(feature)?.support ?? "not-possible";
    }

    capabilities(): AdapterCapability[] {
        return [...this.map.values()];
    }
}

/**
 * The baseline capability set achievable by any adapter that can shell out and
 * talk to the loopback broker (covers the interpreted-editor adapters). Rich
 * hosts extend this with UI-only features (ledger panels, inspectors).
 */
export function brokerBackedProfile(adapterId: string): AdapterProfile {
    return new AdapterProfile(adapterId, [
        { feature: GuardFeature.ScanSelection, support: "needs-broker" },
        { feature: GuardFeature.RedactSelection, support: "needs-broker" },
        { feature: GuardFeature.ScanCurrentFile, support: "needs-broker" },
        { feature: GuardFeature.ScanGitChanges, support: "needs-broker" },
        { feature: GuardFeature.SafePromptBuilder, support: "needs-broker" },
        { feature: GuardFeature.SafeMode, support: "needs-broker" },
        { feature: GuardFeature.BrokerStatus, support: "supported" },
        { feature: GuardFeature.MemoryInspector, support: "needs-broker" },
        { feature: GuardFeature.WhatAiSawLedger, support: "needs-broker" },
    ]);
}
