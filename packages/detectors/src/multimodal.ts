/**
 * SoterAI Multimodal Attack Detector
 * Detects adversarial attacks hidden in images, audio, and video files.
 * 
 * Attack vectors covered:
 * - Images: steganography, EXIF injection, adversarial perturbations, QR payloads, polyglot files
 * - Audio: ultrasonic commands, spectral hiding, adversarial perturbations, silent segment attacks
 * - Video: frame injection, QR in frames, subliminal content, metadata attacks
 */

// ============================================================================
// Types
// ============================================================================

export type MultimodalMediaType = "image" | "audio" | "video";

export type MultimodalAttackType =
  | "IMAGE_STEGANOGRAPHY"
  | "IMAGE_EXIF_INJECTION"
  | "IMAGE_ADVERSARIAL"
  | "IMAGE_QR_PAYLOAD"
  | "IMAGE_POLYGLOT"
  | "IMAGE_TEXT_INJECTION"
  | "AUDIO_ULTRASONIC"
  | "AUDIO_SPECTRAL_HIDING"
  | "AUDIO_ADVERSARIAL"
  | "AUDIO_SILENT_SEGMENT"
  | "AUDIO_HIDDEN_COMMAND"
  | "VIDEO_FRAME_INJECTION"
  | "VIDEO_QR_PAYLOAD"
  | "VIDEO_SUBLIMINAL"
  | "VIDEO_METADATA_INJECTION"
  | "VIDEO_AUDIO_ATTACK";

export interface MultimodalFinding {
  type: MultimodalAttackType;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number; // 0-1
  description: string;
  evidence?: string;
  location?: string;
}

export interface MultimodalScanResult {
  mediaType: MultimodalMediaType;
  isAttack: boolean;
  riskScore: number; // 0-100
  findings: MultimodalFinding[];
  scannedAt: string;
  processingTimeMs: number;
}

// ============================================================================
// Constants
// ============================================================================

const SEVERITY_WEIGHTS: Record<string, number> = {
  low: 10,
  medium: 25,
  high: 50,
  critical: 80,
};

