/**
 * SoterAI Extension - Multimodal Media Scanner
 * Scans images, audio, and video files for hidden attacks before they reach AI services.
 * 
 * Usage:
 *   const result = await scanMediaFile(file);
 *   if (result.isAttack) { blockUpload(result); }
 */

import {
  scanMedia,
  scanImage,
  scanAudio,
  scanVideo,
  detectMediaType,
  isScannableMediaType,
  getAttackTypeDescription,
  type MultimodalScanResult,
  type MultimodalFinding,
  type MultimodalMediaType,
} from "../../../../packages/detectors/src/multimodal";

// Re-export types for consumers
export type { MultimodalScanResult, MultimodalFinding, MultimodalMediaType };

// ============================================================================
// Configuration
// ============================================================================

export interface MultimodalScanConfig {
  /** Maximum file size to scan (default 50MB) */
  maxFileSizeBytes: number;
  /** Whether to block uploads that are detected as attacks */
  blockOnAttack: boolean;
  /** Minimum risk score to trigger a warning (0-100) */
  warnThreshold: number;
  /** Minimum risk score to block (0-100) */
  blockThreshold: number;
  /** Whether to scan audio files */
  scanAudio: boolean;
  /** Whether to scan video files */
  scanVideo: boolean;
  /** Whether to scan image files */
  scanImages: boolean;
}

const DEFAULT_CONFIG: MultimodalScanConfig = {
  maxFileSizeBytes: 50 * 1024 * 1024, // 50MB
  blockOnAttack: true,
  warnThreshold: 30,
  blockThreshold: 60,
  scanAudio: true,
  scanVideo: true,
  scanImages: true,
};

// ============================================================================
// File Scanning
// ============================================================================

/**
 * Scan a File object for multimodal attacks
 */
export async function scanMediaFile(
  file: File,
  config: Partial<MultimodalScanConfig> = {}
): Promise<MultimodalScanResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Check if file type is scannable
  if (!isScannableMediaType(file.type)) {
    return {
      mediaType: "image",
      isAttack: false,
      riskScore: 0,
      findings: [],
      scannedAt: new Date().toISOString(),
      processingTimeMs: 0,
    };
  }

  // Check file size
  if (file.size > cfg.maxFileSizeBytes) {
    return {
      mediaType: detectMediaTypeFromMime(file.type),
      isAttack: false,
      riskScore: 25, // Medium risk for oversized files
      findings: [{
        type: "IMAGE_EXIF_INJECTION",
        severity: "medium",
        confidence: 0.5,
        description: `File exceeds maximum scan size (${(file.size / 1024 / 1024).toFixed(1)}MB > ${(cfg.maxFileSizeBytes / 1024 / 1024).toFixed(0)}MB). Manual review recommended.`,
        evidence: `File size: ${file.size} bytes`,
      }],
      scannedAt: new Date().toISOString(),
      processingTimeMs: 0,
    };
  }

  // Read file bytes
  const startTime = Date.now();
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Detect media type
  const mediaType = detectMediaType(bytes) ?? detectMediaTypeFromMime(file.type);

  // Check if scanning is enabled for this type
  if (mediaType === "image" && !cfg.scanImages) {
    return createSkippedResult("image", startTime);
  }
  if (mediaType === "audio" && !cfg.scanAudio) {
    return createSkippedResult("audio", startTime);
  }
  if (mediaType === "video" && !cfg.scanVideo) {
    return createSkippedResult("video", startTime);
  }

  // Perform scan
  const result = scanMedia(bytes, file.type);

  return result;
}

/**
 * Scan a Blob for multimodal attacks
 */
export async function scanMediaBlob(
  blob: Blob,
  mimeType?: string,
  config: Partial<MultimodalScanConfig> = {}
): Promise<MultimodalScanResult> {
  const file = new File([blob], "media", { type: mimeType ?? blob.type });
  return scanMediaFile(file, config);
}

/**
 * Scan raw bytes for multimodal attacks
 */
