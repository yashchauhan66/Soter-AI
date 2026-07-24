const SUPPORTED_TEXT_EXTENSIONS = new Set([
  // Traditional text files
  ".txt", ".log", ".env", ".json", ".csv", ".sql", ".md", ".yaml", ".yml", ".xml",
  ".js", ".ts", ".tsx", ".jsx", ".py", ".java", ".go", ".rs", ".php", ".rb", ".cs",
  ".cpp", ".c", ".h", ".sh", ".ps1",
  // Handled binary doc formats via local extractors
  ".pdf", ".docx", ".xlsx", ".pptx"
]);

// No office formats are metadata-only anymore — PDF/DOCX/XLSX/PPTX all have
// local text extractors below. Kept for callers that branch on it.
const METADATA_ONLY_EXTENSIONS = new Set<string>([]);
const DEFAULT_MAX_TEXT_SCAN_BYTES = 10 * 1024 * 1024; // 10MB limit for local processing

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

/** Parses ZIP file and returns Map of filename -> raw ArrayBuffer */
export async function unzip(buffer: ArrayBuffer): Promise<Map<string, ArrayBuffer>> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const files = new Map<string, ArrayBuffer>();
  let offset = 0;

  while (offset < buffer.byteLength - 30) {
    // Check local file header signature 'PK\x03\x04'
    if (view.getUint32(offset, true) !== 0x04034b50) {
      break;
    }
    const compMethod = view.getUint16(offset + 8, true);
    const compSize = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);

    // Safety check to prevent out of bounds
    if (offset + 30 + nameLen > buffer.byteLength) break;

    const nameBytes = bytes.subarray(offset + 30, offset + 30 + nameLen);
    const name = new TextDecoder("utf-8").decode(nameBytes);

    const dataOffset = offset + 30 + nameLen + extraLen;
    if (dataOffset + compSize > buffer.byteLength) break;

    const compData = bytes.subarray(dataOffset, dataOffset + compSize);

    let fileData: ArrayBuffer;
    if (compMethod === 0) {
      fileData = compData.slice().buffer;
    } else if (compMethod === 8) {
      try {
        const ds = new DecompressionStream("deflate-raw");
        const writer = ds.writable.getWriter();
        writer.write(compData);
        writer.close();
        fileData = await new Response(ds.readable).arrayBuffer();
      } catch (err) {
        console.error("[Soter] Failed to decompress file inside zip:", name, err);
        fileData = new ArrayBuffer(0);
      }
    } else {
      fileData = new ArrayBuffer(0);
    }

    files.set(name, fileData);
    offset = dataOffset + compSize;

    // Skip data descriptor if present (bit 3 of general purpose flag)
    const flags = view.getUint16(offset + 6, true);
    if ((flags & 8) !== 0) {
      offset += 12;
    }
  }
  return files;
}

/** Decodes the five predefined XML entities (plus numeric refs) in OOXML text. */
function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Extracts strings from standard DOCX document.xml structure */
function extractDocxText(xml: string): string {
  // Find text inside paragraph <w:t> tags
  const matches = xml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
  if (!matches) return "";
  return matches.map(m => decodeXmlEntities(m.replace(/<[^>]+>/g, ""))).join(" ");
}

/** Extracts strings from XLSX sharedStrings.xml structure */
function extractXlsxSharedStrings(xml: string): string {
  // Shared strings container is <t> tags
  const matches = xml.match(/<t[^>]*>([\s\S]*?)<\/t>/g);
  if (!matches) return "";
  return matches.map(m => decodeXmlEntities(m.replace(/<[^>]+>/g, ""))).join(" ");
}

/**
 * Extracts values directly from a worksheet's sheet XML.
 * sharedStrings only holds de-duplicated *string* cells; numbers, dates, and
 * inline strings live in the sheet itself. Aadhaar/PAN/salary values are
 * usually numeric or inline, so this is essential for real DLP coverage.
 */
