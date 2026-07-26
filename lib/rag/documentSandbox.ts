import { scanRagDocument, type RagScanResult } from "./scanner";
import { validateDocumentFile } from "./fileValidation";
import { extractTextWithOcr, type OcrProvider } from "./ocr";
import { inspectPdf, type PdfInspection } from "./pdfInspector";

/** Maximum total time (ms) for the document sandbox to process a single file. */
const SANDBOX_TIMEOUT_MS = 60_000;

export interface DocumentSandboxResult {
  validation: ReturnType<typeof validateDocumentFile>;
  pageCount: number;
  extractionMethod: "text" | "pdf-text" | "ocr";
  scan: RagScanResult;
  sandboxFindings: PdfInspection["findings"];
  metadata: Record<string, unknown>;
}

export async function sandboxDocument(input: { fileName: string; declaredMimeType?: string; content: Buffer; ocrProvider?: OcrProvider }): Promise<DocumentSandboxResult> {
  const started = Date.now();
  const timeout = (label: string) => {
    if (Date.now() - started > SANDBOX_TIMEOUT_MS) {
      throw new Error(`Document sandbox timed out during ${label}.`);
    }
  };
  const validation = validateDocumentFile(input);
  let pageCount = 1;
  let extractionMethod: DocumentSandboxResult["extractionMethod"] = "text";
  let text = "";
  let sandboxFindings: PdfInspection["findings"] = [];
  const metadata: Record<string, unknown> = {};

  timeout("validation");

  if (validation.detectedMimeType === "application/pdf") {
    timeout("pdf-inspection");
    const inspection = inspectPdf(input.content);
    pageCount = inspection.pageCount;
    sandboxFindings = inspection.findings;
    if (inspection.requiresOcr) {
      const ocr = await extractTextWithOcr({ content: input.content, mimeType: validation.detectedMimeType, pageCount }, input.ocrProvider);
      text = ocr.textRedacted;
      extractionMethod = "ocr";
      Object.assign(metadata, { ocrProvider: ocr.provider, ocrConfidence: ocr.confidence, ocrDurationMs: ocr.durationMs });
    } else {
      text = inspection.extractedText;
      extractionMethod = "pdf-text";
    }
  } else if (validation.detectedMimeType.startsWith("image/")) {
    timeout("ocr");
    const ocr = await extractTextWithOcr({ content: input.content, mimeType: validation.detectedMimeType }, input.ocrProvider);
    text = ocr.textRedacted;
    extractionMethod = "ocr";
    Object.assign(metadata, { ocrProvider: ocr.provider, ocrConfidence: ocr.confidence, ocrDurationMs: ocr.durationMs });
  } else {
    text = input.content.toString("utf8");
  }

  timeout("scanning");
  const scan = scanRagDocument(text);
  for (const finding of sandboxFindings) {
    scan.findings.push({ ...finding, redactedSnippet: undefined, chunkIndex: 0 });
    scan.riskTypes.push(finding.type);
  }
  scan.riskTypes = [...new Set(scan.riskTypes)];
  if (sandboxFindings.length) {
    scan.quarantine = true;
    scan.status = "QUARANTINED";
    scan.riskScore = Math.max(scan.riskScore, 80);
    scan.trustScore = Math.min(scan.trustScore, 20);
  }
  return { validation, pageCount, extractionMethod, scan, sandboxFindings, metadata };
}
