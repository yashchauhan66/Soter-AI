import type { RuntimeResponse } from "../lib/types";
import { showSoterOverlay } from "./overlay";
import { clearBlockedFileInput, destinationDomainForFileScan, scanFileText } from "../lib/file-scan-policy";
import { getState } from "../lib/storage";
import { getFreshLineageContext } from "../lib/lineage-context";

export function installFileContentScanner() {
  document.addEventListener("change", async (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "file" || !input.files?.length) return;
    const state = await getState();
    const lineageContext = await getFreshLineageContext();
    const scans = [];
    for (const file of Array.from(input.files)) scans.push(await scanFileText(file, location.href, state));
    const strongest = scans.sort((left, right) => right.riskScore - left.riskScore)[0];
    if (!strongest) return;
    await chrome.runtime.sendMessage({
      type: "SOTER_FILE_SCAN_EVENT",
      event: {
        organizationId: state.config.organizationId,
        employeeId: state.config.employeeId,
        destinationDomain: destinationDomainForFileScan(location.href),
        fileNameHash: strongest.fileNameHash,
        originalExtension: strongest.extension,
        mimeType: strongest.mimeType,
        sizeBytes: strongest.sizeBytes,
        scannedBytes: strongest.scannedBytes,
        supported: strongest.supported,
        encryptedOrBinary: strongest.encryptedOrBinary,
        detectedDataTypes: strongest.detectedDataTypes,
        riskScore: strongest.riskScore,
        severity: strongest.scanResult.policy.severity,
        actionTaken: strongest.action,
        redactedPreview: strongest.redactedPreview,
        lineageContext,
      },
    });
    if (!strongest.scanResult.hasFindings && strongest.action === "allow") return;
    if (["block", "require_approval", "require_justification"].includes(strongest.action)) clearBlockedFileInput(input);
    showSoterOverlay({
      result: strongest.scanResult,
      onCopy: () => void navigator.clipboard?.writeText(strongest.redactedPreview),
      onApproval: () => void chrome.runtime.sendMessage({ type: "SOTER_REQUEST_APPROVAL", text: strongest.redactedPreview, url: location.href }),
    });
  }, true);
}

export function sendFileScanFallback(text: string) {
  return new Promise<RuntimeResponse>((resolve) => chrome.runtime.sendMessage(
    { type: "SOTER_SCAN_TEXT", text, url: location.href, eventType: "file_upload" },
    (response) => resolve((response as RuntimeResponse) ?? { ok: false, message: chrome.runtime.lastError?.message ?? "No response." }),
  ));
}