function extractXlsxSheetValues(xml: string): string {
  const values: string[] = [];
  // Inline strings: <is>...<t>value</t>...</is>
  const inlineMatches = xml.match(/<is>[\s\S]*?<\/is>/g);
  if (inlineMatches) {
    for (const block of inlineMatches) {
      const t = block.match(/<t[^>]*>([\s\S]*?)<\/t>/g);
      if (t) values.push(...t.map(m => decodeXmlEntities(m.replace(/<[^>]+>/g, ""))));
    }
  }
  // Numeric / boolean / formula-result cells: value in <v>...</v> where the
  // cell type is NOT "s" (shared string index). Only pull <v> when the
  // enclosing <c ...> tag has no t="s" attribute.
  const cellMatches = xml.match(/<c\b[^>]*>[\s\S]*?<\/c>/g);
  if (cellMatches) {
    for (const cell of cellMatches) {
      const typeMatch = /<c\b[^>]*\bt="([^"]+)"/.exec(cell);
      const cellType = typeMatch?.[1];
      if (cellType === "s" || cellType === "inlineStr") continue; // handled elsewhere
      const v = /<v[^>]*>([\s\S]*?)<\/v>/.exec(cell);
      if (v?.[1]) values.push(decodeXmlEntities(v[1]));
    }
  }
  return values.join(" ");
}

/** Extracts slide text from PPTX presentations (<a:t> runs across all slides). */
function extractPptxText(files: Map<string, ArrayBuffer>): string {
  const parts: string[] = [];
  for (const [name, buffer] of files) {
    // ppt/slides/slide1.xml, slide2.xml, ... plus notesSlides and slideLayouts.
    if (!/^ppt\/(slides|notesSlides)\/[^/]+\.xml$/i.test(name)) continue;
    const xml = new TextDecoder("utf-8").decode(buffer);
    const matches = xml.match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g);
    if (matches) parts.push(...matches.map(m => decodeXmlEntities(m.replace(/<[^>]+>/g, ""))));
  }
  return parts.join(" ");
}

/** Regex-free safe browser parser for PDF text streams */
async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder("ascii").decode(bytes);
  const extTexts: string[] = [];

  const streamMarker = new TextEncoder().encode("stream");
  const endstreamMarker = new TextEncoder().encode("endstream");

  const streamPositions: number[] = [];
  const endstreamPositions: number[] = [];

  let pos = 0;
  while ((pos = bytes.indexOf(streamMarker[0], pos)) !== -1) {
    if (pos + 6 <= bytes.length &&
      bytes[pos + 1] === streamMarker[1] &&
      bytes[pos + 2] === streamMarker[2] &&
      bytes[pos + 3] === streamMarker[3] &&
      bytes[pos + 4] === streamMarker[4] &&
      bytes[pos + 5] === streamMarker[5]) {
      streamPositions.push(pos + 6);
    }
    pos++;
  }

  pos = 0;
  while ((pos = bytes.indexOf(endstreamMarker[0], pos)) !== -1) {
    if (pos + 9 <= bytes.length &&
      bytes[pos + 1] === endstreamMarker[1] &&
      bytes[pos + 2] === endstreamMarker[2] &&
      bytes[pos + 3] === endstreamMarker[3] &&
      bytes[pos + 4] === endstreamMarker[4] &&
      bytes[pos + 5] === endstreamMarker[5] &&
      bytes[pos + 6] === endstreamMarker[6] &&
      bytes[pos + 7] === endstreamMarker[7] &&
      bytes[pos + 8] === endstreamMarker[8]) {
      endstreamPositions.push(pos);
    }
    pos++;
  }

  for (let i = 0; i < streamPositions.length; i++) {
    const start = streamPositions[i];
    const end = endstreamPositions.find(p => p > start);
    if (!end) continue;

    let dataStart = start;
    if (bytes[dataStart] === 13) dataStart++; // \r
    if (bytes[dataStart] === 10) dataStart++; // \n

    const streamBytes = bytes.subarray(dataStart, end);
    const precedingHeader = text.slice(Math.max(0, start - 250), start);
    const isFlate = precedingHeader.includes("FlateDecode") || precedingHeader.includes("Flate");

    try {
      let decompressed: Uint8Array;
      if (isFlate) {
        const ds = new DecompressionStream("deflate");
        const writer = ds.writable.getWriter();
        writer.write(streamBytes);
        writer.close();
        decompressed = new Uint8Array(await new Response(ds.readable).arrayBuffer());
      } else {
        decompressed = streamBytes;
      }

      const streamText = new TextDecoder("utf-8", { fatal: false }).decode(decompressed);

      // Match PDF string literal formats (Text) Tj, ', " or [ (Text) ] TJ
      const tjMatches = streamText.match(/\[([\s\S]*?)\]\s*TJ/gi);
      if (tjMatches) {
        for (const tjM of tjMatches) {
          const innerStrings = tjM.match(/\(([^)]*)\)/g);
          if (innerStrings) {
            for (const s of innerStrings) {
              extTexts.push(s.slice(1, -1));
            }
          }
        }
      }

      const tjItemMatches = streamText.match(/\(([^)]*)\)\s*(Tj|'|")/gi);
      if (tjItemMatches) {
        for (const m of tjItemMatches) {
          const strMatch = /\(([^)]*)\)/.exec(m);
          if (strMatch) extTexts.push(strMatch[1]);
        }
      }
    } catch {
      // Ignore binary stream failures (images, font files, etc.)
    }
  }

  return extTexts
    .join(" ")
    .replace(/\\([0-7]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8))) // Decode binary PDF octals
    .replace(/\\(.)/g, "$1") // Clean backslashes
    .trim();
}

