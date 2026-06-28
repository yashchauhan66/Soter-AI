import { createHash } from "crypto";
import type { VectorChunk, VectorQueryContext, VectorQueryFilters, VectorQueryResult } from "./vector/vectorTypes";

export interface RagAuthorizationMetadata {
  source: string;
  permissionVersion: number;
  permissionsUpdatedAt: string;
  allowedPrincipalIds: string[];
  deniedPrincipalIds: string[];
  allowedGroupIds: string[];
  deniedGroupIds: string[];
}

export type RagAuthorizationReason =
  | "AUTHORIZED"
  | "TENANT_MISMATCH"
  | "DOCUMENT_NOT_ACTIVE"
  | "COLLECTION_NOT_ALLOWED"
  | "DOCUMENT_NOT_ALLOWED"
  | "ROLE_NOT_ALLOWED"
  | "PRINCIPAL_DENIED"
  | "GROUP_DENIED"
  | "PRINCIPAL_NOT_ALLOWED"
  | "SOURCE_NOT_ALLOWED"
  | "SENSITIVITY_NOT_ALLOWED"
  | "PERMISSION_VERSION_TOO_OLD"
  | "PERMISSION_METADATA_MISSING"
  | "PERMISSION_METADATA_STALE";

export interface RagAuthorizationDecision {
  allowed: boolean;
  reason: RagAuthorizationReason;
  matchedBy: "ROLE" | "PRINCIPAL" | "GROUP" | null;
  permissionVersion: number | null;
  permissionsUpdatedAt: string | null;
  authorizationSource: string | null;
}

export function readRagAuthorizationMetadata(metadata: unknown): RagAuthorizationMetadata | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const candidate = (metadata as Record<string, unknown>).authorization;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const record = candidate as Record<string, unknown>;
  const permissionVersion = Number(record.permissionVersion);
  const permissionsUpdatedAt = typeof record.permissionsUpdatedAt === "string" ? record.permissionsUpdatedAt : "";
  if (!Number.isInteger(permissionVersion) || permissionVersion < 1 || !Number.isFinite(new Date(permissionsUpdatedAt).getTime())) return null;
  return {
    source: typeof record.source === "string" && record.source.trim() ? record.source.trim().slice(0, 80) : "UNKNOWN",
    permissionVersion,
    permissionsUpdatedAt: new Date(permissionsUpdatedAt).toISOString(),
    allowedPrincipalIds: stringArray(record.allowedPrincipalIds),
    deniedPrincipalIds: stringArray(record.deniedPrincipalIds),
    allowedGroupIds: stringArray(record.allowedGroupIds),
    deniedGroupIds: stringArray(record.deniedGroupIds),
  };
}

export function withRagAuthorizationMetadata(existing: unknown, input: {
  source?: string;
  permissionVersion?: number;
  allowedPrincipalIds?: string[];
  deniedPrincipalIds?: string[];
  allowedGroupIds?: string[];
  deniedGroupIds?: string[];
  now?: Date;
}) {
  const metadata = existing && typeof existing === "object" && !Array.isArray(existing) ? { ...(existing as Record<string, unknown>) } : {};
  const current = readRagAuthorizationMetadata(existing);
  metadata.authorization = {
    source: input.source?.trim().slice(0, 80) || current?.source || "MANUAL",
    permissionVersion: input.permissionVersion ?? (current?.permissionVersion ?? 0) + 1,
    permissionsUpdatedAt: (input.now ?? new Date()).toISOString(),
    allowedPrincipalIds: normalized(input.allowedPrincipalIds ?? current?.allowedPrincipalIds),
    deniedPrincipalIds: normalized(input.deniedPrincipalIds ?? current?.deniedPrincipalIds),
    allowedGroupIds: normalized(input.allowedGroupIds ?? current?.allowedGroupIds),
    deniedGroupIds: normalized(input.deniedGroupIds ?? current?.deniedGroupIds),
  } satisfies RagAuthorizationMetadata;
  return metadata;
}

