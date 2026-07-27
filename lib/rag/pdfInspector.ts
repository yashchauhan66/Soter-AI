import { MAX_DOCUMENT_PAGES } from "./fileValidation";
import { inflateSync } from "node:zlib";

export interface PdfInspection {
  pageCount: number;
  suspicious: boolean;
  findings: Array<{ type: string; severity: "MEDIUM" | "HIGH" | "CRITICAL"; message: string }>;
  extractedText: string;
  requiresOcr: boolean;
}

function decodePdfLiteral(value: string) {
  return value.replace(/\\([nrtbf()\\])/g, (_match, token: string) => ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" })[token] ?? token);
}

export function inspectPdf(content: Buffer): PdfInspection {
  if (content.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("Invalid PDF signature.");
  const source = content.toString("latin1");
  const findings: PdfInspection["findings"] = [];
  const decodedStreams: string[] = [];
  for (const match of source.matchAll(/<<(?:.|\r|\n)*?\/Filter\s*\/FlateDecode(?:.|\r|\n)*?>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try {
      decodedStreams.push(inflateSync(Buffer.from(match[1], "latin1"), { maxOutputLength: 5 * 1024 * 1024 }).toString("latin1"));
    } catch {
      findings.push({ type: "PDF_UNINSPECTABLE_STREAM", severity: "HIGH", message: "PDF contains a compressed stream that could not be safely inspected." });
    }
  }
  const inspectableSource = [source, ...decodedStreams].join("\n");
  const pageCount = Math.max(1, (source.match(/\/Type\s*\/Page\b/g) ?? []).length);
  if (pageCount > MAX_DOCUMENT_PAGES) findings.push({ type: "PDF_PAGE_LIMIT", severity: "HIGH", message: `PDF has ${pageCount} pages; limit is ${MAX_DOCUMENT_PAGES}.` });
  if (/\/JavaScript\b|\/JS\b|\/OpenAction\b|\/AA\b/i.test(inspectableSource)) findings.push({ type: "PDF_EMBEDDED_SCRIPT", severity: "CRITICAL", message: "PDF contains JavaScript or automatic-action markers." });
  if (/\/EmbeddedFile\b|\/Launch\b|\/RichMedia\b/i.test(inspectableSource)) findings.push({ type: "PDF_EMBEDDED_CONTENT", severity: "HIGH", message: "PDF contains embedded-file, launch, or rich-media markers." });
  if (/\/Encrypt\b/i.test(inspectableSource)) findings.push({ type: "PDF_ENCRYPTED", severity: "HIGH", message: "Encrypted PDFs are not processed by the document sandbox." });
  if (/\/Author\s*\([^)]*(?:ignore|instruction|system prompt)[^)]*\)/i.test(inspectableSource)) findings.push({ type: "PDF_SUSPICIOUS_METADATA", severity: "HIGH", message: "PDF metadata contains instruction-like content." });
  if (/\b(?:Tr\s+3|0\s+Tr)\b/.test(inspectableSource) && /(?:ignore|instruction|system prompt)/i.test(inspectableSource)) findings.push({ type: "PDF_HIDDEN_TEXT", severity: "HIGH", message: "PDF contains hidden rendering markers near instruction-like text." });
  const literalText = [...inspectableSource.matchAll(/\(((?:\\.|[^()\\]){2,})\)\s*Tj/g)].map((match) => decodePdfLiteral(match[1]));
  const arrayText = [...inspectableSource.matchAll(/\[((?:\s*\((?:\\.|[^()\\])*\)\s*)+)\]\s*TJ/g)].flatMap((match) => [...match[1].matchAll(/\((.*?)\)/g)].map((part) => decodePdfLiteral(part[1])));
  const extractedText = [...literalText, ...arrayText].join("\n").trim();
  return { pageCount, findings, suspicious: findings.some((finding) => finding.severity === "HIGH" || finding.severity === "CRITICAL"), extractedText, requiresOcr: extractedText.length < 20 };
}
