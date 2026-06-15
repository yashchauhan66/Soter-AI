import { PrismaClient } from "@prisma/client";
import { db } from "../../../db";
import { auditRetrieval, createEmbedding, createVectorNamespace, retrievalPostFilter, type VectorProvider } from "../vectorProvider";
import type { VectorChunk, VectorHealth, VectorNamespaceContext, VectorQueryContext, VectorQueryFilters } from "../vectorTypes";

function vectorLiteral(vector: number[]) { return `[${vector.map((value) => Number(value).toFixed(8)).join(",")}]`; }

const globalForVector = globalThis as unknown as { pgvectorDb?: PrismaClient; pgvectorUrl?: string };

function vectorDb() {
  const url = process.env.PGVECTOR_DATABASE_URL;
  if (!url || url === process.env.DATABASE_URL) return db;
  if (!globalForVector.pgvectorDb || globalForVector.pgvectorUrl !== url) {
    globalForVector.pgvectorDb = new PrismaClient({ datasources: { db: { url } } });
    globalForVector.pgvectorUrl = url;
  }
  return globalForVector.pgvectorDb;
}

export class PgvectorProvider implements VectorProvider {
  private configured() { if (!(process.env.PGVECTOR_DATABASE_URL ?? process.env.DATABASE_URL)) throw new Error("PGVECTOR_DATABASE_URL or DATABASE_URL is required."); }
  async createNamespace(context: VectorNamespaceContext) { this.configured(); return createVectorNamespace(context.organizationId, context.projectId); }
  async deleteNamespace(context: VectorNamespaceContext) { this.configured(); await vectorDb().$executeRawUnsafe('DELETE FROM "VectorEmbedding" WHERE namespace = $1', createVectorNamespace(context.organizationId, context.projectId)); }
  async indexChunks(chunks: VectorChunk[]) {
    this.configured();
    for (const chunk of chunks) {
      const namespace = createVectorNamespace(chunk.organizationId, chunk.projectId);
      const payload = JSON.stringify(chunk);
      await vectorDb().$executeRawUnsafe('INSERT INTO "VectorEmbedding" (id, namespace, "documentId", payload, embedding, "updatedAt") VALUES ($1,$2,$3,$4::jsonb,$5::vector,NOW()) ON CONFLICT (id) DO UPDATE SET namespace=EXCLUDED.namespace, "documentId"=EXCLUDED."documentId", payload=EXCLUDED.payload, embedding=EXCLUDED.embedding, "updatedAt"=NOW()', chunk.id, namespace, chunk.documentId, payload, vectorLiteral(await createEmbedding(chunk.textRedacted)));
    }
  }
  async query(queryText: string, context: VectorQueryContext, filters: VectorQueryFilters = {}) {
    this.configured();
    const namespace = createVectorNamespace(context.organizationId, context.projectId);
    const rows = await vectorDb().$queryRawUnsafe<Array<{ id: string; payload: VectorChunk; score: number }>>('SELECT id, payload, 1 - (embedding <=> $1::vector) AS score FROM "VectorEmbedding" WHERE namespace = $2 ORDER BY embedding <=> $1::vector LIMIT $3', vectorLiteral(await createEmbedding(queryText)), namespace, Math.min(100, Math.max(filters.limit ?? 10, 30)));
    const candidates = rows.map((row) => ({ ...row.payload, id: row.id, score: Number(row.score) }));
    const accepted = retrievalPostFilter(candidates, context, filters).slice(0, filters.limit ?? 10);
    await auditRetrieval({ context, queryText, requestedFilters: filters, candidates, accepted });
    return accepted;
  }
  async deleteDocument(documentId: string, context: VectorNamespaceContext) { this.configured(); await vectorDb().$executeRawUnsafe('DELETE FROM "VectorEmbedding" WHERE namespace = $1 AND "documentId" = $2', createVectorNamespace(context.organizationId, context.projectId), documentId); }
  async healthCheck(): Promise<VectorHealth> { const started = Date.now(); try { this.configured(); const rows = await vectorDb().$queryRawUnsafe<Array<{ extversion: string }>>("SELECT extversion FROM pg_extension WHERE extname = 'vector'"); if (!rows.length) throw new Error("The pgvector extension is not installed."); return { provider: "pgvector", healthy: true, configured: true, latencyMs: Date.now() - started, message: "PostgreSQL and pgvector storage are reachable." }; } catch (error) { return { provider: "pgvector", healthy: false, configured: Boolean(process.env.PGVECTOR_DATABASE_URL ?? process.env.DATABASE_URL), latencyMs: Date.now() - started, message: error instanceof Error ? error.message : "pgvector health check failed." }; } }
}