export async function extractTextFromFile(file: File, maxBytes = DEFAULT_MAX_TEXT_SCAN_BYTES): Promise<ExtractedFileText> {
  const extension = extensionForFile(file);

  if (!SUPPORTED_TEXT_EXTENSIONS.has(extension)) {
    return { supported: false, encryptedOrBinary: true, text: "", scannedBytes: 0, reason: "unsupported_or_binary" };
  }

  try {
    const sizeToRead = Math.min(file.size, maxBytes);
    const slice = file.slice(0, sizeToRead);
    const buffer = await slice.arrayBuffer();

    if (extension === ".pdf") {
      const pdfText = await extractTextFromPdf(buffer);
      return {
        supported: true,
        encryptedOrBinary: false,
        text: pdfText,
        scannedBytes: buffer.byteLength
      };
    }

    if (extension === ".docx") {
      const files = await unzip(buffer);
      const docXml = files.get("word/document.xml");
      if (!docXml) {
        return { supported: false, encryptedOrBinary: false, text: "", scannedBytes: buffer.byteLength, reason: "invalid_docx_structure" };
      }
      const rawXml = new TextDecoder("utf-8").decode(docXml);
      const text = extractDocxText(rawXml);
      return {
        supported: true,
        encryptedOrBinary: false,
        text,
        scannedBytes: buffer.byteLength
      };
    }

    if (extension === ".xlsx") {
      const files = await unzip(buffer);
      const parts: string[] = [];
      // 1. Shared string table (de-duplicated string cells).
      const stringsXml = files.get("xl/sharedStrings.xml");
      if (stringsXml) {
        parts.push(extractXlsxSharedStrings(new TextDecoder("utf-8").decode(stringsXml)));
      }
      // 2. Per-sheet inline strings + numeric/date/boolean cell values.
      for (const [name, sheetBuffer] of files) {
        if (!/^xl\/worksheets\/sheet[^/]*\.xml$/i.test(name)) continue;
        parts.push(extractXlsxSheetValues(new TextDecoder("utf-8").decode(sheetBuffer)));
      }
      const text = parts.filter(Boolean).join(" ").trim();
      return {
        supported: true,
        encryptedOrBinary: false,
        text,
        scannedBytes: buffer.byteLength,
        reason: text ? undefined : "no_extractable_text",
      };
    }

    if (extension === ".pptx") {
      const files = await unzip(buffer);
      const text = extractPptxText(files);
      return {
        supported: true,
        encryptedOrBinary: false,
        text,
        scannedBytes: buffer.byteLength,
        reason: text ? undefined : "no_extractable_text",
      };
    }

    // Default plain text scan
    const bytes = new Uint8Array(buffer);
    if (looksBinary(bytes)) {
      return { supported: false, encryptedOrBinary: true, text: "", scannedBytes: bytes.byteLength, reason: "binary_content" };
    }

    return {
      supported: true,
      encryptedOrBinary: false,
      text: new TextDecoder("utf-8", { fatal: false }).decode(bytes),
      scannedBytes: bytes.byteLength
    };
  } catch (error) {
    return {
      supported: false,
      encryptedOrBinary: true,
      text: "",
      scannedBytes: 0,
      reason: error instanceof Error ? error.message : "extraction_failed"
    };
  }
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
