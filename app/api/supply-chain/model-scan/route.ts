import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireProjectPermission } from "@/lib/auth/guards";
import { scanModelArtifact } from "@/lib/model-scan";
import { storeModelScan } from "@/lib/model-scan/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bound the upload. The dangerous pickle in a torch archive is tiny; we cap at
// 50MB so the route stays responsive and DoS-resistant. Larger artifacts should
// be scanned by digest + attestation, or by the offline CLI.
const MAX_BYTES = 50 * 1024 * 1024;

/**
 * POST /api/supply-chain/model-scan?projectId=...&filename=...&expectedSha256=...
 * Body: raw model bytes (application/octet-stream) OR JSON { contentBase64, filename, expectedSha256, attestation, knownGoodHashes }.
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId") ?? "";
    const access = await requireProjectPermission(projectId, "policy:manage");

    const contentType = request.headers.get("content-type") ?? "";
    let bytes: Buffer;
    let filename = url.searchParams.get("filename") ?? "upload.bin";
    let expectedSha256 = url.searchParams.get("expectedSha256");
    let attestation: unknown = undefined;
    let knownGoodHashes: string[] | undefined;

    if (contentType.includes("application/json")) {
      const raw = await readBounded(request);
      const body = JSON.parse(raw.toString("utf8")) as {
        contentBase64?: string; filename?: string; expectedSha256?: string;
        attestation?: unknown; knownGoodHashes?: string[];
      };
      if (!body.contentBase64) {
        return jsonResponse({ error: true, message: "contentBase64 is required for JSON uploads." }, { status: 400 });
      }
      bytes = Buffer.from(body.contentBase64, "base64");
      if (bytes.length > MAX_BYTES) {
        return jsonResponse({ error: true, message: "Decoded artifact exceeds the 50MB scan limit." }, { status: 413 });
      }
      filename = body.filename ?? filename;
      expectedSha256 = body.expectedSha256 ?? expectedSha256;
      attestation = body.attestation;
      knownGoodHashes = body.knownGoodHashes;
    } else {
      bytes = await readBounded(request);
    }

    if (bytes.length === 0) {
      return jsonResponse({ error: true, message: "Empty body — provide model bytes to scan." }, { status: 400 });
    }

    const report = scanModelArtifact(bytes, {
      filename,
      expectedSha256,
      attestation,
      knownGoodHashes,
    });

    let scanId: string | null = null;
    try {
      const stored = await storeModelScan({
        organizationId: access.org.id,
        projectId: access.project.id,
        scannedById: access.user.id,
        report,
      });
      scanId = stored.id;
    } catch (err) {
      // Persistence is best-effort; the scan result is still returned.
      console.error("model-scan.persist_failed", err instanceof Error ? err.message : err);
    }

    return jsonResponse({ scanId, report });
  } catch (error) {
    return apiError(error, "Model artifact scan failed.");
  }
}

async function readBounded(request: Request): Promise<Buffer> {
  const body = request.body;
  if (!body) return Buffer.alloc(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) throw new Error("Artifact exceeds the 50MB scan limit.");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
