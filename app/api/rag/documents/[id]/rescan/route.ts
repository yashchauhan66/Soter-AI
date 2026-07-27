import { Prisma } from "@prisma/client";
import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { scanRagDocument } from "@/lib/rag/scanner";
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

    // Re-run the scanner with current detector rules
    const scan = scanRagDocument(reconstructedText);

    // Delete old chunks and findings, create new document version
    const newVersion = document.version + 1;

    await db.$transaction(async (tx) => {
      // Delete old findings and chunks
      await tx.ragScanFinding.deleteMany({ where: { documentId: id } });
      await tx.ragChunk.deleteMany({ where: { documentId: id } });

      // Update the document with new scan results
      await tx.ragDocument.update({
        where: { id },
        data: {
          version: newVersion,
          status: scan.status,
          trustScore: scan.trustScore,
          riskTypes: scan.riskTypes,
        },
      });

      // Create new chunks
      await tx.ragChunk.createMany({
        data: scan.chunks.map((chunk) => ({
          documentId: id,
          chunkIndex: chunk.chunkIndex,
          textRedacted: chunk.textRedacted,
          hash: chunk.hash,
          riskScore: chunk.riskScore,
          riskTypes: chunk.riskTypes,
          allowedRoles: [
            "OWNER",
            "ADMIN",
            "DEVELOPER",
            "SECURITY_ANALYST",
            "BILLING",
            "VIEWER",
          ],
          metadata: chunk.metadata as Prisma.InputJsonValue,
        })),
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
      status: scan.status,
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
