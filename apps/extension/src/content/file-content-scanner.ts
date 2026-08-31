import type { RuntimeResponse } from "../lib/types";
import { showSoterOverlay } from "./overlay";
import { clearBlockedFileInput, destinationDomainForFileScan, scanFileText } from "../lib/file-scan-policy";
import { getState } from "../lib/storage";
import { getFreshLineageContext } from "../lib/lineage-context";
import { showCornerNotice } from "./corner-notice";

/**
 * Puts the held files back into the picker and lets the page notice, so an authorized upload
 * continues by itself.
 *
 * This replaces "Approved! Please select the file again to upload." — an `alert()` that handed
 * the user a manual step at the exact moment they had just been told they were allowed to
 * proceed. Soter is the reason the picker is empty (it clears the input to hold the upload), so
 * refilling it is Soter's job, not the user's. Re-dispatching `input` and `change` is what makes
 * the page's own attachment UI reappear, which is also the user's confirmation that it worked.
 *
 * Our own listener runs first on the re-dispatched event and returns early, because every file
 * in the selection is in `approvedFiles` by the time this is called — that is what stops this
 * from looping back into the scanner.
 */
function restoreFileSelection(input: HTMLInputElement, files: File[]): boolean {
  try {
    if (!input.isConnected || typeof DataTransfer === "undefined") return false;
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    input.files = transfer.files;
    if (input.files?.length !== files.length) return false;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  } catch {
    // Some pages replace the input element between the change event and the verdict, and a
    // detached input cannot be refilled. Better to say so than to claim the upload resumed.
    return false;
  }
}

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
    const held = ["block", "require_approval", "require_justification"].includes(strongest.action);

    if (held) {
      clearBlockedFileInput(input);
    }

    /** Called once the upload is authorized. Reports honestly whichever way it goes. */
    const releaseUpload = () => {
      fileKeys.forEach(key => approvedFiles.add(key));
      if (!held) return true; // never cleared, so there is nothing to restore
      if (restoreFileSelection(input, filesArray)) {
        showCornerNotice({
          key: "file-upload",
          tone: "info",
          title: filesArray.length > 1 ? "Files released for upload" : "File released for upload",
          lines: ["Soter recorded the override in your organization's audit log."],
          autoDismissMs: 6000,
        });
        return true;
      }
      showCornerNotice({
        key: "file-upload",
        tone: "warning",
        title: "Select the file again to upload it",
        lines: [
          "The upload is authorized and recorded. Soter had emptied the file picker to hold it, and this page did not allow it to be refilled automatically.",
        ],
      });
      return true;
    };

    showSoterOverlay({
      result: strongest.scanResult,
      // The dialog is about a file, so it must not talk about a prompt. It also gets no
      // `onReplace`: a file's contents cannot be rewritten in the picker, and the overlay only
      // renders "Use safe …" when a handler exists to back it.
      subject: "file",
      onCopy: () => void navigator.clipboard?.writeText(strongest.redactedPreview),
      onTamper: (detail) => {
        chrome.runtime.sendMessage({
          type: "SOTER_AUDIT_BYPASS",
          text: strongest.redactedPreview,
          url: location.href,
          action: strongest.action,
          // A file, not a submitted prompt — the scan event for the same bytes carries
          // `"file_upload"`, and the override record has to agree with it.
          eventType: "file_upload",
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
      onApproved: (approvalId) => {
        // Claim the one-time approval server-side. Only mark files approved if
        // the broker honors the claim.
        return new Promise<boolean>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: "SOTER_CLAIM_APPROVAL",
              // The approvalId the poll actually approved comes first. Falling back to the
              // scan's own auditMetadata was the only source before, and on a require_approval
              // verdict that field is usually absent — so the claim went out with an empty
              // requestId and could only ever be rejected.
              requestId: approvalId || strongest.scanResult.policy?.auditMetadata?.approvalId || "",
              destination: location.hostname,
            },
            (res: any) => {
              const allowed = res?.allowed === true;
              // No alert() either way: the overlay reports "Authorized. Releasing your file…"
              // or "Authorization could not be claimed. Nothing was sent." itself, inside the
              // closed shadow root where the rest of the verdict lives.
              if (allowed) releaseUpload();
              resolve(allowed);
            }
          );
        });
      },
      onDismissAudited: () => {
        const hardEnforced = strongest.scanResult.policy.matchedRules.some((rule) => rule.id === "hard-enforcement-block");
        chrome.runtime.sendMessage({
          type: "SOTER_AUDIT_BYPASS",
          text: strongest.redactedPreview,
          url: location.href,
          action: strongest.action,
          eventType: "file_upload",
          // Only say "hard enforcement" when the hard-enforcement rule actually matched. Every
          // block is dismissible now, so the old unconditional string mislabelled ordinary
          // policy blocks in the audit log.
          justification: hardEnforced ? "hard-enforcement block dismissed (no upload)" : "block dismissed (no upload)",
          dismissedOnly: true,
        });
      },
      onBypass: (justification) => {
        // Audit the bypass, then let the upload continue on its own.
        chrome.runtime.sendMessage({
          type: "SOTER_AUDIT_BYPASS",
          text: strongest.redactedPreview,
          url: location.href,
          action: strongest.action,
          eventType: "file_upload",
          justification
        });
        releaseUpload();
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
