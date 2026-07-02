const SUPPORTED_TEXT_EXTENSIONS = new Set([
  ".txt", ".log", ".env", ".json", ".csv", ".sql", ".md", ".yaml", ".yml", ".xml",
  ".js", ".ts", ".tsx", ".jsx", ".py", ".java", ".go", ".rs", ".php", ".rb", ".cs",
  ".cpp", ".c", ".h", ".sh", ".ps1",
]);

const METADATA_ONLY_EXTENSIONS = new Set([".pdf", ".docx", ".xlsx", ".pptx"]);
const DEFAULT_MAX_TEXT_SCAN_BYTES = 1024 * 1024;

export interface ExtractedFileText {
  supported: boolean;
  encryptedOrBinary: boolean;
  text: string;
  scannedBytes: number;
  reason?: string;
}

export function extensionForFile(file: File) {
  const match = /(\.[A-Za-z0-9]+)$/.exec(file.name);
  return match ? match[1].toLowerCase() : "";
}

export function isSupportedFile(file: File) {
  return SUPPORTED_TEXT_EXTENSIONS.has(extensionForFile(file));
}

export function isMetadataOnlyFile(file: File) {
  return METADATA_ONLY_EXTENSIONS.has(extensionForFile(file));
}

export async function extractTextFromFile(file: File, maxBytes = DEFAULT_MAX_TEXT_SCAN_BYTES): Promise<ExtractedFileText> {
  const extension = extensionForFile(file);
  if (METADATA_ONLY_EXTENSIONS.has(extension)) {
    return { supported: false, encryptedOrBinary: false, text: "", scannedBytes: 0, reason: "metadata_only_parser_not_available" };
  }
  if (!SUPPORTED_TEXT_EXTENSIONS.has(extension)) {
    return { supported: false, encryptedOrBinary: true, text: "", scannedBytes: 0, reason: "unsupported_or_binary" };
  }
  const slice = file.slice(0, Math.min(file.size, maxBytes));
  const buffer = await slice.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (looksBinary(bytes)) {
    return { supported: false, encryptedOrBinary: true, text: "", scannedBytes: bytes.byteLength, reason: "binary_content" };
  }
  return {
    supported: true,
    encryptedOrBinary: false,
    text: new TextDecoder("utf-8", { fatal: false }).decode(bytes),
    scannedBytes: bytes.byteLength,
  };
}

function looksBinary(bytes: Uint8Array) {
  const sample = bytes.slice(0, Math.min(bytes.length, 4096));
  if (!sample.length) return false;
  let suspicious = 0;
  for (const byte of sample) {
    if (byte === 0) return true;
    if (byte < 7 || (byte > 14 && byte < 32)) suspicious += 1;
  }
  return suspicious / sample.length > 0.08;
}

export async function sha256Browser(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