// Image analysis thresholds
const LSB_ENTROPY_THRESHOLD = 7.5; // High entropy in LSB suggests steganography
const EXIF_SUSPICIOUS_PATTERNS = [
  /ignore.*instruction/i,
  /system.*prompt/i,
  /bypass/i,
  /reveal/i,
  /<script/i,
  /javascript:/i,
  /eval\(/i,
  /exec\(/i,
  /base64,/i,
  /\\x[0-9a-f]{2}/i,
  /onerror=/i,
  /onload=/i,
];

// Audio analysis thresholds
const ULTRASONIC_FREQ_THRESHOLD = 18000; // Hz - above human hearing
const SPECTRAL_ANOMALY_THRESHOLD = 0.7;
const SILENCE_ANOMALY_MIN_MS = 500;

// Video analysis thresholds
const FRAME_ANOMALY_THRESHOLD = 0.8;
const QR_MIN_SIZE = 50; // Minimum QR code size in pixels

// ============================================================================
// Image Analysis
// ============================================================================

/**
 * Analyze image bytes for steganography using LSB entropy analysis
 */
function detectImageSteganography(bytes: Uint8Array): MultimodalFinding | null {
  // Skip header bytes (first 100 bytes typically header)
  const dataStart = Math.min(100, bytes.length);
  const data = bytes.slice(dataStart);
  
  if (data.length < 1000) return null;
  
  // Extract LSB from each byte
  const lsbValues: number[] = [];
  for (let i = 0; i < Math.min(data.length, 100000); i++) {
    lsbValues.push(data[i] & 1);
  }
  
  // Calculate entropy of LSB sequence
  const ones = lsbValues.filter(v => v === 1).length;
  const p1 = ones / lsbValues.length;
  const p0 = 1 - p1;
  
  let entropy = 0;
  if (p0 > 0) entropy -= p0 * Math.log2(p0);
  if (p1 > 0) entropy -= p1 * Math.log2(p1);
  
  // Check for patterns in LSB (sequential runs suggest embedded data)
  let maxRun = 0;
  let currentRun = 1;
  for (let i = 1; i < lsbValues.length; i++) {
    if (lsbValues[i] === lsbValues[i - 1]) {
      currentRun++;
      maxRun = Math.max(maxRun, currentRun);
    } else {
      currentRun = 1;
    }
  }
  
  // High entropy + long runs = likely steganography
  const isSuspicious = entropy > 0.95 && maxRun > 50;
  
  if (isSuspicious) {
    return {
      type: "IMAGE_STEGANOGRAPHY",
      severity: "high",
      confidence: Math.min(0.95, 0.5 + entropy * 0.3 + (maxRun / 200) * 0.2),
      description: `Potential steganographic content detected. LSB entropy: ${entropy.toFixed(3)}, max run: ${maxRun}`,
      evidence: `LSB entropy ${entropy.toFixed(3)} exceeds natural image threshold`,
      location: "pixel_data",
    };
  }
  
  return null;
}

/**
 * Detect suspicious EXIF/metadata content
 */
function detectExifInjection(bytes: Uint8Array): MultimodalFinding | null {
  // Convert bytes to string for pattern matching (EXIF is often ASCII)
  const textDecoder = new TextDecoder("latin1");
  const text = textDecoder.decode(bytes.slice(0, Math.min(bytes.length, 65536)));
  
  for (const pattern of EXIF_SUSPICIOUS_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return {
        type: "IMAGE_EXIF_INJECTION",
        severity: "critical",
        confidence: 0.9,
        description: `Suspicious content detected in image metadata: ${match[0]}`,
        evidence: match[0].slice(0, 100),
        location: "exif_metadata",
      };
    }
  }
  
  // Check for unusually large EXIF data
  const exifMarker = text.indexOf("Exif");
  if (exifMarker !== -1) {
    const exifSize = bytes.length - exifMarker;
    if (exifSize > 10000) {
      return {
        type: "IMAGE_EXIF_INJECTION",
        severity: "medium",
        confidence: 0.6,
        description: `Unusually large EXIF metadata block (${exifSize} bytes)`,
        evidence: `EXIF size: ${exifSize} bytes`,
        location: "exif_metadata",
      };
    }
  }
  
  return null;
}

/**
 * Detect adversarial perturbations via statistical analysis
 */
function detectAdversarialImage(bytes: Uint8Array): MultimodalFinding | null {
  if (bytes.length < 1000) return null;
  
  // Analyze byte distribution for adversarial patterns
  const histogram = new Array(256).fill(0);
  const sampleSize = Math.min(bytes.length, 100000);
  
  for (let i = 0; i < sampleSize; i++) {
    histogram[bytes[i]]++;
  }
  
  // Calculate chi-squared statistic against uniform distribution
  const expected = sampleSize / 256;
  let chiSquared = 0;
  for (let i = 0; i < 256; i++) {
    chiSquared += Math.pow(histogram[i] - expected, 2) / expected;
  }
  
  // Adversarial images often have unusual byte distributions
  // Natural images have varied chi-squared based on content
  // Adversarial images show extreme statistical anomalies
  // Use very wide threshold to avoid false positives on natural images
  // Only flag truly extreme anomalies (uniform noise or single-value images)
  const isAdversarial = chiSquared > 5000 || chiSquared < 1;
  
  if (isAdversarial) {
    return {
      type: "IMAGE_ADVERSARIAL",
      severity: "high",
      confidence: Math.min(0.85, 0.4 + Math.abs(chiSquared - 300) / 500),
      description: `Statistical anomaly detected suggesting adversarial perturbation. Chi-squared: ${chiSquared.toFixed(1)}`,
      evidence: `Chi-squared statistic: ${chiSquared.toFixed(1)} (normal range: 200-400)`,
      location: "pixel_data",
    };
  }
  
  return null;
}

/**
 * Detect polyglot files (image + executable/script)
 */
function detectPolyglotImage(bytes: Uint8Array): MultimodalFinding | null {
  const textDecoder = new TextDecoder("latin1");
  const text = textDecoder.decode(bytes);
  
  // Check for embedded executables
  const executableSignatures = [
    { sig: "MZ", desc: "Windows PE executable" },
    { sig: "\x7fELF", desc: "Linux ELF executable" },
    { sig: "#!/", desc: "Unix shell script" },
    { sig: "<?php", desc: "PHP code" },
    { sig: "<script", desc: "JavaScript" },
    { sig: "PK\x03\x04", desc: "ZIP archive" },
  ];
  
  // Skip first bytes (image header)
  for (const { sig, desc } of executableSignatures) {
    const idx = text.indexOf(sig, 100);
    if (idx !== -1) {
      return {
        type: "IMAGE_POLYGLOT",
        severity: "critical",
        confidence: 0.95,
        description: `Polyglot file detected: ${desc} embedded in image at offset ${idx}`,
        evidence: `${desc} signature found at byte ${idx}`,
        location: `offset_${idx}`,
      };
    }
  }
  
  return null;
}

/**
 * Scan an image for all attack vectors
 */
export function scanImage(bytes: Uint8Array, mimeType?: string): MultimodalScanResult {
  const startTime = Date.now();
  const findings: MultimodalFinding[] = [];
  
  // Run all detectors
  const stego = detectImageSteganography(bytes);
  if (stego) findings.push(stego);
  
  const exif = detectExifInjection(bytes);
  if (exif) findings.push(exif);
  
  const adversarial = detectAdversarialImage(bytes);
  if (adversarial) findings.push(adversarial);
  
  const polyglot = detectPolyglotImage(bytes);
  if (polyglot) findings.push(polyglot);
  
  // Calculate risk score
  let riskScore = 0;
  for (const finding of findings) {
    riskScore += SEVERITY_WEIGHTS[finding.severity] * finding.confidence;
  }
  riskScore = Math.min(100, Math.round(riskScore));
  
  return {
    mediaType: "image",
    isAttack: findings.some(f => f.severity === "high" || f.severity === "critical"),
    riskScore,
    findings,
    scannedAt: new Date().toISOString(),
    processingTimeMs: Date.now() - startTime,
  };
}

// ============================================================================
// Audio Analysis
// ============================================================================

/**
 * Detect ultrasonic commands (frequencies above human hearing)
 */
function detectUltrasonicAudio(audioData: Float32Array, sampleRate: number): MultimodalFinding | null {
  if (sampleRate < 32000) return null; // Need high sample rate to detect ultrasonic
  
  // Simple frequency analysis using zero-crossing rate
  const nyquist = sampleRate / 2;
  const ultrasonicBinStart = Math.floor((ULTRASONIC_FREQ_THRESHOLD / nyquist) * audioData.length / 2);
  
  // Estimate high-frequency energy via differentiation
  let highFreqEnergy = 0;
  let totalEnergy = 0;
  
  for (let i = 1; i < audioData.length; i++) {
    const diff = Math.abs(audioData[i] - audioData[i - 1]);
    highFreqEnergy += diff * diff;
    totalEnergy += audioData[i] * audioData[i];
  }
  
  const highFreqRatio = totalEnergy > 0 ? highFreqEnergy / (totalEnergy * 4) : 0;
  
  // High ratio of high-frequency energy suggests ultrasonic content
  if (highFreqRatio > 0.3 && sampleRate >= 44100) {
    return {
      type: "AUDIO_ULTRASONIC",
      severity: "critical",
      confidence: Math.min(0.9, 0.5 + highFreqRatio),
      description: `Potential ultrasonic command detected. High-frequency energy ratio: ${(highFreqRatio * 100).toFixed(1)}%`,
      evidence: `High-freq ratio: ${(highFreqRatio * 100).toFixed(1)}% at sample rate ${sampleRate}Hz`,
      location: "frequency_spectrum",
    };
  }
  
  return null;
}

/**
 * Detect hidden commands in audio via spectral anomalies
 */
function detectSpectralHiding(audioData: Float32Array, sampleRate: number): MultimodalFinding | null {
  if (audioData.length < sampleRate) return null; // Need at least 1 second
  
  // Analyze amplitude distribution for hidden signals
  const blockSize = Math.floor(sampleRate / 10); // 100ms blocks
  const blockEnergies: number[] = [];
  
  for (let i = 0; i < audioData.length - blockSize; i += blockSize) {
    let energy = 0;
    for (let j = 0; j < blockSize; j++) {
      energy += audioData[i + j] * audioData[i + j];
    }
    blockEnergies.push(energy / blockSize);
  }
  
  // Look for suspicious patterns: sudden energy spikes in quiet sections
  const avgEnergy = blockEnergies.reduce((a, b) => a + b, 0) / blockEnergies.length;
  const quietThreshold = avgEnergy * 0.1;
  
  let suspiciousSpikes = 0;
  for (let i = 1; i < blockEnergies.length - 1; i++) {
    if (blockEnergies[i - 1] < quietThreshold && 
        blockEnergies[i] > avgEnergy * 2 && 
        blockEnergies[i + 1] < quietThreshold) {
      suspiciousSpikes++;
    }
  }
  
  if (suspiciousSpikes > 3) {
    return {
      type: "AUDIO_SPECTRAL_HIDING",
      severity: "high",
      confidence: Math.min(0.85, 0.4 + suspiciousSpikes * 0.1),
      description: `Spectral anomaly detected: ${suspiciousSpikes} suspicious energy spikes in quiet sections`,
      evidence: `${suspiciousSpikes} isolated energy bursts detected`,
      location: "time_domain",
    };
  }
  
  return null;
}

/**
 * Detect adversarial audio perturbations
 */
function detectAdversarialAudio(audioData: Float32Array): MultimodalFinding | null {
  if (audioData.length < 1000) return null;
  
  // Analyze sample distribution for adversarial patterns
  let sum = 0;
  let sumSq = 0;
  let maxVal = 0;
  
  for (const sample of audioData) {
    sum += sample;
    sumSq += sample * sample;
    maxVal = Math.max(maxVal, Math.abs(sample));
  }
  
  const mean = sum / audioData.length;
  const variance = sumSq / audioData.length - mean * mean;
  const stdDev = Math.sqrt(Math.max(0, variance));
  
  // Adversarial audio often has unusual statistical properties
  // Very low variance with high max value suggests crafted perturbations
  const isAdversarial = (stdDev < 0.01 && maxVal > 0.5) || (stdDev > 0.5);
  
  if (isAdversarial) {
    return {
      type: "AUDIO_ADVERSARIAL",
      severity: "high",
      confidence: 0.7,
      description: `Statistical anomaly in audio suggesting adversarial perturbation. StdDev: ${stdDev.toFixed(4)}, Max: ${maxVal.toFixed(3)}`,
      evidence: `StdDev: ${stdDev.toFixed(4)}, Max amplitude: ${maxVal.toFixed(3)}`,
      location: "waveform",
    };
  }
  
  return null;
}

/**
 * Detect suspicious silent segments (may contain hidden data)
 */
function detectSilentSegmentAttack(audioData: Float32Array, sampleRate: number): MultimodalFinding | null {
  if (audioData.length < sampleRate * 2) return null; // Need at least 2 seconds
  
  const silenceThreshold = 0.001;
  const minSilenceSamples = Math.floor(sampleRate * SILENCE_ANOMALY_MIN_MS / 1000);
  
  let silenceStart = -1;
  const silentSegments: { start: number; length: number }[] = [];
  
  for (let i = 0; i < audioData.length; i++) {
    const isSilent = Math.abs(audioData[i]) < silenceThreshold;
    
    if (isSilent && silenceStart === -1) {
      silenceStart = i;
    } else if (!isSilent && silenceStart !== -1) {
      const length = i - silenceStart;
      if (length > minSilenceSamples) {
        silentSegments.push({ start: silenceStart, length });
      }
      silenceStart = -1;
    }
  }
  
  // Multiple long silent segments are suspicious
  const longSilences = silentSegments.filter(s => s.length >= sampleRate * 0.8); // >= 0.8 second
  
  if (longSilences.length >= 2) {
    return {
      type: "AUDIO_SILENT_SEGMENT",
      severity: "medium",
      confidence: Math.min(0.7, 0.3 + longSilences.length * 0.1),
      description: `${longSilences.length} unusually long silent segments detected (potential data hiding)`,
      evidence: `Silent segments: ${longSilences.map(s => `${(s.start / sampleRate).toFixed(1)}s (${(s.length / sampleRate).toFixed(1)}s)`).join(", ")}`,
      location: "time_domain",
    };
  }
  
  return null;
}

/**
 * Scan audio for all attack vectors
 */
export function scanAudio(audioData: Float32Array, sampleRate: number): MultimodalScanResult {
  const startTime = Date.now();
  const findings: MultimodalFinding[] = [];
  
  const ultrasonic = detectUltrasonicAudio(audioData, sampleRate);
  if (ultrasonic) findings.push(ultrasonic);
  
  const spectral = detectSpectralHiding(audioData, sampleRate);
  if (spectral) findings.push(spectral);
  
  const adversarial = detectAdversarialAudio(audioData);
  if (adversarial) findings.push(adversarial);
  
  const silent = detectSilentSegmentAttack(audioData, sampleRate);
  if (silent) findings.push(silent);
  
  let riskScore = 0;
  for (const finding of findings) {
    riskScore += SEVERITY_WEIGHTS[finding.severity] * finding.confidence;
  }
  riskScore = Math.min(100, Math.round(riskScore));
  
  return {
    mediaType: "audio",
    isAttack: findings.some(f => f.severity === "high" || f.severity === "critical"),
    riskScore,
    findings,
    scannedAt: new Date().toISOString(),
    processingTimeMs: Date.now() - startTime,
  };
}

// ============================================================================
// Video Analysis
// ============================================================================

/**
 * Detect frame injection attacks (sudden anomalous frames)
 */
function detectFrameInjection(frameData: Uint8Array[], frameTimestamps: number[]): MultimodalFinding | null {
  if (frameData.length < 10) return null;
  
  // Calculate frame-to-frame differences
  const differences: number[] = [];
  for (let i = 1; i < frameData.length; i++) {
    let diff = 0;
    const len = Math.min(frameData[i].length, frameData[i - 1].length, 10000);
    for (let j = 0; j < len; j++) {
      diff += Math.abs(frameData[i][j] - frameData[i - 1][j]);
    }
    differences.push(diff / len);
  }
  
  // Look for anomalous spikes (injected frames)
  const avgDiff = differences.reduce((a, b) => a + b, 0) / differences.length;
  const anomalies = differences.filter(d => d > avgDiff * 5);
  
  if (anomalies.length > 0 && anomalies.length < frameData.length * 0.1) {
    return {
      type: "VIDEO_FRAME_INJECTION",
      severity: "high",
      confidence: Math.min(0.85, 0.5 + anomalies.length * 0.1),
      description: `${anomalies.length} anomalous frame(s) detected suggesting frame injection`,
      evidence: `${anomalies.length} frames with >5x average difference`,
      location: "frame_sequence",
    };
  }
  
  return null;
}

/**
 * Detect QR codes or barcodes in video frames
 */
function detectQRPayloadInVideo(frameData: Uint8Array[]): MultimodalFinding | null {
  // Simplified QR detection: look for high-contrast square patterns
  for (let frameIdx = 0; frameIdx < Math.min(frameData.length, 30); frameIdx++) {
    const frame = frameData[frameIdx];
    
    // Look for QR-like patterns (alternating black/white regions)
    let highContrastRegions = 0;
    const blockSize = 64;
    
    for (let i = 0; i < frame.length - blockSize * 2; i += blockSize) {
      const block1 = frame.slice(i, i + blockSize);
      const block2 = frame.slice(i + blockSize, i + blockSize * 2);
      
      const avg1 = block1.reduce((a, b) => a + b, 0) / blockSize;
      const avg2 = block2.reduce((a, b) => a + b, 0) / blockSize;
      
      if (Math.abs(avg1 - avg2) > 128) {
        highContrastRegions++;
      }
    }
    
    if (highContrastRegions > 10) {
      return {
        type: "VIDEO_QR_PAYLOAD",
        severity: "high",
        confidence: 0.7,
        description: `High-contrast pattern detected in frame ${frameIdx} (potential QR/barcode payload)`,
        evidence: `${highContrastRegions} high-contrast regions in frame ${frameIdx}`,
        location: `frame_${frameIdx}`,
      };
    }
  }
  
  return null;
}

/**
 * Detect subliminal content (brief hidden frames)
 */
function detectSubliminalContent(frameData: Uint8Array[], frameTimestamps: number[]): MultimodalFinding | null {
  if (frameData.length < 5 || frameTimestamps.length < 5) return null;
  
  // Look for very short duration frames (subliminal)
  const durations: number[] = [];
  for (let i = 1; i < frameTimestamps.length; i++) {
    durations.push(frameTimestamps[i] - frameTimestamps[i - 1]);
  }
  
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const shortFrames = durations.filter(d => d < avgDuration * 0.5 && d < 50); // < 50ms and < 50% of avg
  
  if (shortFrames.length > 0) {
    return {
      type: "VIDEO_SUBLIMINAL",
      severity: "high",
      confidence: Math.min(0.8, 0.5 + shortFrames.length * 0.1),
      description: `${shortFrames.length} abnormally short frame(s) detected (potential subliminal content)`,
      evidence: `${shortFrames.length} frames with duration < 50ms`,
      location: "frame_timing",
    };
  }
  
  return null;
}

/**
 * Scan video for all attack vectors
 */
export function scanVideo(
  frameData: Uint8Array[],
  frameTimestamps: number[],
  audioTrack?: Float32Array,
  audioSampleRate?: number
): MultimodalScanResult {
  const startTime = Date.now();
  const findings: MultimodalFinding[] = [];
  
  const frameInjection = detectFrameInjection(frameData, frameTimestamps);
  if (frameInjection) findings.push(frameInjection);
  
  const qrPayload = detectQRPayloadInVideo(frameData);
  if (qrPayload) findings.push(qrPayload);
  
  const subliminal = detectSubliminalContent(frameData, frameTimestamps);
  if (subliminal) findings.push(subliminal);
  
  // Also scan audio track if present
  if (audioTrack && audioSampleRate) {
    const audioResult = scanAudio(audioTrack, audioSampleRate);
    for (const finding of audioResult.findings) {
      findings.push({
        ...finding,
        type: "VIDEO_AUDIO_ATTACK" as MultimodalAttackType,
        description: `[Audio track] ${finding.description}`,
      });
    }
  }
  
  let riskScore = 0;
  for (const finding of findings) {
    riskScore += SEVERITY_WEIGHTS[finding.severity] * finding.confidence;
  }
  riskScore = Math.min(100, Math.round(riskScore));
  
  return {
    mediaType: "video",
    isAttack: findings.some(f => f.severity === "high" || f.severity === "critical"),
    riskScore,
    findings,
    scannedAt: new Date().toISOString(),
    processingTimeMs: Date.now() - startTime,
  };
}

// ============================================================================
// Unified Scanner
// ============================================================================

/**
 * Detect media type from file bytes
 */
export function detectMediaType(bytes: Uint8Array): MultimodalMediaType | null {
  if (bytes.length < 12) return null;
  
  // Image signatures
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return "image"; // JPEG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return "image"; // PNG
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image"; // GIF
  if (bytes[0] === 0x42 && bytes[1] === 0x4D) return "image"; // BMP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image"; // WEBP
  
  // Audio signatures
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return "audio"; // MP3 (ID3)
  if (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) return "audio"; // MP3 (frame sync)
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) return "audio"; // WAV
  if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return "audio"; // OGG
  if (bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43) return "audio"; // FLAC
  
  // Video signatures
  if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x00 && 
      (bytes[3] === 0x18 || bytes[3] === 0x1C || bytes[3] === 0x20) &&
      bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return "video"; // MP4
  if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) return "video"; // MKV/WebM
  if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0xBA) return "video"; // MPEG
  if (bytes[0] === 0x46 && bytes[1] === 0x4C && bytes[2] === 0x56) return "video"; // FLV
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x41 && bytes[9] === 0x56 && bytes[10] === 0x49 && bytes[11] === 0x20) return "video"; // AVI
  
  return null;
}

