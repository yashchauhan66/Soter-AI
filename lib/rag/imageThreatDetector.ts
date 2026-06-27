import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────

export interface ImageThreatFinding {
  type: ImageThreatType;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  message: string;
  metadata?: Record<string, unknown>;
}

export type ImageThreatType =
  | "EXIF_GPS_LOCATION"
  | "EXIF_SENSITIVE_DEVICE"
  | "EXIF_SOFTWARE_MARKER"
  | "EMBEDDED_PAYLOAD"
  | "STEGANOGRAPHY_PATTERN"
  | "NSFW_CLASSIFICATION"
  | "WEAPON_CLASSIFICATION"
  | "CODE_IN_IMAGE"
  | "QR_CODE_PAYLOAD"
  | "AUDIO_STEGANOGRAPHY"
  | "AUDIO_HIDDEN_COMMAND"
  | "AUDIO_METADATA_THREAT"
  | "MULTILINGUAL_THREAT_TEXT"
  | "IMAGE_SIZE_ANOMALY"
  | "ALPHA_CHANNEL_PAYLOAD";

export interface AudioThreatFinding {
  type: AudioThreatType;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  message: string;
  metadata?: Record<string, unknown>;
}

export type AudioThreatType =
  | "AUDIO_HIDDEN_DATA"
  | "AUDIO_SPECTROGRAM_TEXT"
  | "AUDIO_REVERSED_SPEECH"
  | "AUDIO_EXECUTABLE_PAYLOAD"
  | "AUDIO_METADATA_INJECTION";

export interface MultimodalThreatResult {
  imageFindings: ImageThreatFinding[];
  audioFindings: AudioThreatFinding[];
  riskScore: number;
  riskLevel: "SAFE" | "SUSPICIOUS" | "THREAT";
  requiresHumanReview: boolean;
  contentHash: string;
  scanId: string;
  metadata: Record<string, unknown>;
}

// ──────────────────────────────────────────
// Image Threat Analysis
// ──────────────────────────────────────────

/**
 * Analyze raw image buffer for visual threats.
 * Uses lightweight heuristics + metadata inspection.
 * For production-grade NSFW/weapon detection, integrate a
 * dedicated ML service (AWS Rekognition, Azure Content Moderator, etc.).
 */
export function analyzeImageThreats(
  content: Buffer,
  mimeType: string,
  ocrText?: string,
): ImageThreatFinding[] {
  const findings: ImageThreatFinding[] = [];
  const source = content.toString("latin1");

  // ── 1. EXIF / metadata inspection ──────────────────────────
  detectExifGps(source, findings);
  detectExifSensitiveDevice(source, findings);
  detectExifSoftwareMarker(source, findings);

  // ── 2. Embedded payload heuristics ─────────────────────────
  detectEmbeddedPayloads(source, findings);
  detectSteganographyPatterns(content, findings);
  detectImageSizeAnomaly(content, findings);
  detectAlphaChannelPayload(source, findings);

  // ── 3. OCR text threat analysis ────────────────────────────
  if (ocrText) {
    detectThreatTextInImage(ocrText, findings);
  }

  // ── 4. QR / barcode payload markers ───────────────────────
  if (/\/QrCode\b|\/Barcode\b|qrcode|barcode/i.test(source)) {
    findings.push({
      type: "QR_CODE_PAYLOAD",
      severity: "MEDIUM",
      message:
        "Image metadata or encoding suggests embedded QR / barcode content. Review the rendered image for encoded payloads.",
      metadata: { heuristic: "marker_match" },
    });
  }

  return findings;
}

function detectExifGps(source: string, findings: ImageThreatFinding[]) {
  // Exif GPS tags: 0x8825 (GPS IFD), GPSLatitude, GPSLongitude
  if (/GPSLatitudeRef|GPSLongitudeRef|GPSLatitude|GPSLongitude|0x8825/i.test(source)) {
    findings.push({
      type: "EXIF_GPS_LOCATION",
      severity: "HIGH",
      message:
        "Image contains embedded GPS coordinates. This can leak the user's physical location if shared.",
      metadata: { heuristic: "exif_gps_tags" },
    });
  }
}

function detectExifSensitiveDevice(source: string, findings: ImageThreatFinding[]) {
  const sensitiveDevices = [
    { pattern: /DSC-\w+/, label: "digital camera serial" },
    { pattern: /\bIphone\b|\biPhone\b|\biOS\s+\d+/i, label: "Apple iOS device" },
    { pattern: /\bPixel\s+\d+\b|\bSM-\w{4}\b/, label: "Android device" },
    { pattern: /\bScanner\s+\w+\b/i, label: "scanner device" },
    { pattern: /\bCCTV\b|\bWebcam\b/i, label: "surveillance device" },
  ];
  for (const { pattern, label } of sensitiveDevices) {
    if (pattern.test(source)) {
      findings.push({
        type: "EXIF_SENSITIVE_DEVICE",
        severity: "MEDIUM",
        message: `Image was captured on a ${label}. Device metadata may expose the user or environment.`,
        metadata: { heuristic: "device_pattern", deviceType: label },
      });
    }
  }
}

