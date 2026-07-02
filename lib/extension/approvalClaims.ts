export type ApprovalResolution = "approved" | "rejected" | "redaction_required";

export interface ApprovalClaimMetadata {
  employeeId?: string;
  deviceId?: string;
  organizationId?: string;
  url?: string;
  redactedPreview?: string;
  resolved?: boolean;
  resolution?: ApprovalResolution;
  duration?: "once" | "24h" | "destination";
  expiresAt?: string | null;
  claimedAt?: string;
  claimedByEmployeeId?: string;
  claimedByDeviceId?: string;
}

export interface ApprovalClaimInput {
  metadata: ApprovalClaimMetadata;
  employeeId?: string;
  deviceId?: string;
  organizationId: string;
  destination: string;
  now?: Date;
}

function hostname(value: string) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return value.toLowerCase();
  }
}

export function evaluateApprovalClaim(input: ApprovalClaimInput) {
  const now = input.now ?? new Date();
  const metadata = input.metadata;
  if (metadata.organizationId && metadata.organizationId !== input.organizationId) return { allowed: false, status: "wrong_scope" as const };
  if (metadata.employeeId && input.employeeId && metadata.employeeId !== input.employeeId) return { allowed: false, status: "wrong_employee" as const };
  if (metadata.deviceId && input.deviceId && metadata.deviceId !== input.deviceId) return { allowed: false, status: "wrong_device" as const };
  if (!metadata.resolved) return { allowed: false, status: "pending" as const };
  if (metadata.resolution === "rejected") return { allowed: false, status: "rejected" as const };
  if (metadata.resolution === "redaction_required") {
    return { allowed: true, status: "redaction_required" as const, redactedPrompt: metadata.redactedPreview ?? "" };
  }
  if (metadata.resolution !== "approved") return { allowed: false, status: "pending" as const };
  if (metadata.expiresAt && new Date(metadata.expiresAt).getTime() <= now.getTime()) return { allowed: false, status: "expired" as const };
  if (metadata.duration === "destination" && metadata.url && hostname(metadata.url) !== hostname(input.destination)) {
    return { allowed: false, status: "wrong_destination" as const };
  }
  if ((metadata.duration ?? "once") === "once" && metadata.claimedAt) return { allowed: false, status: "already_claimed" as const };
  return { allowed: true, status: "approved" as const };
}

export function claimedApprovalMetadata(metadata: ApprovalClaimMetadata, input: ApprovalClaimInput, now = new Date()) {
  return {
    ...metadata,
    claimedAt: now.toISOString(),
    claimedByEmployeeId: input.employeeId ?? null,
    claimedByDeviceId: input.deviceId ?? null,
    claimedDestination: input.destination,
  };
}
