export interface VectorNamespaceContext { organizationId: string; projectId: string }

export interface VectorChunk {
  id: string;
  organizationId: string;
  projectId: string;
  collectionId: string;
  documentId: string;
  documentStatus: "APPROVED" | "INDEXED" | string;
  textRedacted: string;
  allowedRoles?: string[];
  sourceUrl?: string;
  sensitivityLabel?: string;
  metadata?: Record<string, unknown>;
}

export interface VectorQueryContext extends VectorNamespaceContext {
  role: string;
  collectionId?: string;
  allowedDocumentIds?: string[];
  allowedSources?: string[];
  allowedSensitivityLabels?: string[];
}

export interface VectorQueryFilters {
  limit?: number;
  collectionId?: string;
  allowedSources?: string[];
  allowedSensitivityLabels?: string[];
}

export interface VectorQueryResult extends VectorChunk { score: number }
export interface VectorHealth { provider: string; healthy: boolean; configured: boolean; latencyMs: number; message: string }
