import { createHash } from "crypto";
import { db } from "../../db";
import type { VectorChunk, VectorHealth, VectorNamespaceContext, VectorQueryContext, VectorQueryFilters, VectorQueryResult } from "./vectorTypes";

export interface VectorProvider {
  createNamespace(context: VectorNamespaceContext): Promise<string>;
  deleteNamespace(context: VectorNamespaceContext): Promise<void>;
  indexChunks(chunks: VectorChunk[]): Promise<void>;
  query(queryText: string, context: VectorQueryContext, filters?: VectorQueryFilters): Promise<VectorQueryResult[]>;
  deleteDocument(documentId: string, context: VectorNamespaceContext): Promise<void>;
  healthCheck(): Promise<VectorHealth>;
}

export function createVectorNamespace(organizationId: string, projectId: string) {
  if (!organizationId || !projectId) throw new Error("Organization and project are required for a vector namespace.");
  const safe = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `org_${safe(organizationId)}__project_${safe(projectId)}`;
}

export function enforceVectorNamespace(namespace: string, context: VectorNamespaceContext) {
  if (namespace !== createVectorNamespace(context.organizationId, context.projectId)) throw new Error("Vector namespace tenant boundary violation.");
}

export function retrievalPostFilter(chunks: VectorQueryResult[], context: VectorQueryContext, filters: VectorQueryFilters = {}) {
  const collectionId = filters.collectionId ?? context.collectionId;
  const allowedSources = filters.allowedSources ?? context.allowedSources;
  const sensitivity = filters.allowedSensitivityLabels ?? context.allowedSensitivityLabels;
  return chunks.filter((chunk) => {
    if (chunk.organizationId !== context.organizationId || chunk.projectId !== context.projectId) return false;
    if (chunk.documentStatus !== "APPROVED" && chunk.documentStatus !== "INDEXED") return false;
    if (collectionId && chunk.collectionId !== collectionId) return false;
    if (context.allowedDocumentIds?.length && !context.allowedDocumentIds.includes(chunk.documentId)) return false;
    if (!chunk.allowedRoles?.length || !chunk.allowedRoles.includes(context.role)) return false;
    if (allowedSources?.length && (!chunk.sourceUrl || !allowedSources.includes(chunk.sourceUrl))) return false;
    if (sensitivity?.length && !sensitivity.includes(chunk.sensitivityLabel ?? "INTERNAL")) return false;
    return true;
  });
}

export async function createEmbedding(text: string): Promise<number[]> {
  const endpoint = process.env.EMBEDDING_API_URL;
  if (endpoint) {
    const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", ...(process.env.EMBEDDING_API_KEY ? { authorization: `Bearer ${process.env.EMBEDDING_API_KEY}` } : {}) }, body: JSON.stringify({ input: text }), signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Embedding endpoint failed with HTTP ${response.status}.`);
    const payload = await response.json() as { embedding?: number[]; data?: Array<{ embedding: number[] }> };
    const embedding = payload.embedding ?? payload.data?.[0]?.embedding;
    if (!embedding?.length) throw new Error("Embedding endpoint returned no vector.");
    return embedding;
  }
  if (process.env.NODE_ENV === "production" && process.env.VECTOR_ALLOW_LOCAL_EMBEDDINGS !== "true") {
    throw new Error("EMBEDDING_API_URL is required in production. Deterministic local embeddings are test-only.");
  }
  const dimensions = Number(process.env.VECTOR_DIMENSIONS ?? 64);
  const vector = Array.from({ length: dimensions }, () => 0);
  for (const token of text.toLowerCase().match(/[a-z0-9_]{2,}/g) ?? []) {
    const digest = createHash("sha256").update(token).digest();
    vector[digest.readUInt16BE(0) % dimensions] += digest[2] % 2 ? 1 : -1;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

export function buildRetrievalAuditData(input: { context: VectorQueryContext; queryText: string; requestedFilters?: VectorQueryFilters; candidates: VectorQueryResult[]; accepted: VectorQueryResult[] }) {
  const acceptedIds = new Set(input.accepted.map((chunk) => chunk.id));
  return {
    organizationId: input.context.organizationId,
    projectId: input.context.projectId,
    namespace: createVectorNamespace(input.context.organizationId, input.context.projectId),
    queryHash: createHash("sha256").update(input.queryText).digest("hex"),
    requestedFilters: (input.requestedFilters ?? {}) as object,
    returnedChunkIds: input.accepted.map((chunk) => chunk.id),
    rejectedChunkIds: input.candidates.filter((chunk) => !acceptedIds.has(chunk.id)).map((chunk) => chunk.id),
    resultCount: input.accepted.length,
  };
}

export async function auditRetrieval(input: { context: VectorQueryContext; queryText: string; requestedFilters?: VectorQueryFilters; candidates: VectorQueryResult[]; accepted: VectorQueryResult[] }) {
  const data = buildRetrievalAuditData(input);
  if (process.env.NODE_ENV === "test" && process.env.PERSIST_RETRIEVAL_AUDIT !== "true") return data;
  await db.retrievalAuditLog.create({ data });
  return data;
}

export class MemoryVectorProvider implements VectorProvider {
  private readonly namespaces = new Map<string, VectorQueryResult[]>();
  async createNamespace(context: VectorNamespaceContext) { const namespace = createVectorNamespace(context.organizationId, context.projectId); this.namespaces.set(namespace, this.namespaces.get(namespace) ?? []); return namespace; }
  async deleteNamespace(context: VectorNamespaceContext) { this.namespaces.delete(createVectorNamespace(context.organizationId, context.projectId)); }
  async indexChunks(chunks: VectorChunk[]) { for (const chunk of chunks) { const namespace = createVectorNamespace(chunk.organizationId, chunk.projectId); const existing = this.namespaces.get(namespace) ?? []; this.namespaces.set(namespace, [...existing.filter((item) => item.id !== chunk.id), { ...chunk, score: 1 }]); } }
  async query(queryText: string, context: VectorQueryContext, filters: VectorQueryFilters = {}) { const candidates = this.namespaces.get(createVectorNamespace(context.organizationId, context.projectId)) ?? []; const accepted = retrievalPostFilter(candidates, context, filters).slice(0, filters.limit ?? 10); await auditRetrieval({ context, queryText, requestedFilters: filters, candidates, accepted }); return accepted; }
  async deleteDocument(documentId: string, context: VectorNamespaceContext) { const namespace = createVectorNamespace(context.organizationId, context.projectId); this.namespaces.set(namespace, (this.namespaces.get(namespace) ?? []).filter((chunk) => chunk.documentId !== documentId)); }
  async healthCheck(): Promise<VectorHealth> { return { provider: "memory", healthy: true, configured: true, latencyMs: 0, message: "In-memory vector provider is operational." }; }
}

export async function getVectorProvider(): Promise<VectorProvider> {
  const provider = process.env.VECTOR_PROVIDER ?? "memory";
  if (provider === "memory") {
    if (process.env.NODE_ENV === "production") throw new Error("The in-memory vector provider is disabled in production. Configure Qdrant or pgvector.");
    return new MemoryVectorProvider();
  }
  if (provider === "qdrant") return new (await import("./providers/qdrantProvider")).QdrantProvider();
  if (provider === "pgvector") return new (await import("./providers/pgvectorProvider")).PgvectorProvider();
  throw new Error(`Unsupported vector provider: ${provider}`);
}
