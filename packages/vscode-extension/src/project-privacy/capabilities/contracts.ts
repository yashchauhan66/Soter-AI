/**
 * Local decision contracts only. The configured adapter is part of the trusted
 * computing base; implementing this interface does not authenticate a process.
 * No adapter, signing authority, durable ledger or OS enforcement is supplied.
 */
export type PublicOperation = "project.schema.read" | "project.contract.read" | "development.synthetic.check";
export type CapabilityAction = "READ_PUBLIC_SCHEMA" | "READ_PUBLIC_CONTRACT" | "CHECK_SYNTHETIC_RUNTIME";
export type PublicOutputClass = "PUBLIC_SCHEMA" | "PUBLIC_CONTRACT" | "SYNTHETIC_STATUS";

export interface WorkloadIdentity {
    readonly principalId: string;
    readonly workloadId: string;
    readonly launchId: string;
    readonly sessionId: string;
}

export interface CapabilityBinding {
    readonly recipient: WorkloadIdentity;
    readonly projectId: string;
    readonly itemId: string;
    readonly contentRevision: string;
    readonly policyRevision: string;
    readonly operation: PublicOperation;
    readonly action: CapabilityAction;
    readonly outputClass: PublicOutputClass;
    /** An authority-owned route identifier, never a caller-selected URL. */
    readonly destinationId: string;
}

export interface VerifiedTransportContext {
    readonly status: "VERIFIED";
    readonly verification: "INDEPENDENT_TRANSPORT";
    readonly authorityId: string;
    readonly identity: WorkloadIdentity;
    /** Must use the controller's monotonic clock domain. */
    readonly validUntil: number;
}

export type TransportAuthentication = VerifiedTransportContext | { readonly status: "UNVERIFIED" };

export interface AuthoritativeItemState {
    readonly projectId: string;
    readonly itemId: string;
    readonly contentRevision: string;
    readonly policyRevision: string;
    readonly classification: PublicOutputClass | "PROTECTED" | "UNKNOWN";
}

export interface CapabilityReview {
    readonly binding: CapabilityBinding;
    readonly durationMs: number;
    readonly maximumUses: 1;
}

export type IndependentApproval = {
    readonly status: "APPROVED";
    readonly approvalId: string;
    readonly presence: "INDEPENDENT_USER_PRESENCE";
    readonly reviewedBinding: CapabilityBinding;
    readonly durationMs: number;
    /** Times use the controller's monotonic clock domain. */
    readonly reviewedAt: number;
    readonly validUntil: number;
} | { readonly status: "DENIED" };

/**
 * Future protected transport/controller integration must implement these checks
 * independently of agent authority. Caller identity strings are never evidence.
 * In particular, consumeApproval must validate authoritative user review and
 * must reject replay; the protocol adds a second, process-local replay check.
 */
export interface IndependentCapabilityAuthority {
    readonly authorityId: string;
    available(): boolean;
    authenticateTransport(connection: unknown): TransportAuthentication;
    resolveItem(projectId: string, itemId: string): AuthoritativeItemState | undefined;
    destinationAllowed(identity: WorkloadIdentity, destinationId: string): boolean;
    consumeApproval(approvalReference: string, review: CapabilityReview): IndependentApproval;
    approvalActive(approvalId: string): boolean;
}

export type CapabilityDenial =
    | "DISABLED" | "DISPOSED" | "INVALID_CLOCK" | "AUTHORITY_UNAVAILABLE"
    | "IDENTITY_UNVERIFIED" | "WRONG_RECIPIENT" | "INVALID_REQUEST"
    | "UNSUPPORTED_OPERATION" | "OUTPUT_CLASS_MISMATCH" | "ITEM_NOT_PUBLIC"
    | "REVISION_CHANGED" | "DESTINATION_DENIED" | "APPROVAL_DENIED"
    | "APPROVAL_MISMATCH" | "APPROVAL_REPLAY" | "UNKNOWN_GRANT"
    | "GRANT_MISMATCH" | "EXPIRED" | "REPLAY" | "REVOKED" | "CAPACITY_REACHED";

export type CapabilityDenied = { readonly status: "DENIED"; readonly reason: CapabilityDenial };
export type CapabilityIssued = {
    readonly status: "ISSUED";
    /** Opaque process-local lookup reference, not a signed or portable token. */
    readonly grantReference: string;
    readonly binding: CapabilityBinding;
    readonly validUntil: number;
    readonly maximumUses: 1;
};
export type CapabilityAllowed = {
    readonly status: "ALLOWED_ONCE";
    readonly binding: CapabilityBinding;
    /** Descriptor for a future reviewed dispatcher; this core executes nothing. */
    readonly maximumOutputBytes: number;
};

export interface CapabilityProtocolOptions {
    readonly authority?: IndependentCapabilityAuthority;
    /** Missing flag means disabled. Enabling does not create an authority. */
    readonly enabled?: () => boolean;
    readonly now?: () => number;
    /** Finite lifetime ledger; full capacity fails closed until a new controller. */
    readonly maximumRecords?: number;
}
