import { Prisma } from "@prisma/client";
import type { ScannedChunk } from "./scanner";

export const RAG_RESCAN_SECURITY_REVIEW_ROLES = [
  "OWNER",
  "ADMIN",
  "SECURITY_ANALYST",
] as const;

export interface PreviousRagChunkAcl {
  chunkIndex: number;
  allowedRoles?: string[] | null;
  sourceUrl?: string | null;
  sensitivityLabel?: string | null;
  metadata?: unknown;
}

export interface RagRescanChunkRow {
  documentId: string;
  chunkIndex: number;
  textRedacted: string;
  hash: string;
  riskScore: number;
  riskTypes: string[];
  allowedRoles: string[];
  sourceUrl: string | null;
  sensitivityLabel: string;
  metadata: Prisma.InputJsonValue;
}

export function nextRagRescanStatus(
  previousStatus: string,
  quarantine: boolean,
) {
  if (quarantine) return "QUARANTINED";
  if (previousStatus === "APPROVED" || previousStatus === "INDEXED") {
    return previousStatus;
  }
  return "SAFE";
}

export function ragRescanVectorSyncPlan(
  previousStatus: string,
  nextStatus: string,
) {
  const deleteExisting = previousStatus === "INDEXED";
  return {
    deleteExisting,
    reindexFresh: deleteExisting && nextStatus === "INDEXED",
  };
}

function objectMetadata(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function buildRagRescanChunkRows(input: {
  documentId: string;
  previousVersion: number;
  newVersion: number;
  previousChunks: PreviousRagChunkAcl[];
  scannedChunks: ScannedChunk[];
}): RagRescanChunkRow[] {
  const previousAclByIndex = new Map(
    input.previousChunks.map((chunk) => [
      chunk.chunkIndex,
      {
        allowedRoles: chunk.allowedRoles ?? [],
        sourceUrl: chunk.sourceUrl ?? null,
        sensitivityLabel: chunk.sensitivityLabel ?? null,
        metadata: objectMetadata(chunk.metadata),
      },
    ]),
  );

  return input.scannedChunks.map((chunk) => {
    const previousAcl = previousAclByIndex.get(chunk.chunkIndex);
    const previousMetadata = previousAcl?.metadata ?? {};
    const metadata = {
      ...previousMetadata,
      ...chunk.metadata,
      ...(hasOwn(previousMetadata, "authorization")
        ? { authorization: previousMetadata.authorization }
        : {}),
      rescan: {
        previousVersion: input.previousVersion,
        newVersion: input.newVersion,
        aclPreserved: Boolean(previousAcl),
      },
    };

    return {
      documentId: input.documentId,
      chunkIndex: chunk.chunkIndex,
      textRedacted: chunk.textRedacted,
      hash: chunk.hash,
      riskScore: chunk.riskScore,
      riskTypes: chunk.riskTypes,
      allowedRoles: previousAcl?.allowedRoles.length
        ? previousAcl.allowedRoles
        : [...RAG_RESCAN_SECURITY_REVIEW_ROLES],
      sourceUrl: previousAcl?.sourceUrl ?? null,
      sensitivityLabel: previousAcl?.sensitivityLabel ?? "RESTRICTED",
      metadata: metadata as Prisma.InputJsonValue,
    };
  });
}