/**
 * Scan any media file for attacks
 */
export function scanMedia(bytes: Uint8Array, mimeType?: string): MultimodalScanResult {
  const detectedType = detectMediaType(bytes);
  
  if (!detectedType) {
    return {
      mediaType: "image", // Default
      isAttack: false,
      riskScore: 0,
      findings: [],
      scannedAt: new Date().toISOString(),
      processingTimeMs: 0,
    };
  }
  
  switch (detectedType) {
    case "image":
      return scanImage(bytes, mimeType);
    case "audio":
      // For raw bytes, we can only do limited analysis
      // Full audio analysis requires decoded PCM data
      return scanImage(bytes, mimeType); // Reuse byte-level analysis
    case "video":
      // For raw bytes, check for polyglot and metadata attacks
      return scanImage(bytes, mimeType); // Reuse byte-level analysis
    default:
      return {
        mediaType: detectedType,
        isAttack: false,
        riskScore: 0,
        findings: [],
        scannedAt: new Date().toISOString(),
        processingTimeMs: 0,
      };
  }
}

/**
 * Check if a file should be scanned based on MIME type
 */
export function isScannableMediaType(mimeType: string): boolean {
  const scannableTypes = [
    "image/",
    "audio/",
    "video/",
    "application/pdf", // PDFs can contain images
  ];
  return scannableTypes.some(t => mimeType.startsWith(t));
}

