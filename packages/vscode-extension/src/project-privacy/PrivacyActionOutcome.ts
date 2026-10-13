export interface PrivacyActionOutcome { state: "completed" | "withheld" | "failed" | "unknown"; message: string }

/** Only known metadata statuses affect the page; never reflect arbitrary tool output or errors. */
export function privacyActionOutcome(result: unknown, failed = false): PrivacyActionOutcome {
    if (failed) return { state: "failed", message: "Action failed. Review workspace policy and availability; no success is confirmed." };
    const status = result && typeof result === "object" && !Array.isArray(result)
        ? (result as { status?: unknown }).status : undefined;
    switch (status) {
        case "SAVED": return { state: "completed", message: "Managed restriction saved. Independent tools remain outside this boundary." };
        case "REVOKED": return { state: "completed", message: "Pending managed reads revoked. Previously released data cannot be recalled." };
        case "OPENED": return { state: "completed", message: "Managed view opened. This does not establish agent isolation." };
        case "PREPARED": return { state: "completed", message: "Reviewed public workspace prepared. OS isolation is not configured or verified." };
        case "PREVIEWED": return { state: "completed", message: "Development contract preview opened. No real credentials or service access were granted." };
        case "STARTED": return { state: "completed", message: "Synthetic loopback preview started. It uses generated sample data, not a real database or production credentials." };
        case "STOPPED": return { state: "completed", message: "Synthetic preview stopped. No production service was changed." };
        case "ALLOWED_ONCE": return { state: "completed", message: "One approved safe view released. Persistent restrictions remain." };
        case "CANCELLED":
        case "DENIED": return { state: "withheld", message: "Request cancelled or denied. No successful release is reported." };
        case "CHANGED": return { state: "withheld", message: "File or policy changed. The reviewed release was withheld." };
        case "EXPIRED": return { state: "withheld", message: "Approval expired or was revoked. The release was withheld." };
        case "BUSY": return { state: "withheld", message: "Another request is pending. No second review was started." };
        case "UNAVAILABLE": return { state: "withheld", message: "This managed route is unavailable. No successful release is reported." };
        case "FAILED": return privacyActionOutcome(undefined, true);
        default: return { state: "unknown", message: "No completion status was returned. Review the native result; no success is confirmed." };
    }
}
