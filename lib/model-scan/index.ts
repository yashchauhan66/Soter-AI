/**
 * SoterAI Model Artifact Scanner — best-in-class, pure-TS model supply-chain
 * security. Detects code-execution risk in serialized model files, validates
 * safe formats, verifies integrity, and checks provenance/attestation binding.
 *
 *   import { scanModelArtifact } from "@/lib/model-scan";
 *   const report = scanModelArtifact(buffer, { filename: "pytorch_model.bin" });
 */
import { scanPickle, looksLikePickle, type PickleImport } from "./pickle";
import { classifyImport, isKnownSafeImport, highestSeverity, type Severity, type ImportFinding } from "./classify";
import { detectFormat, extractZipEntries, isLikelySafetensors, type ModelFormat } from "./formats";
import { verifyIntegrity, verifyProvenance, type IntegrityResult, type ProvenanceResult } from "./provenance";

export type { Severity } from "./classify";
export type { ModelFormat } from "./formats";
export { sha256 } from "./provenance";

export interface ScanFinding {
  id: string;
  severity: Severity;
  category: "MALICIOUS_CODE" | "UNSAFE_FORMAT" | "INTEGRITY" | "PROVENANCE" | "STRUCTURE";
  title: string;
  detail: string;
  location?: string;
}

export type Verdict = "SAFE" | "SUSPICIOUS" | "MALICIOUS" | "UNVERIFIED";

export interface ModelScanReport {
  filename: string | null;
  format: ModelFormat;
  sizeBytes: number;
  sha256: string;
  verdict: Verdict;
  riskScore: number; // 0–100
  highestSeverity: Severity;
  findings: ScanFinding[];
  imports: PickleImport[];
  integrity: IntegrityResult;
  provenance: ProvenanceResult | null;
  scannedEntries: string[];
  scannedAt: string;
  scannerVersion: string;
}

export interface ScanOptions {
  filename?: string;
  expectedSha256?: string | null;
  knownGoodHashes?: string[];
  /** SLSA / in-toto / Sigstore attestation (object or JSON string). */
  attestation?: unknown;
  /** ISO timestamp override (tests / determinism). */
  now?: string;
}

const SCANNER_VERSION = "1.0.0";
const SEVERITY_SCORE: Record<Severity, number> = { LOW: 10, MEDIUM: 40, HIGH: 75, CRITICAL: 100 };