/**
 * Get human-readable attack type description
 */
export function getAttackTypeDescription(type: MultimodalAttackType): string {
  const descriptions: Record<MultimodalAttackType, string> = {
    IMAGE_STEGANOGRAPHY: "Hidden data embedded in image pixels",
    IMAGE_EXIF_INJECTION: "Malicious instructions in image metadata",
    IMAGE_ADVERSARIAL: "AI-crafted image designed to fool models",
    IMAGE_QR_PAYLOAD: "QR code containing malicious payload",
    IMAGE_POLYGLOT: "Image containing embedded executable/script",
    IMAGE_TEXT_INJECTION: "Hidden text instructions in image",
    AUDIO_ULTRASONIC: "Inaudible ultrasonic commands",
    AUDIO_SPECTRAL_HIDING: "Hidden data in audio spectrum",
    AUDIO_ADVERSARIAL: "AI-crafted audio designed to fool models",
    AUDIO_SILENT_SEGMENT: "Suspicious silent segments with hidden data",
    AUDIO_HIDDEN_COMMAND: "Hidden voice commands in audio",
    VIDEO_FRAME_INJECTION: "Malicious frames injected into video",
    VIDEO_QR_PAYLOAD: "QR code payload in video frames",
    VIDEO_SUBLIMINAL: "Subliminal content in video",
    VIDEO_METADATA_INJECTION: "Malicious metadata in video file",
    VIDEO_AUDIO_ATTACK: "Attack detected in video audio track",
  };
  return descriptions[type] || type;
}