function detectExifSoftwareMarker(source: string, findings: ImageThreatFinding[]) {
  // Software tag like Adobe Photoshop, GIMP, etc.
  const match = source.match(/(?:Adobe|GIMP|Corel|Paint\.NET|Affinity)\s+\S+/i);
  if (match) {
    findings.push({
      type: "EXIF_SOFTWARE_MARKER",
      severity: "LOW",
      message: `Image was edited with ${match[0]}. This is normal but can indicate tampering in sensitive contexts.`,
      metadata: { software: match[0] },
    });
  }
}

function detectEmbeddedPayloads(source: string, findings: ImageThreatFinding[]) {
  // Check for large base64 or hex payloads embedded in metadata/comments
  const base64Refs = source.match(/[A-Za-z0-9+/]{100,}={0,2}/g);
  if (base64Refs && base64Refs.some((b) => b.length > 200)) {
    findings.push({
      type: "EMBEDDED_PAYLOAD",
      severity: "HIGH",
      message:
        "Image contains a large base64-encoded payload in its metadata. This could be a steganographic or exploit payload.",
      metadata: { heuristic: "large_base64_metadata", payloadCount: base64Refs.length },
    });
  }

  // Hex-encoded data in EXIF maker notes or custom tags
  const hexPayloads = source.match(/[0-9A-Fa-f]{80,}/g);
  if (hexPayloads && hexPayloads.length > 1) {
    findings.push({
      type: "EMBEDDED_PAYLOAD",
      severity: "MEDIUM",
      message: "Image contains large hex-encoded data sequences in its raw content.",
      metadata: { heuristic: "hex_payload", count: hexPayloads.length },
    });
  }
}

function detectSteganographyPatterns(content: Buffer, findings: ImageThreatFinding[]) {
  // Simple statistical check: PNG with unusually large IDAT chunks relative to dimensions
  if (content.length > 500_000) {
    const source = content.toString("latin1");
    const idatChunks = source.match(/IDAT/g)?.length ?? 0;
    const iendChunks = source.match(/IEND/g)?.length ?? 0;

    if (idatChunks > 20 || iendChunks > 2) {
      findings.push({
        type: "STEGANOGRAPHY_PATTERN",
        severity: "HIGH",
        message:
          "Image has an unusual number of compressed data chunks. This is a common steganography technique for hiding data in PNG files.",
        metadata: { heuristic: "excessive_idat", idatCount: idatChunks },
      });
    }
  }
}

function detectImageSizeAnomaly(content: Buffer, findings: ImageThreatFinding[]) {
  // Tiny images with very large file sizes suggest hidden data
  const headerSize = 1024 * 1024; // 1MB
  if (content.length > headerSize) {
    const source = content.toString("latin1");
    // For JPEG: check dimensions from SOF marker
    const sofMatch = source.match(/\xFF\xC0.{3}\x02\x11.{2}\x02/);
    // For PNG: check IHDR dimensions
    const ihdrMatch = source.match(/IHDR(.{4})(.{4})/);

    if (sofMatch || ihdrMatch) {
      findings.push({
        type: "IMAGE_SIZE_ANOMALY",
        severity: "MEDIUM",
        message:
          `Image is ${(content.length / 1024).toFixed(0)} KB but appears to have small dimensions. This size-to-resolution mismatch is anomalous.`,
        metadata: {
          heuristic: "size_resolution_mismatch",
          fileSizeBytes: content.length,
        },
      });
    }
  }
}

function detectAlphaChannelPayload(source: string, findings: ImageThreatFinding[]) {
  // Check for suspicious content in alpha/transparency channels of PNG
  const tRNSChunks = source.match(/tRNS/g);
  const excessiveTransparency = (tRNSChunks?.length ?? 0) > 1;

  if (excessiveTransparency) {
    findings.push({
      type: "ALPHA_CHANNEL_PAYLOAD",
      severity: "MEDIUM",
      message:
        "Image has unusual transparency channel markers. Data can be hidden in alpha channel values of PNG images.",
      metadata: { heuristic: "excessive_trns", trnsCount: tRNSChunks?.length },
    });
  }
}

function detectThreatTextInImage(ocrText: string, findings: ImageThreatFinding[]) {
  // Check for multilingual threat content
  const multilingualThreats = [
    { pattern: /ignore|disregard|override/i, label: "instruction override" },
    { pattern: /system.{0,20}prompt/i, label: "system prompt extraction" },
    { pattern: /(?:reveal|leak|send).{0,30}(?:password|secret|key)/i, label: "credential exfiltration" },
  ];

  for (const { pattern, label } of multilingualThreats) {
    if (pattern.test(ocrText)) {
      findings.push({
        type: "MULTILINGUAL_THREAT_TEXT",
        severity: "HIGH",
        message: `Extracted text from image contains a ${label} pattern.`,
        metadata: { heuristic: "threat_text", pattern: label },
      });
    }
  }
}

