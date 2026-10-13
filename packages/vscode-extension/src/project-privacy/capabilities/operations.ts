import type { CapabilityAction, PublicOperation, PublicOutputClass } from "./contracts";

export interface FixedPublicOperation {
    readonly operation: PublicOperation;
    readonly action: CapabilityAction;
    readonly outputClass: PublicOutputClass;
    readonly maximumOutputBytes: number;
}

/** No shell, arbitrary SQL, URL proxy, secret reveal or credential injection. */
export const FIXED_PUBLIC_OPERATIONS: Readonly<Record<PublicOperation, FixedPublicOperation>> = Object.freeze({
    "project.schema.read": Object.freeze({ operation: "project.schema.read", action: "READ_PUBLIC_SCHEMA",
        outputClass: "PUBLIC_SCHEMA", maximumOutputBytes: 16_384 }),
    "project.contract.read": Object.freeze({ operation: "project.contract.read", action: "READ_PUBLIC_CONTRACT",
        outputClass: "PUBLIC_CONTRACT", maximumOutputBytes: 32_768 }),
    "development.synthetic.check": Object.freeze({ operation: "development.synthetic.check", action: "CHECK_SYNTHETIC_RUNTIME",
        outputClass: "SYNTHETIC_STATUS", maximumOutputBytes: 4_096 }),
});

export const MAX_CAPABILITY_DURATION_MS = 60_000;

export function fixedPublicOperation(name: unknown): FixedPublicOperation | undefined {
    return typeof name === "string" && Object.hasOwn(FIXED_PUBLIC_OPERATIONS, name)
        ? FIXED_PUBLIC_OPERATIONS[name as PublicOperation] : undefined;
}