let counter = 0;
function fid(prefix: string): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}-${counter}`;
}

function scanPickleRegion(buf: Buffer, location: string, findings: ScanFinding[], allImports: PickleImport[]): Severity {
  const result = scanPickle(buf);
  if (!result.isPickle && result.imports.length === 0) return "LOW";
  allImports.push(...result.imports);

  let worst: Severity = "LOW";
  const classified: ImportFinding[] = [];
  for (const imp of result.imports) {
    const c = classifyImport(imp);
    if (c) classified.push(c);
    else if (!isKnownSafeImport(imp)) {
      classified.push({ ...imp, severity: "MEDIUM", reason: `Imports unrecognized global ${imp.module}.${imp.name}.` });
    }
  }

  for (const c of classified) {
    worst = highestSeverity([worst, c.severity]);
    findings.push({
      id: fid("imp"),
      severity: c.severity,
      category: "MALICIOUS_CODE",
      title: `Dangerous pickle import: ${c.module}.${c.name}`,
      detail: c.reason + (result.ops.reduce ? " A REDUCE opcode is present, which invokes the imported callable." : ""),
      location,
    });
  }

  // REDUCE/BUILD with no dangerous import is common in real weights — info only.
  if (classified.length === 0 && (result.ops.reduce || result.ops.global || result.ops.stackGlobal)) {
    findings.push({
      id: fid("info"),
      severity: "LOW",
      category: "STRUCTURE",
      title: "Pickle uses object reconstruction",
      detail: "REDUCE/GLOBAL opcodes are present but only reference recognized ML libraries (numpy/torch). Typical for weight files.",
      location,
    });
  }

  if (!result.parsedFully && result.isPickle) {
    findings.push({
      id: fid("parse"),
      severity: "MEDIUM",
      category: "STRUCTURE",
      title: "Pickle stream could not be fully parsed",
      detail: "The opcode walker stopped before STOP — the file may be truncated, obfuscated, or use an unsupported opcode. Treat with caution.",
      location,
    });
    worst = highestSeverity([worst, "MEDIUM"]);
  }
  return worst;
}

export function scanModelArtifact(buf: Buffer, options: ScanOptions = {}): ModelScanReport {
  const filename = options.filename ?? null;
  const findings: ScanFinding[] = [];
  const allImports: PickleImport[] = [];
  const scannedEntries: string[] = [];
  const format = detectFormat(buf, filename ?? undefined);

  const integrity = verifyIntegrity(buf, {
    expectedSha256: options.expectedSha256,
    knownGoodHashes: options.knownGoodHashes,
  });

  // ── Integrity findings ──
  if (integrity.matchesExpected === false) {
    findings.push({
      id: fid("int"), severity: "CRITICAL", category: "INTEGRITY",
      title: "SHA-256 mismatch",
      detail: `Computed digest ${integrity.sha256} does not match the expected ${integrity.expectedSha256}. The artifact may have been tampered with or swapped.`,
    });
  }

  // ── Format-specific scanning ──
  switch (format) {
    case "pickle": {
      scanPickleRegion(buf, filename ?? "<pickle>", findings, allImports);
      findings.push({
        id: fid("fmt"), severity: "LOW", category: "UNSAFE_FORMAT",
        title: "Pickle-based format",
        detail: "This is a Python pickle, which can execute code on load. Prefer safetensors for distribution.",
      });
      break;
    }
    case "pytorch-zip":
    case "zip-unknown": {
      const entries = extractZipEntries(buf);
      let scannedAny = false;
      for (const e of entries) {
        if (!/\.(pkl|pickle)$/i.test(e.name) && e.name !== "data.pkl" && !/\/data\.pkl$/.test(e.name)) continue;
        scannedEntries.push(e.name);
        scannedAny = true;
        if (e.data) {
          scanPickleRegion(e.data, e.name, findings, allImports);
        } else {
          findings.push({
            id: fid("zip"), severity: "MEDIUM", category: "STRUCTURE",
            title: `Could not decompress ${e.name}`,
            detail: "The embedded pickle uses streaming/ZIP64 or an unsupported compression method. A raw heuristic scan was applied instead.",
            location: e.name,
          });
        }
      }
      // Fallback: heuristic raw scan if no pickle entry was decoded.
      if (!scannedAny || allImports.length === 0) {
        const region = findPickleStart(buf);
        if (region >= 0) {
          scanPickleRegion(buf.subarray(region), "<embedded>", findings, allImports);
          if (!scannedAny) scannedEntries.push("<heuristic>");
        }
      }
      findings.push({
        id: fid("fmt"), severity: "LOW", category: "UNSAFE_FORMAT",
        title: "PyTorch archive contains a pickle",
        detail: "PyTorch .pt/.bin archives embed a pickle (data.pkl) that executes on torch.load(). Use weights_only=True or convert to safetensors.",
      });
      break;
    }
    case "safetensors": {
      const ok = isLikelySafetensors(buf);
      findings.push({
        id: fid("st"),
        severity: ok ? "LOW" : "HIGH",
        category: ok ? "STRUCTURE" : "UNSAFE_FORMAT",
        title: ok ? "Safetensors format (no executable code)" : "Malformed safetensors header",
        detail: ok
          ? "Safetensors stores only tensors and a JSON header — it cannot execute code on load. Lowest supply-chain risk."
          : "The 8-byte header length is invalid or exceeds the file size. The file is corrupt or masquerading as safetensors.",
      });
      break;
    }
    case "numpy-npy": {
      // .npy with object dtype embeds a pickle; scan the body.
      const region = findPickleStart(buf);
      if (region >= 0) scanPickleRegion(buf.subarray(region), "<npy-object>", findings, allImports);
      break;
    }
    case "hdf5-keras": {
      findings.push({
        id: fid("h5"), severity: "MEDIUM", category: "UNSAFE_FORMAT",
        title: "HDF5/Keras model",
        detail: "Keras .h5 models can embed Lambda layers containing arbitrary marshalled Python. Review custom layers before loading.",
      });
      break;
    }
    case "gguf":
    case "onnx": {
      findings.push({
        id: fid("ok"), severity: "LOW", category: "STRUCTURE",
        title: `${format.toUpperCase()} format`,
        detail: `${format.toUpperCase()} is a data-only format with no Python code execution path on load.`,
      });
      break;
    }
    default: {
      // Unknown — still try to detect a pickle hiding inside.
      if (looksLikePickle(buf)) {
        scanPickleRegion(buf, filename ?? "<unknown>", findings, allImports);
      } else {
        findings.push({
          id: fid("unk"), severity: "MEDIUM", category: "STRUCTURE",
          title: "Unrecognized file format",
          detail: "Could not identify the model format. Manual review recommended before loading.",
        });
      }
    }
  }

  // ── Provenance ──
  let provenance: ProvenanceResult | null = null;
  if (options.attestation !== undefined) {
    provenance = verifyProvenance(options.attestation, integrity.sha256);
    if (provenance.subjectDigestBinds === false) {
      findings.push({
        id: fid("prov"), severity: "HIGH", category: "PROVENANCE",
        title: "Provenance does not cover this artifact",
        detail: provenance.issues.join(" "),
      });
    } else if (!provenance.present || !provenance.signaturePresent) {
      findings.push({
        id: fid("prov"), severity: "MEDIUM", category: "PROVENANCE",
        title: "Weak or missing provenance",
        detail: provenance.issues.join(" ") || "No signed attestation binds this artifact to a trusted builder.",
      });
    }
  }

  // ── Verdict & score ──
  const severities = findings.map((f) => f.severity);
  const highest = highestSeverity(severities.length ? severities : ["LOW"]);
  const malicious = findings.some((f) => f.category === "MALICIOUS_CODE" && (f.severity === "CRITICAL" || f.severity === "HIGH"));
  const tampered = integrity.matchesExpected === false;

  let riskScore = severities.reduce((acc, s) => Math.max(acc, SEVERITY_SCORE[s]), 0);
  // Pile-on for multiple high+ findings.
  const highCount = severities.filter((s) => s === "HIGH" || s === "CRITICAL").length;
  if (highCount > 1) riskScore = Math.min(100, riskScore + (highCount - 1) * 5);
  if (integrity.knownGood && !malicious && !tampered) riskScore = Math.min(riskScore, 5);

  let verdict: Verdict;
  if (malicious || tampered) verdict = "MALICIOUS";
  else if (highest === "HIGH") verdict = "SUSPICIOUS";
  else if (highest === "MEDIUM") verdict = "UNVERIFIED";
  else verdict = "SAFE";
  if (integrity.knownGood && !malicious && !tampered) verdict = "SAFE";

  return {
    filename,
    format,
    sizeBytes: buf.length,
    sha256: integrity.sha256,
    verdict,
    riskScore,
    highestSeverity: highest,
    findings,
    imports: allImports,
    integrity,
    provenance,
    scannedEntries,
    scannedAt: options.now ?? new Date().toISOString(),
    scannerVersion: SCANNER_VERSION,
  };
}

/** Locate the first plausible pickle start (PROTO marker) inside a buffer. */
function findPickleStart(buf: Buffer): number {
  for (let i = 0; i < Math.min(buf.length - 1, 50_000_000); i++) {
    if (buf[i] === 0x80 && buf[i + 1] >= 1 && buf[i + 1] <= 5) return i;
  }
  return -1;
}