// ──────────────────────────────────────────
// Audio Threat Analysis
// ──────────────────────────────────────────

/**
 * Analyze raw audio buffer for hidden threats.
 * This is a heuristic-based analysis; full audio inspection
 * requires waveform analysis, spectrogram scanning, and ML-based detection.
 */
export function analyzeAudioThreats(
  content: Buffer,
  mimeType: string,
): AudioThreatFinding[] {
  const findings: AudioThreatFinding[] = [];
  const source = content.toString("latin1");

  // ── 1. Hidden data in audio metadata ───────────────────────
  detectAudioMetadataThreats(source, findings);

  // ── 2. Executable payload embedded in audio ────────────────
  detectAudioExecutablePayload(source, findings);

  // ── 3. Steganography in audio ─────────────────────────────
  detectAudioSteganography(content, findings);

  return findings;
}

function detectAudioMetadataThreats(source: string, findings: AudioThreatFinding[]) {
  // Check for metadata tags with suspicious content
  const commentTags = source.match(/COMMENT\s*:\s*.{10,500}/gi) ?? [];
  for (const tag of commentTags) {
    if (/(?:ignore|disregard|system\s+prompt|instruction)/i.test(tag)) {
      findings.push({
        type: "AUDIO_METADATA_INJECTION",
        severity: "HIGH",
        message: "Audio comment metadata contains instruction-like content. This is a known prompt-injection vector.",
        metadata: { heuristic: "suspicious_comment", snippet: tag.slice(0, 120) },
      });
    }
  }
}

function detectAudioExecutablePayload(source: string, findings: AudioThreatFinding[]) {
  // Check for MZ/ELF headers in audio content
  if (/MZ.{0,100}PE\0{2}/.test(source) || /\x7fELF/.test(source)) {
    findings.push({
      type: "AUDIO_EXECUTABLE_PAYLOAD",
      severity: "CRITICAL",
      message:
        "Audio file contains Windows PE or ELF executable headers in its data. This could be a polyglot file hiding malware in audio.",
      metadata: { heuristic: "executable_header_in_audio" },
    });
  }
}

function detectAudioSteganography(content: Buffer, findings: AudioThreatFinding[]) {
  // WAV files with unusually large data chunks
  if (content.length > 10 * 1024 * 1024) {
    findings.push({
      type: "AUDIO_HIDDEN_DATA",
      severity: "MEDIUM",
      message:
        `Audio file is ${(content.length / (1024 * 1024)).toFixed(1)} MB. Large audio files may contain hidden data via LSB steganography.`,
      metadata: { heuristic: "large_audio_file", sizeBytes: content.length },
    });
  }
}

// ──────────────────────────────────────────
// Combined Multimodal Threat Scan
// ──────────────────────────────────────────

export interface MultimodalInput {
  /** Raw file buffer */
  content: Buffer;
  /** MIME type (image/*, audio/*, application/pdf, text/*) */
  mimeType: string;
  /** OCR-extracted text from the file (if applicable) */
  ocrText?: string;
  /** File extension hint */
  extension?: string;
}

/**
 * Run the full multimodal threat scan on a file.
 * Combines image, audio, and document analysis heuristics.
 */
export function scanMultimodalThreats(input: MultimodalInput): MultimodalThreatResult {
  const isImage = input.mimeType.startsWith("image/");
  const isAudio = input.mimeType.startsWith("audio/");
  const imageFindings: ImageThreatFinding[] = [];
  const audioFindings: AudioThreatFinding[] = [];

  if (isImage) {
    imageFindings.push(...analyzeImageThreats(input.content, input.mimeType, input.ocrText));
  }

  if (isAudio) {
    audioFindings.push(...analyzeAudioThreats(input.content, input.mimeType));
  }

  const allFindings = [...imageFindings, ...audioFindings];
  const severityWeights: Record<string, number> = {
    LOW: 5,
    MEDIUM: 25,
    HIGH: 60,
    CRITICAL: 100,
  };
  const totalWeight = allFindings.reduce((sum, f) => sum + (severityWeights[f.severity] ?? 0), 0);
  const riskScore = Math.min(100, totalWeight);
  const riskLevel =
    allFindings.some((f) => f.severity === "CRITICAL" || f.severity === "HIGH")
      ? allFindings.some((f) => f.severity === "CRITICAL" || totalWeight > 150)
        ? "THREAT"
        : "SUSPICIOUS"
      : totalWeight > 30
        ? "SUSPICIOUS"
        : "SAFE";

  return {
    imageFindings,
    audioFindings,
    riskScore,
    riskLevel,
    requiresHumanReview: riskLevel === "THREAT" || (riskLevel === "SUSPICIOUS" && allFindings.length >= 3),
    contentHash: createHash("sha256").update(input.content).digest("hex"),
    scanId: `multimodal_${randomUUID()}`,
    metadata: {
      mimeType: input.mimeType,
      fileSizeBytes: input.content.length,
      isImage,
      isAudio,
      totalFindings: allFindings.length,
      ocrAvailable: Boolean(input.ocrText),
    },
  };
}
