import type { RuntimeResponse } from "../lib/types";
import { showSoterOverlay } from "./overlay";
import { clearBlockedFileInput, destinationDomainForFileScan, scanFileText } from "../lib/file-scan-policy";
import { getState } from "../lib/storage";
import { getFreshLineageContext } from "../lib/lineage-context";

export function installFileContentScanner() {
  const approvedFiles = new Set<string>();

  document.addEventListener("change", async (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "file" || !input.files?.length) return;

    // Check if files in this selection are already approved or bypassed
    const filesArray = Array.from(input.files);
    const allApproved = filesArray.every(file => approvedFiles.has(`${file.name}:${file.size}`));
    if (allApproved) {
      // Allow bypass scan checks
      return;
    }

    const state = await getState();
    const lineageContext = await getFreshLineageContext();
    const scans = [];

    for (const file of filesArray) {
      const fileKey = `${file.name}:${file.size}`;
      if (approvedFiles.has(fileKey)) continue;
      scans.push(await scanFileText(file, location.href, state));
    }

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

    const fileKeys = filesArray.map(f => `${f.name}:${f.size}`);

    if (["block", "require_approval", "require_justification"].includes(strongest.action)) {
      clearBlockedFileInput(input);
    }

    showSoterOverlay({
      result: strongest.scanResult,
      onCopy: () => void navigator.clipboard?.writeText(strongest.redactedPreview),
      onTamper: (detail) => {
        chrome.runtime.sendMessage({
          type: "SOTER_AUDIT_BYPASS",
          text: strongest.redactedPreview,
          url: location.href,
          action: strongest.action,
          justification: `overlay tamper detected: ${detail}`,
          dismissedOnly: true,
        });
      },
      onApproval: async (justification) => {
        return new Promise<string | null>((resolve) => {
          chrome.runtime.sendMessage(
            { type: "SOTER_REQUEST_APPROVAL", text: strongest.redactedPreview, url: location.href, justification },
            (res: any) => {
              if (res && res.approvalId) {
                resolve(res.approvalId as string);
              } else {
                resolve(null);
              }
            }
          );
        });
      },
      onCheckStatus: async (approvalId) => {
        return new Promise<{ status: string; allowed?: boolean }>((resolve) => {
          chrome.runtime.sendMessage(
            { type: "SOTER_CHECK_APPROVAL_STATUS", approvalId },
            (res: any) => resolve((res as { status: string; allowed?: boolean }) || { status: "PENDING" })
          );
        });
      },
      onApproved: () => {
        // Claim the one-time approval server-side. Only mark files approved if
        // the broker honors the claim.
        return new Promise<boolean>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: "SOTER_CLAIM_APPROVAL",
              requestId: strongest.scanResult.policy?.auditMetadata?.approvalId || "",
              destination: location.hostname,
            },
            (res: any) => {
              const allowed = res?.allowed === true;
              if (allowed) {
                fileKeys.forEach(key => approvedFiles.add(key));
                alert("Approved! Please select the file again to upload.");
              } else {
                alert("Authorization could not be claimed. Upload remains blocked.");
              }
              resolve(allowed);
            }
          );
        });
      },
      onDismissAudited: () => {
        chrome.runtime.sendMessage({
          type: "SOTER_AUDIT_BYPASS",
          text: strongest.redactedPreview,
          url: location.href,
          action: strongest.action,
          justification: "hard-enforcement block dismissed (no upload)",
          dismissedOnly: true,
        });
      },
      onBypass: (justification) => {
        // Audit the bypass and store approved file keys
        chrome.runtime.sendMessage({
          type: "SOTER_AUDIT_BYPASS",
          text: strongest.redactedPreview,
          url: location.href,
          action: strongest.action,
          justification
        });
        fileKeys.forEach(key => approvedFiles.add(key));
        alert("Bypassed list updated. Please select the file again to upload.");
      }
    });
  }, true);
}

export function sendFileScanFallback(text: string) {
  return new Promise<RuntimeResponse>((resolve) => chrome.runtime.sendMessage(
    { type: "SOTER_SCAN_TEXT", text, url: location.href, eventType: "file_upload" },
    (response) => resolve((response as RuntimeResponse) ?? { ok: false, message: chrome.runtime.lastError?.message ?? "No response." }),
  ));
}
