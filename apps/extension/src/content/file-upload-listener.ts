import type { RuntimeResponse } from "../lib/types";
import { showSoterOverlay } from "./overlay";

const SENSITIVE_FILE = /(^|[._-])(\.env|env|secret|credential|private|prod(?:uction)?|customer|payroll|salary|contract|\.pem|\.key)([._-]|$)/i;

export function installFileUploadListener() {
  document.addEventListener("change", async (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "file" || !input.files?.length) return;
    const names = Array.from(input.files).map((file) => `${file.name} (${file.type || "unknown type"}, ${file.size} bytes)`);
    const response = await sendFileScan(`Files selected for AI upload:\n${names.join("\n")}`);
    if (!response.ok || (!response.result.hasFindings && !names.some((name) => SENSITIVE_FILE.test(name)))) return;
    if (["block", "require_approval", "require_justification"].includes(response.result.action)) input.value = "";
    showSoterOverlay({
      result: response.result,
      onCopy: () => void navigator.clipboard?.writeText(names.join("\n")),
      onApproval: () => void chrome.runtime.sendMessage({ type: "SOTER_REQUEST_APPROVAL", text: names.join("\n"), url: location.href }),
    });
  }, true);
}

function sendFileScan(text: string) {
  return new Promise<RuntimeResponse>((resolve) => chrome.runtime.sendMessage(
    { type: "SOTER_SCAN_TEXT", text, url: location.href, eventType: "file_upload" },
    (response) => resolve((response as RuntimeResponse) ?? { ok: false, message: chrome.runtime.lastError?.message ?? "No response." }),
  ));
}