export function scanMediaBytes(
  bytes: Uint8Array,
  mimeType?: string
): MultimodalScanResult {
  return scanMedia(bytes, mimeType);
}

// ============================================================================
// Audio Scanning (with Web Audio API decoding)
// ============================================================================

/**
 * Scan an audio file with full PCM analysis using Web Audio API
 */
export async function scanAudioFileDeep(
  file: File,
  config: Partial<MultimodalScanConfig> = {}
): Promise<MultimodalScanResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (!file.type.startsWith("audio/")) {
    return {
      mediaType: "audio",
      isAttack: false,
      riskScore: 0,
      findings: [],
      scannedAt: new Date().toISOString(),
      processingTimeMs: 0,
    };
  }

  const startTime = Date.now();

  try {
    // Decode audio using Web Audio API
    const audioContext = new AudioContext();
    const buffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(buffer);

    // Get PCM data (mono mixdown)
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const pcmData = new Float32Array(length);

    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        pcmData[i] += channelData[i] / numChannels;
      }
    }

    // Scan the PCM data
    const result = scanAudio(pcmData, sampleRate);

    // Close audio context
    await audioContext.close();

    return result;
  } catch (error) {
    // Fall back to byte-level scanning
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    return scanImage(bytes, file.type);
  }
}

// ============================================================================
// Integration with Extension Upload Interception
// ============================================================================

export interface UploadInterceptionResult {
  action: "allow" | "warn" | "block";
  scanResult: MultimodalScanResult;
  userMessage?: string;
}

/**
 * Determine action based on scan result
 */
export function determineUploadAction(
  result: MultimodalScanResult,
  config: Partial<MultimodalScanConfig> = {}
): UploadInterceptionResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (result.isAttack && cfg.blockOnAttack) {
    const criticalFindings = result.findings.filter(
      f => f.severity === "critical" || f.severity === "high"
    );
    const attackDescriptions = criticalFindings
      .map(f => getAttackTypeDescription(f.type))
      .join(", ");

    return {
      action: "block",
      scanResult: result,
      userMessage: `🚫 Upload blocked: Potential ${result.mediaType} attack detected (${attackDescriptions}). Risk score: ${result.riskScore}/100`,
    };
  }

  if (result.riskScore >= cfg.blockThreshold) {
    return {
      action: "block",
      scanResult: result,
      userMessage: `🚫 Upload blocked: High risk ${result.mediaType} detected. Risk score: ${result.riskScore}/100`,
    };
  }

  if (result.riskScore >= cfg.warnThreshold) {
    return {
      action: "warn",
      scanResult: result,
      userMessage: `⚠️ Warning: Suspicious content detected in ${result.mediaType}. Risk score: ${result.riskScore}/100. Review before uploading.`,
    };
  }

  return {
    action: "allow",
    scanResult: result,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function detectMediaTypeFromMime(mimeType: string): MultimodalMediaType {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "image";
}

function createSkippedResult(mediaType: MultimodalMediaType, startTime: number): MultimodalScanResult {
  return {
    mediaType,
    isAttack: false,
    riskScore: 0,
    findings: [],
    scannedAt: new Date().toISOString(),
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Format findings for display
 */
export function formatFindingsForDisplay(findings: MultimodalFinding[]): string[] {
  return findings.map(f => {
    const severityEmoji = {
      low: "ℹ️",
      medium: "⚠️",
      high: "🔴",
      critical: "🚨",
    }[f.severity];

    return `${severityEmoji} [${f.severity.toUpperCase()}] ${f.description}`;
  });
}

/**
 * Get risk level label from score
 */
export function getRiskLevel(riskScore: number): { label: string; color: string } {
  if (riskScore >= 80) return { label: "Critical", color: "#dc2626" };
  if (riskScore >= 60) return { label: "High", color: "#ea580c" };
  if (riskScore >= 40) return { label: "Medium", color: "#d97706" };
  if (riskScore >= 20) return { label: "Low", color: "#65a30d" };
  return { label: "Safe", color: "#16a34a" };
}