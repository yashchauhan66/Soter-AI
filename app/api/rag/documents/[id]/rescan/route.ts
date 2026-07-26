import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { scanRagDocument } from "@/lib/rag/scanner";
import {
  buildRagRescanChunkRows,
  nextRagRescanStatus,
  ragRescanVectorSyncPlan,
} from "@/lib/rag/rescanPlan";
import { getVectorProvider } from "@/lib/rag/vector/vectorProvider";
import { emitSecurityEvent } from "@/lib/events/emit";

export const runtime = "nodejs";

/**
 * POST /api/rag/documents/[id]/rescan
 *
 * Re-scans an existing RAG document by reconstructing text from its chunks
 * and re-running the scanner. Useful when detector rules have been updated
 * or when a quarantined document has been fixed externally.
 *
 * Creates a new version of the document with fresh scan results.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const document = await db.ragDocument.findUnique({
      where: { id },
      include: {
        collection: true,
        chunks: { orderBy: { chunkIndex: "asc" } },
        findings: true,
      },
    });
    if (!document)
      return jsonResponse(
        { error: true, message: "Document not found." },
        { status: 404 },
      );

    const access = await requireProjectPermission(
      document.collection.projectId,
      "rag:manage",
    );
    if (document.collection.organizationId !== access.org.id)
      return jsonResponse(
        { error: true, message: "Tenant boundary violation." },
        { status: 403 },
      );

    if (document.chunks.length === 0)
      return jsonResponse(
        {
          error: true,
          message:
            "Document has no chunks to re-scan. Re-upload the original file instead.",
        },
        { status: 409 },
      );

    // Reconstruct text from existing chunks (ordered by index)
    const reconstructedText = document.chunks
      .map((chunk) => chunk.textRedacted)
      .join("\n\n");

    // Re-run the scanner with current detector rules.
    const scan = scanRagDocument(reconstructedText);

    const newVersion = document.version + 1;
    const nextStatus = nextRagRescanStatus(document.status, scan.quarantine);
    const chunkRows = buildRagRescanChunkRows({
      documentId: id,
      previousVersion: document.version,
      newVersion,
      previousChunks: document.chunks,
      scannedChunks: scan.chunks,
    });
    const vectorPlan = ragRescanVectorSyncPlan(document.status, nextStatus);

    const provider = vectorPlan.deleteExisting ? await getVectorProvider() : null;
    if (provider) {
      await provider.deleteDocument(document.id, {
        organizationId: access.org.id,
        projectId: access.project.id,
      });
    }

    await db.$transaction(async (tx) => {
      // Delete old findings and chunks
      await tx.ragScanFinding.deleteMany({ where: { documentId: id } });
      await tx.ragChunk.deleteMany({ where: { documentId: id } });

      // Update the document with new scan results
      await tx.ragDocument.update({
        where: { id },
        data: {
          version: newVersion,
          status: nextStatus,
          trustScore: scan.trustScore,
          riskTypes: scan.riskTypes,
        },
      });

      await tx.ragChunk.createMany({
        data: chunkRows,
      });

      // Create new findings
      if (scan.findings.length) {
        // Fetch the newly created chunks to map chunkIndex → chunkId
        const newChunks = await tx.ragChunk.findMany({
          where: { documentId: id },
          select: { id: true, chunkIndex: true },
        });
        const chunkIdMap = new Map(
          newChunks.map((c) => [c.chunkIndex, c.id]),
        );

        await tx.ragScanFinding.createMany({
          data: scan.findings.map((finding) => ({
            documentId: id,
            chunkId: chunkIdMap.get(finding.chunkIndex),
            type: finding.type,
            severity: finding.severity,
            message: finding.message,
            redactedSnippet: finding.redactedSnippet,
          })),
        });
      }
    });

    if (provider && vectorPlan.reindexFresh) {
      const updatedChunks = await db.ragChunk.findMany({
        where: { documentId: id },
        orderBy: { chunkIndex: "asc" },
      });
      await provider.createNamespace({
        organizationId: access.org.id,
        projectId: access.project.id,
      });
      await provider.indexChunks(updatedChunks.map((chunk) => ({
        id: chunk.id,
        organizationId: access.org.id,
        projectId: access.project.id,
        collectionId: document.collectionId,
        documentId: document.id,
        documentStatus: "INDEXED",
        textRedacted: chunk.textRedacted,
        allowedRoles: chunk.allowedRoles,
        sourceUrl: chunk.sourceUrl ?? undefined,
        sensitivityLabel: chunk.sensitivityLabel,
        metadata: chunk.metadata && typeof chunk.metadata === "object" && !Array.isArray(chunk.metadata)
          ? chunk.metadata as Record<string, unknown>
          : undefined,
      })));
    }

    // Emit security event if newly quarantined
    if (scan.quarantine) {
      await emitSecurityEvent({
        organizationId: document.collection.organizationId,
        projectId: document.collection.projectId,
        eventType: "rag.document_quarantined",
        severity: scan.riskScore >= 86 ? "CRITICAL" : "HIGH",
        riskTypes: scan.riskTypes,
        action: "QUARANTINE",
        source: "rag.document_rescan",
        metadata: {
          documentId: id,
          previousVersion: document.version,
          newVersion,
          previousStatus: document.status,
        },
      });
    }

    return jsonResponse({
      id: document.id,
      version: newVersion,
      status: nextStatus,
      trustScore: scan.trustScore,
      riskScore: scan.riskScore,
      riskTypes: scan.riskTypes,
      findingsCount: scan.findings.length,
      chunksCount: scan.chunks.length,
      previousStatus: document.status,
      previousVersion: document.version,
    });
  } catch (error) {
    return apiError(error, "Document re-scan failed.");
  }
}
