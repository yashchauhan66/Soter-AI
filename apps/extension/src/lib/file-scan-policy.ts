import { scanText } from "../../../../packages/detectors/src/index";
import { auditSafePreview, redactSensitiveText } from "./redaction";
import type { ExtensionState, ScanResult } from "./types";
import { domainFromUrl, scanPrompt } from "./scanner";
import { extensionForFile, extractTextFromFile, sha256Browser } from "./file-extractors";
import { createPrivacySafePreview } from "./privacy-preview";

export interface FileScanResult {
  fileNameHash: string;
  fileName: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  supported: boolean;
  scannedBytes: number;
  encryptedOrBinary: boolean;
  detectedDataTypes: string[];
  riskScore: number;
  action: ScanResult["action"];
  redactedPreview: string;
  scanResult: ScanResult;
}

export async function scanFileText(file: File, url: string, state: ExtensionState): Promise<FileScanResult> {
  const extracted = await extractTextFromFile(file);
  const extension = extensionForFile(file);
  const metadataText = `AI file upload: ${extension || "unknown"} ${file.type || "unknown"} ${file.size} bytes ${file.name}`;
  const textForPolicy = extracted.supported ? extracted.text : metadataText;
  const localScan = extracted.supported ? scanText(extracted.text) : { findings: [], detectedDataTypes: [], riskScore: 0 };
  const result = scanPrompt(textForPolicy, url, state, "file_upload");
  const detectedDataTypes = Array.from(new Set([...result.detectedDataTypes, ...localScan.detectedDataTypes])).sort();
  const riskScore = Math.max(result.riskScore, localScan.riskScore, metadataRisk(file, extracted.encryptedOrBinary));
  const action = applyFilePolicy({ ...result, riskScore, detectedDataTypes }, extension, extracted.encryptedOrBinary);
  const redactedText = redactSensitiveText(textForPolicy, detectedDataTypes);
  return {
    fileNameHash: await sha256Browser(`${state.config.organizationId}:${file.name}`),
    fileName: file.name,
    extension,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    supported: extracted.supported,
    scannedBytes: extracted.scannedBytes,
    encryptedOrBinary: extracted.encryptedOrBinary,
    detectedDataTypes,
    riskScore,
    action,
    redactedPreview: createPrivacySafePreview({ rawText: redactedText, dataTypes: detectedDataTypes, contextType: "file", logMode: "redacted_prompt", maxLength: 500 }),
    scanResult: {
      ...result,
      riskScore,
      detectedDataTypes,
      hasFindings: result.hasFindings || localScan.findings.length > 0 || riskScore >= 40,
      action,
      redactedText,
      policy: { ...result.policy, action, redactedText },
    },
  };
}

export function applyFilePolicy(result: ScanResult, extension: string, encryptedOrBinary: boolean): ScanResult["action"] {
  if ([".env", ".pem", ".key"].includes(extension)) return "block";
  if (encryptedOrBinary) return result.action === "allow" ? "warn" : result.action;
  if (result.detectedDataTypes.some((type) => ["api_key", "private_key", "database_url", "password", "github_token", "aws_access_key"].includes(type))) return "block";
  if (result.detectedDataTypes.some((type) => ["customer_data", "source_code", "legal_contract", "hr_salary"].includes(type))) {
    return result.action === "allow" || result.action === "log_only" ? "require_approval" : result.action;
  }
  return result.action;
}

export function clearBlockedFileInput(input: HTMLInputElement) {
  input.value = "";
}

export function createRedactedFilePreview(text: string) {
  return createPrivacySafePreview({ rawText: redactSensitiveText(text, []), contextType: "file", logMode: "redacted_prompt", maxLength: 500 });
}

function metadataRisk(file: File, encryptedOrBinary: boolean) {
  const name = file.name.toLowerCase();
  if (/\.(env|pem|key)$/.test(name) || /secret|credential|private|salary|payroll|customer|contract/.test(name)) return 80;
  if (encryptedOrBinary) return 35;
  return 0;
}

export function destinationDomainForFileScan(url: string) {
  return domainFromUrl(url);
}
