/**
 * SoterAI Multimodal Media Scan API
 * POST /api/scan/media
 * 
 * Scans uploaded media files (images, audio, video) for hidden attacks:
 * - Image: steganography, EXIF injection, adversarial perturbations, polyglot files
 * - Audio: ultrasonic commands, spectral hiding, adversarial audio
 * - Video: frame injection, QR payloads, subliminal content
 */

import { NextRequest, NextResponse } from "next/server";
import { scanMedia, detectMediaType, isScannableMediaType, type MultimodalScanResult } from "@/packages/detectors/src/multimodal";
import { requireUser } from "@/lib/auth/guards";
import { checkMemoryRateLimit } from "@/lib/rateLimit";

// Configuration
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30;

export async function POST(request: NextRequest) {
  try {
    // Authentication check. requireUser() rather than a bare auth() session read:
    // it is the guard the whole app/api surface is audited against
    // (tests/api-route-audit.test.ts recognizes it), and it throws rather than
    // letting a falsy-session branch be edited away later.
    const user = await requireUser();

    // Rate limiting — keyed per authenticated user, not per IP: auth is already
    // required above, and an IP key would let one tenant behind a NAT exhaust
    // the budget for every other tenant sharing that egress address.
    const rateLimitResult = checkMemoryRateLimit(
      `media-scan:${user.id}`,
      RATE_LIMIT_MAX_REQUESTS,
      RATE_LIMIT_WINDOW_MS,
    );
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded", message: "Too many scan requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    // Parse request body
    const contentType = request.headers.get("content-type") || "";
    
    let bytes: Uint8Array;
    let mimeType: string | undefined;
    let fileName: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      // Handle file upload
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      
      if (!file) {
        return NextResponse.json(
          { error: "Bad request", message: "No file provided. Use 'file' field in form data." },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "File too large", message: `Maximum file size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
          { status: 413 }
        );
      }

      mimeType = file.type;
      fileName = file.name;
      const buffer = await file.arrayBuffer();
      bytes = new Uint8Array(buffer);
    } else if (contentType.includes("application/json")) {
      // Handle base64 encoded data
      const body = await request.json();
      
      if (!body.data) {
        return NextResponse.json(
          { error: "Bad request", message: "No data provided. Use 'data' field with base64 content." },
          { status: 400 }
        );
      }

      mimeType = body.mimeType;
      fileName = body.fileName;
      
      try {
        const base64Data = body.data.replace(/^data:[^;]+;base64,/, "");
        const binaryString = atob(base64Data);
        bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
      } catch {
        return NextResponse.json(
          { error: "Bad request", message: "Invalid base64 data" },
          { status: 400 }
        );
      }

      if (bytes.length > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "File too large", message: `Maximum file size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
          { status: 413 }
        );
      }
    } else {
      // Handle raw binary
      const buffer = await request.arrayBuffer();
      bytes = new Uint8Array(buffer);
      mimeType = contentType;

      if (bytes.length > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "File too large", message: `Maximum file size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
          { status: 413 }
        );
      }
    }

    // Detect media type
    const detectedType = detectMediaType(bytes);
    
    if (!detectedType) {
      return NextResponse.json(
        { 
          error: "Unsupported media type", 
          message: "Could not detect media type. Supported: images (JPEG, PNG, GIF, BMP, WebP), audio (MP3, WAV, OGG, FLAC), video (MP4, MKV, WebM, AVI, FLV)" 
        },
        { status: 415 }
      );
    }

    // Perform scan
    const scanResult = scanMedia(bytes, mimeType);

    // Determine action
    const action = determineAction(scanResult);

    // Build response
    const response: MediaScanResponse = {
      success: true,
      result: {
        mediaType: scanResult.mediaType,
        detectedMimeType: mimeType || "unknown",
        fileName,
        fileSize: bytes.length,
        isAttack: scanResult.isAttack,
        riskScore: scanResult.riskScore,
        riskLevel: getRiskLevel(scanResult.riskScore),
        action,
        findings: scanResult.findings.map(f => ({
          type: f.type,
          severity: f.severity,
          confidence: f.confidence,
          description: f.description,
          evidence: f.evidence,
          location: f.location,
        })),
        scannedAt: scanResult.scannedAt,
        processingTimeMs: scanResult.processingTimeMs,
      },
      user: {
        id: user.id,
        email: user.email,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Media scan error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: "Failed to scan media file" },
      { status: 500 }
    );
  }
}

// GET endpoint for API info
export async function GET() {
  return NextResponse.json({
    name: "SoterAI Multimodal Media Scan API",
    version: "1.0.0",
    description: "Scans images, audio, and video files for hidden adversarial attacks",
    endpoints: {
      POST: "/api/scan/media",
    },
    supportedFormats: {
      images: ["JPEG", "PNG", "GIF", "BMP", "WebP"],
      audio: ["MP3", "WAV", "OGG", "FLAC"],
      video: ["MP4", "MKV", "WebM", "AVI", "FLV", "MPEG"],
    },
    attackDetection: {
      images: [
        "Steganography (LSB analysis)",
        "EXIF metadata injection",
        "Adversarial perturbations",
        "Polyglot files (embedded executables)",
        "QR code payloads",
      ],
      audio: [
        "Ultrasonic commands (>18kHz)",
        "Spectral hiding",
        "Adversarial perturbations",
        "Silent segment attacks",
      ],
      video: [
        "Frame injection",
        "QR code payloads in frames",
        "Subliminal content",
        "Audio track attacks",
      ],
    },
    limits: {
      maxFileSize: "50MB",
      rateLimit: "30 requests/minute",
    },
    authentication: "Required (session-based)",
  });
}

// ============================================================================
// Types
// ============================================================================

interface MediaScanResponse {
  success: boolean;
  result: {
    mediaType: string;
    detectedMimeType: string;
    fileName?: string;
    fileSize: number;
    isAttack: boolean;
    riskScore: number;
    riskLevel: { label: string; color: string };
    action: "allow" | "warn" | "block";
    findings: Array<{
      type: string;
      severity: string;
      confidence: number;
      description: string;
      evidence?: string;
      location?: string;
    }>;
    scannedAt: string;
    processingTimeMs: number;
  };
  user: {
    id?: string;
    email?: string | null;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function determineAction(result: MultimodalScanResult): "allow" | "warn" | "block" {
  if (result.isAttack) return "block";
  if (result.riskScore >= 60) return "block";
  if (result.riskScore >= 30) return "warn";
  return "allow";
}

function getRiskLevel(riskScore: number): { label: string; color: string } {
  if (riskScore >= 80) return { label: "Critical", color: "#dc2626" };
  if (riskScore >= 60) return { label: "High", color: "#ea580c" };
  if (riskScore >= 40) return { label: "Medium", color: "#d97706" };
  if (riskScore >= 20) return { label: "Low", color: "#65a30d" };
  return { label: "Safe", color: "#16a34a" };
}