export function evaluateRagAuthorization(chunk: VectorChunk | VectorQueryResult, context: VectorQueryContext, filters: VectorQueryFilters = {}): RagAuthorizationDecision {
  const deny = (reason: RagAuthorizationReason, metadata = readRagAuthorizationMetadata(chunk.metadata)): RagAuthorizationDecision => ({
    allowed: false,
    reason,
    matchedBy: null,
    permissionVersion: metadata?.permissionVersion ?? null,
    permissionsUpdatedAt: metadata?.permissionsUpdatedAt ?? null,
    authorizationSource: metadata?.source ?? null,
  });
  if (chunk.organizationId !== context.organizationId || chunk.projectId !== context.projectId) return deny("TENANT_MISMATCH");
  if (chunk.documentStatus !== "APPROVED" && chunk.documentStatus !== "INDEXED") return deny("DOCUMENT_NOT_ACTIVE");
  const collectionId = filters.collectionId ?? context.collectionId;
  if (collectionId && chunk.collectionId !== collectionId) return deny("COLLECTION_NOT_ALLOWED");
  if (context.allowedDocumentIds?.length && !context.allowedDocumentIds.includes(chunk.documentId)) return deny("DOCUMENT_NOT_ALLOWED");
  if (!chunk.allowedRoles?.length || !chunk.allowedRoles.includes(context.role)) return deny("ROLE_NOT_ALLOWED");

  const metadata = readRagAuthorizationMetadata(chunk.metadata);
  const principalId = context.principalId?.trim();
  const groups = new Set(normalized(context.principalGroups));
  if (metadata) {
    if (principalId && metadata.deniedPrincipalIds.includes(principalId)) return deny("PRINCIPAL_DENIED", metadata);
    if (metadata.deniedGroupIds.some((group) => groups.has(group))) return deny("GROUP_DENIED", metadata);
    const hasIdentityAcl = metadata.allowedPrincipalIds.length > 0 || metadata.allowedGroupIds.length > 0;
    const principalAllowed = Boolean(principalId && metadata.allowedPrincipalIds.includes(principalId));
    const groupAllowed = metadata.allowedGroupIds.some((group) => groups.has(group));
    if (hasIdentityAcl && !principalAllowed && !groupAllowed) return deny("PRINCIPAL_NOT_ALLOWED", metadata);
    if (context.minimumPermissionVersion && metadata.permissionVersion < context.minimumPermissionVersion) return deny("PERMISSION_VERSION_TOO_OLD", metadata);
    if (context.maxPermissionAgeMs) {
      const age = (context.authorizationTime?.getTime() ?? Date.now()) - new Date(metadata.permissionsUpdatedAt).getTime();
      if (age > context.maxPermissionAgeMs) return deny("PERMISSION_METADATA_STALE", metadata);
    }
    const sourceFilters = filters.allowedSources ?? context.allowedSources;
    if (sourceFilters?.length && (!chunk.sourceUrl || !sourceFilters.includes(chunk.sourceUrl))) return deny("SOURCE_NOT_ALLOWED", metadata);
    const sensitivity = filters.allowedSensitivityLabels ?? context.allowedSensitivityLabels;
    if (sensitivity?.length && !sensitivity.includes(chunk.sensitivityLabel ?? "INTERNAL")) return deny("SENSITIVITY_NOT_ALLOWED", metadata);
    return {
      allowed: true,
      reason: "AUTHORIZED",
      matchedBy: principalAllowed ? "PRINCIPAL" : groupAllowed ? "GROUP" : "ROLE",
      permissionVersion: metadata.permissionVersion,
      permissionsUpdatedAt: metadata.permissionsUpdatedAt,
      authorizationSource: metadata.source,
    };
  }

  if (context.requireExplicitPrincipalAcl || context.minimumPermissionVersion || context.maxPermissionAgeMs) return deny("PERMISSION_METADATA_MISSING", null);
  const sourceFilters = filters.allowedSources ?? context.allowedSources;
  if (sourceFilters?.length && (!chunk.sourceUrl || !sourceFilters.includes(chunk.sourceUrl))) return deny("SOURCE_NOT_ALLOWED", null);
  const sensitivity = filters.allowedSensitivityLabels ?? context.allowedSensitivityLabels;
  if (sensitivity?.length && !sensitivity.includes(chunk.sensitivityLabel ?? "INTERNAL")) return deny("SENSITIVITY_NOT_ALLOWED", null);
  return { allowed: true, reason: "AUTHORIZED", matchedBy: "ROLE", permissionVersion: null, permissionsUpdatedAt: null, authorizationSource: null };
}

export function createRagAuthorizationReceipt(chunk: VectorChunk | VectorQueryResult, context: VectorQueryContext, filters: VectorQueryFilters = {}) {
  const decision = evaluateRagAuthorization(chunk, context, filters);
  const proof = {
    format: "soter.rag-authorization-receipt.v1",
    chunkId: chunk.id,
    documentId: chunk.documentId,
    projectId: chunk.projectId,
    principalIdHash: context.principalId ? createHash("sha256").update(context.principalId).digest("hex") : null,
    role: context.role,
    decision: decision.allowed ? "ALLOW" : "BLOCK",
    reason: decision.reason,
    matchedBy: decision.matchedBy,
    permissionVersion: decision.permissionVersion,
    permissionsUpdatedAt: decision.permissionsUpdatedAt,
    authorizationSource: decision.authorizationSource,
  };
  return { ...proof, proofHash: createHash("sha256").update(stableStringify(proof)).digest("hex") };
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? normalized(value.filter((item): item is string => typeof item === "string")) : [];
}

function normalized(values: string[] | undefined) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].slice(0, 500);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}
