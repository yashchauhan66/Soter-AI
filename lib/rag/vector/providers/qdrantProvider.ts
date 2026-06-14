import { auditRetrieval, createEmbedding, createVectorNamespace, retrievalPostFilter, type VectorProvider } from "../vectorProvider";
import type { VectorChunk, VectorHealth, VectorNamespaceContext, VectorQueryContext, VectorQueryFilters, VectorQueryResult } from "../vectorTypes";

export class QdrantProvider implements VectorProvider {
  private config() {
    const url = process.env.QDRANT_URL?.replace(/\/$/, "");
    if (!url) throw new Error("QDRANT_URL is required for the Qdrant vector provider.");
    return { url, apiKey: process.env.QDRANT_API_KEY };
  }
  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const { url, apiKey } = this.config();
    const response = await fetch(`${url}${path}`, { ...init, headers: { "content-type": "application/json", ...(apiKey ? { "api-key": apiKey } : {}), ...init.headers }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`Qdrant request failed with HTTP ${response.status}.`);
    return await response.json() as T;
  }
  async createNamespace(context: VectorNamespaceContext) { const namespace = createVectorNamespace(context.organizationId, context.projectId); await this.request(`/collections/${encodeURIComponent(namespace)}`, { method: "PUT", body: JSON.stringify({ vectors: { size: Number(process.env.VECTOR_DIMENSIONS ?? 64), distance: "Cosine" } }) }); return namespace; }
  async deleteNamespace(context: VectorNamespaceContext) { await this.request(`/collections/${encodeURIComponent(createVectorNamespace(context.organizationId, context.projectId))}`, { method: "DELETE" }); }
  async indexChunks(chunks: VectorChunk[]) {
    const grouped = Map.groupBy(chunks, (chunk) => createVectorNamespace(chunk.organizationId, chunk.projectId));
    for (const [namespace, items] of grouped) {
      const points = await Promise.all(items.map(async (chunk) => ({ id: chunk.id, vector: await createEmbedding(chunk.textRedacted), payload: chunk })));
      await this.request(`/collections/${encodeURIComponent(namespace)}/points?wait=true`, { method: "PUT", body: JSON.stringify({ points }) });
    }
  }
  async query(queryText: string, context: VectorQueryContext, filters: VectorQueryFilters = {}) {
    const namespace = createVectorNamespace(context.organizationId, context.projectId);
    const result = await this.request<{ result: Array<{ id: string | number; score: number; payload: VectorChunk }> }>(`/collections/${encodeURIComponent(namespace)}/points/search`, { method: "POST", body: JSON.stringify({ vector: await createEmbedding(queryText), limit: Math.min(100, Math.max(filters.limit ?? 10, 30)), with_payload: true }) });
    const candidates: VectorQueryResult[] = result.result.map((item) => ({ ...item.payload, id: String(item.id), score: item.score }));
    const accepted = retrievalPostFilter(candidates, context, filters).slice(0, filters.limit ?? 10);
    await auditRetrieval({ context, queryText, requestedFilters: filters, candidates, accepted });
    return accepted;
  }
  async deleteDocument(documentId: string, context: VectorNamespaceContext) { const namespace = createVectorNamespace(context.organizationId, context.projectId); await this.request(`/collections/${encodeURIComponent(namespace)}/points/delete?wait=true`, { method: "POST", body: JSON.stringify({ filter: { must: [{ key: "documentId", match: { value: documentId } }] } }) }); }
  async healthCheck(): Promise<VectorHealth> { const started = Date.now(); try { await this.request("/healthz"); return { provider: "qdrant", healthy: true, configured: true, latencyMs: Date.now() - started, message: "Qdrant is reachable." }; } catch (error) { return { provider: "qdrant", healthy: false, configured: Boolean(process.env.QDRANT_URL), latencyMs: Date.now() - started, message: error instanceof Error ? error.message : "Qdrant health check failed." }; } }
}
