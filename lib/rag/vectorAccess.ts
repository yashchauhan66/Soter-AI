export interface VectorChunk {
  id: string;
  organizationId: string;
  projectId: string;
  documentId: string;
  documentStatus: "APPROVED" | "INDEXED" | string;
  textRedacted: string;
  allowedRoles?: string[];
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface VectorQueryContext {
  organizationId: string;
  projectId: string;
  role: string;
  allowedDocumentIds?: string[];
  allowedSources?: string[];
}

export { createVectorNamespace as createNamespace } from "./vector/vectorProvider";
import { createVectorNamespace } from "./vector/vectorProvider";

export function enforceTenantNamespace(namespace: string, context: Pick<VectorQueryContext, "organizationId" | "projectId">) {
  if (namespace !== createVectorNamespace(context.organizationId, context.projectId)) throw new Error("Vector namespace tenant boundary violation.");
  return true;
}

export function filterByRole(chunks: VectorChunk[], role: string) { return chunks.filter((chunk) => !chunk.allowedRoles?.length || chunk.allowedRoles.includes(role)); }
export function filterByDocumentStatus(chunks: VectorChunk[]) { return chunks.filter((chunk) => chunk.documentStatus === "APPROVED" || chunk.documentStatus === "INDEXED"); }
export function filterByAllowedSources(chunks: VectorChunk[], sources?: string[]) { return !sources?.length ? chunks : chunks.filter((chunk) => chunk.sourceUrl && sources.includes(chunk.sourceUrl)); }

export function retrievalPostFilter(chunks: VectorChunk[], context: VectorQueryContext) {
  const tenantScoped = chunks.filter((chunk) => chunk.organizationId === context.organizationId && chunk.projectId === context.projectId);
  const documentScoped = context.allowedDocumentIds?.length ? tenantScoped.filter((chunk) => context.allowedDocumentIds!.includes(chunk.documentId)) : tenantScoped;
  return filterByAllowedSources(filterByDocumentStatus(filterByRole(documentScoped, context.role)), context.allowedSources);
}

export interface VectorAccessAdapter {
  createNamespace(organizationId: string, projectId: string): Promise<string>;
  indexChunk(namespace: string, chunk: VectorChunk): Promise<void>;
  queryNamespace(namespace: string, query: string, context: VectorQueryContext, filters?: Record<string, unknown>): Promise<VectorChunk[]>;
}

export class InMemoryVectorAccess implements VectorAccessAdapter {
  private readonly namespaces = new Map<string, VectorChunk[]>();
  async createNamespace(organizationId: string, projectId: string) { const namespace = createVectorNamespace(organizationId, projectId); this.namespaces.set(namespace, this.namespaces.get(namespace) ?? []); return namespace; }
  async indexChunk(namespace: string, chunk: VectorChunk) { enforceTenantNamespace(namespace, chunk); this.namespaces.set(namespace, [...(this.namespaces.get(namespace) ?? []), chunk]); }
  async queryNamespace(namespace: string, _query: string, context: VectorQueryContext, _filters?: Record<string, unknown>) { enforceTenantNamespace(namespace, context); return retrievalPostFilter(this.namespaces.get(namespace) ?? [], context); }
}
