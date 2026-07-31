import { extractZipEntries } from "../model-scan/formats";
import type { PdfInspection } from "./pdfInspector";

const MAX_EXTRACTED_TEXT_BYTES = 8 * 1024 * 1024;

export interface OfficeInspection {
  extractedText: string;
  findings: PdfInspection["findings"];
  entryCount: number;
}

function decodeXml(value: string): string {
  return value
    .replace(/<w:tab\/>|<a:br\/>|<br\s*\/?>/gi, "\t")
    .replace(/<\/(?:w:p|a:p|row|si)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

/** Bounded OpenXML inspection; no Office parser or embedded object is executed. */
export function inspectOfficeOpenXml(content: Buffer, extension: ".docx" | ".xlsx" | ".pptx"): OfficeInspection {
  const entries = extractZipEntries(content);
  const findings: OfficeInspection["findings"] = [];
  if (entries.length === 0) throw new Error("OpenXML archive has no readable local entries.");
  let extractedBytes = 0;
  const text: string[] = [];
  const seen = new Set<string>();
  const selected = extension === ".docx"
    ? /^word\/(?:document|header\d*|footer\d*|comments)\.xml$/i
    : extension === ".xlsx"
      ? /^xl\/(?:sharedStrings|worksheets\/sheet\d+)\.xml$/i
      : /^ppt\/(?:slides\/slide\d+|notesSlides\/notesSlide\d+)\.xml$/i;

  for (const entry of entries) {
    const normalized = entry.name.replace(/\\/g, "/");
    if (seen.has(normalized)) findings.push({ type: "OFFICE_DUPLICATE_ENTRY", severity: "HIGH", message: "OpenXML archive contains duplicate entry names." });
    seen.add(normalized);
    if (entry.unsafeReason) findings.push({ type: "OFFICE_UNSAFE_ARCHIVE_ENTRY", severity: "HIGH", message: entry.unsafeReason });
    if (/^(?:word|xl|ppt)\/embeddings\//i.test(normalized) || /(?:vbaProject\.bin|activeX|oleObject)/i.test(normalized)) {
      findings.push({ type: "OFFICE_EMBEDDED_OBJECT", severity: "HIGH", message: "Office document contains an embedded object, macro, or ActiveX payload." });
    }
    if (/\/externalLinks\//i.test(normalized)) {
      findings.push({ type: "OFFICE_EXTERNAL_LINK", severity: "MEDIUM", message: "Office document contains external-link metadata." });
    }
    if (!selected.test(normalized) || !entry.data) continue;
    extractedBytes += entry.data.length;
    if (extractedBytes > MAX_EXTRACTED_TEXT_BYTES) {
      findings.push({ type: "OFFICE_TEXT_LIMIT", severity: "HIGH", message: "Extracted Office XML exceeds the 8 MiB inspection limit." });
      break;
    }
    text.push(decodeXml(entry.data.toString("utf8")));
  }
  if (!text.join("").trim()) findings.push({ type: "OFFICE_NO_INSPECTABLE_TEXT", severity: "HIGH", message: "No bounded, inspectable text was found in the Office document." });
  return { extractedText: text.join("\n").trim(), findings, entryCount: entries.length };
}

export function extractHtmlText(content: Buffer): { text: string; findings: PdfInspection["findings"] } {
  const source = content.toString("utf8");
  const findings: PdfInspection["findings"] = [];
  if (/<(?:script|iframe|object|embed|meta[^>]+http-equiv)\b/i.test(source)) {
    findings.push({ type: "HTML_ACTIVE_CONTENT", severity: "HIGH", message: "HTML contains script, frame, embedded object, or automatic navigation content." });
  }
  if (/style\s*=\s*["'][^"']*(?:display\s*:\s*none|font-size\s*:\s*0|opacity\s*:\s*0)/i.test(source)) {
    findings.push({ type: "HTML_HIDDEN_TEXT", severity: "HIGH", message: "HTML contains hidden-text styling." });
  }
  const text = decodeXml(source.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " "));
  return { text, findings };
}
