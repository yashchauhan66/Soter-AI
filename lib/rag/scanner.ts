import { createHash } from "crypto";
import { analyzeText } from "../guard/analyze";

export interface RagScanFindingResult {
  type: string;
  severity: string;
  message: string;
  redactedSnippet?: string;
  chunkIndex: number;
}

export interface ScannedChunk {
  chunkIndex: number;
  textRedacted: string;
  hash: string;
  riskScore: number;
  riskTypes: string[];
  metadata: Record<string, unknown>;
}

export interface RagScanResult {
  hash: string;
  trustScore: number;
  riskScore: number;
  riskTypes: string[];
  findings: RagScanFindingResult[];
  chunks: ScannedChunk[];
  quarantine: boolean;
  status: "SAFE" | "QUARANTINED";
}

const documentInjectionRules = [
  { type: "DOCUMENT_PROMPT_INJECTION", pattern: /(?:ignore|disregard) (?:all |the )?(?:previous|system) instructions?/i, message: "Document contains an instruction override." },
  { type: "DOCUMENT_PROMPT_INJECTION", pattern: /(?:override|replace) (?:assistant|system) rules?/i, message: "Document attempts to replace assistant rules." },
  { type: "PRIVATE_DATA_EXFILTRATION", pattern: /(?:reveal|exfiltrate|send) (?:private |confidential )?(?:data|documents?|context)(?: to)?/i, message: "Document requests private data disclosure." },
  { type: "EXTERNAL_EXFILTRATION", pattern: /send (?:data|context|documents?) to https?:\/\//i, message: "Document requests transmission to an external URL." },
  { type: "SUSPICIOUS_TOOL_INSTRUCTION", pattern: /(?:call|invoke|run|execute) (?:the )?(?:tool|function|shell|command)/i, message: "Document contains suspicious tool instructions." },
  { type: "HIDDEN_INSTRUCTION", pattern: /(?:<!--[^>]*(?:ignore|instruction|system)[^>]*-->|display\s*:\s*none|font-size\s*:\s*0)/i, message: "Document contains hidden instruction markers or hidden text." },
  { type: "DECEPTIVE_TRUST_CLAIM", pattern: /tell (?:the )?user (?:that )?this document is safe/i, message: "Document attempts to manufacture a trust decision." },
  { type: "SUSPICIOUS_BASE64", pattern: /(?:instruction|prompt|execute).{0,40}\b[A-Za-z0-9+/]{80,}={0,2}\b/i, message: "Document includes a base64-like payload near instruction text." },
];

export function chunkDocument(text: string, maxChars = 1800): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const paragraphs = normalized.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > maxChars) { chunks.push(current); current = ""; }
    if (paragraph.length > maxChars) {
      if (current) { chunks.push(current); current = ""; }
      for (let offset = 0; offset < paragraph.length; offset += maxChars) chunks.push(paragraph.slice(offset, offset + maxChars));
    } else current += `${current ? "\n\n" : ""}${paragraph}`;
  }
  if (current) chunks.push(current);
  return chunks;
}

function safeSnippet(text: string, redactedText: string, index: number) {
  const source = redactedText || text;
  return source.slice(Math.max(0, index - 60), Math.min(source.length, index + 180)).replace(/\s+/g, " ");
}

export function scanRagDocument(text: string): RagScanResult {
  const findings: RagScanFindingResult[] = [];
  const chunks = chunkDocument(text).map((chunk, chunkIndex) => {
    const guard = analyzeText(chunk, "INPUT");
    const textRedacted = guard.redactedText ?? chunk;
    for (const finding of guard.findings) {
      findings.push({ type: finding.type, severity: finding.severity, message: finding.message, redactedSnippet: safeSnippet(chunk, textRedacted, finding.start ?? 0), chunkIndex });
    }
    for (const rule of documentInjectionRules) {
      const match = chunk.match(rule.pattern);
      if (match?.index !== undefined) findings.push({ type: rule.type, severity: "HIGH", message: rule.message, redactedSnippet: safeSnippet(chunk, textRedacted, match.index), chunkIndex });
    }
    const extraTypes = findings.filter((item) => item.chunkIndex === chunkIndex).map((item) => item.type);
    const injectionCount = extraTypes.filter((type) => type.startsWith("DOCUMENT_") || type.includes("EXFILTRATION") || type === "HIDDEN_INSTRUCTION").length;
    return {
      chunkIndex,
      textRedacted,
      hash: createHash("sha256").update(textRedacted).digest("hex"),
      riskScore: Math.min(100, guard.riskScore + injectionCount * 35),
      riskTypes: [...new Set([...guard.riskTypes.filter((type) => type !== "LOW_RISK"), ...extraTypes])],
      metadata: { findingCount: guard.findings.length + injectionCount },
    };
  });
  const riskScore = chunks.reduce((max, chunk) => Math.max(max, chunk.riskScore), 0);
  const riskTypes = [...new Set(chunks.flatMap((chunk) => chunk.riskTypes))];
  const quarantine = riskScore >= 50 || riskTypes.some((type) => ["SECRET_DETECTED", "DOCUMENT_PROMPT_INJECTION", "PRIVATE_DATA_EXFILTRATION", "EXTERNAL_EXFILTRATION", "HIDDEN_INSTRUCTION"].includes(type));
  return {
    hash: createHash("sha256").update(text).digest("hex"),
    trustScore: Math.max(0, 100 - riskScore),
    riskScore,
    riskTypes,
    findings,
    chunks,
    quarantine,
    status: quarantine ? "QUARANTINED" : "SAFE",
  };
}

export async function extractDocumentText(input: { fileType: string; content: Buffer }) {
  const type = input.fileType.toLowerCase();
  if (type === "text/plain" || type === "text/markdown" || type.endsWith(".txt") || type.endsWith(".md")) return input.content.toString("utf8");
  if (type === "application/pdf" || type.endsWith(".pdf")) {
    const printable = input.content.toString("latin1").match(/[\x20-\x7E]{8,}/g)?.join("\n") ?? "";
    if (!printable.trim()) throw new Error("This PDF has no extractable text. Use the document sandbox OCR pipeline.");
    return printable;
  }
  throw new Error("Use the document sandbox for OCR image and scanned PDF support.");
}
