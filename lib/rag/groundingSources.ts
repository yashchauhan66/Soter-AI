import type { OrgRole } from "@prisma/client";

export interface StoredGroundingChunk {
  id: string;
  textRedacted: string;
  sourceUrl: string | null;
  allowedRoles: string[];
  document: {
    status: string;
    collection: { organizationId: string; projectId: string };
  };
}

export function roleCanReadChunk(allowedRoles: string[], role: OrgRole) {
  return allowedRoles.length > 0 && allowedRoles.includes(role);
}

export function authorizeGroundingChunks(chunks: StoredGroundingChunk[], context: { organizationId: string; projectId: string; role: OrgRole }) {
  return chunks.map((chunk) => {
    const tenantMatch = chunk.document.collection.organizationId === context.organizationId && chunk.document.collection.projectId === context.projectId;
    const approved = chunk.document.status === "APPROVED" || chunk.document.status === "INDEXED";
    const authorized = tenantMatch && approved && roleCanReadChunk(chunk.allowedRoles, context.role);
    return { id: chunk.id, url: chunk.sourceUrl ?? undefined, text: chunk.textRedacted, authorized };
  });
}
