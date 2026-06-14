import { extname } from "path";

export const MAX_DOCUMENT_BYTES = Number(process.env.RAG_MAX_FILE_BYTES ?? 10 * 1024 * 1024);
export const MAX_DOCUMENT_PAGES = Number(process.env.RAG_MAX_PAGES ?? 50);

const allowed = new Map([
  [".txt", ["text/plain"]],
  [".md", ["text/markdown", "text/plain"]],
  [".pdf", ["application/pdf"]],
  [".png", ["image/png"]],
  [".jpg", ["image/jpeg"]],
  [".jpeg", ["image/jpeg"]],
]);

export interface ValidatedFile {
  extension: string;
  detectedMimeType: string;
  size: number;
}

export function detectMimeType(content: Buffer): string {
  if (content.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff) return "image/jpeg";
  const sample = content.subarray(0, Math.min(content.length, 4096));
  if (!sample.includes(0) && sample.toString("utf8").replace(/[\x09\x0a\x0d\x20-\x7e]/g, "").length < sample.length * 0.1) return "text/plain";
  return "application/octet-stream";
}

export function validateDocumentFile(input: { fileName: string; declaredMimeType?: string; content: Buffer }): ValidatedFile {
  const extension = extname(input.fileName).toLowerCase();
  const acceptedMimeTypes = allowed.get(extension);
  if (!acceptedMimeTypes) throw new Error("Unsupported document extension. Use TXT, Markdown, PDF, PNG, JPG, or JPEG.");
  if (!input.content.length) throw new Error("Document is empty.");
  if (input.content.length > MAX_DOCUMENT_BYTES) throw new Error(`Document exceeds the ${MAX_DOCUMENT_BYTES} byte limit.`);
  const detectedMimeType = detectMimeType(input.content);
  const normalizedDetected = extension === ".md" && detectedMimeType === "text/plain" ? "text/markdown" : detectedMimeType;
  if (!acceptedMimeTypes.includes(normalizedDetected) && !acceptedMimeTypes.includes(detectedMimeType)) {
    throw new Error(`File signature ${detectedMimeType} does not match extension ${extension}.`);
  }
  if (input.declaredMimeType && input.declaredMimeType !== "application/octet-stream" && !acceptedMimeTypes.includes(input.declaredMimeType)) {
    throw new Error("Declared MIME type does not match the approved file type.");
  }
  return { extension, detectedMimeType: normalizedDetected, size: input.content.length };
}
