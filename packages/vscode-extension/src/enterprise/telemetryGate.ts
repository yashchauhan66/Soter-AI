/**
 * GAP 3 — the gate every telemetry send must pass, as a pure function.
 *
 * The defect this replaces was real and auditable: `TelemetryManager.flush()`
 * checked SoterAI's own `telemetry.redactedEvents` setting, the privacy mode,
 * the cloud toggle and workspace trust — and never `vscode.env.isTelemetryEnabled`.
 * A user who turned telemetry off for the whole editor still had SoterAI events
 * queued for upload. For a security product that is a compliance finding, not a
 * preference mismatch.
 *
 * It lives in its own pure module for the same reason `ProtectionState.ts` does:
 * "may this leave the machine?" is the kind of decision that must be testable
 * without a VS Code host, and every branch reachable from a unit test.
 */

export interface TelemetryGateInput {
    /** SoterAI's own level: "off" | "high-risk-only" | "batched". */
    level: string;
    /** soterai.privacyMode: "local" | "cloud" | "hybrid". */
    privacyMode: string;
    /** soterai.cloud.enabled */
    cloudEnabled: boolean;
    /** workspace.isTrusted */
    trusted: boolean;
    /** env.isTelemetryEnabled — the editor-wide preference. */
    hostTelemetryEnabled: boolean;
    /** A previous send failed recently; hold rather than hammer the endpoint. */
    offline?: boolean;
}

/**
 * Why a send is being held, in one plain sentence, or `undefined` when nothing
 * is holding it. Ordered most-authoritative first: the editor's own preference
 * outranks every SoterAI setting, because the user expressed it about the whole
 * product and we are a guest in it.
 */
export function telemetryHoldReason(input: TelemetryGateInput): string | undefined {
    if (!input.hostTelemetryEnabled) {
        return "Telemetry is turned off for this editor, so SoterAI sends nothing.";
    }
    if (input.level === "off") {
        return "SoterAI telemetry is off.";
    }
    if (input.privacyMode === "local") {
        return "SoterAI is in local mode, so nothing is sent anywhere.";
    }
    if (!input.cloudEnabled) {
        return "Cloud features are off, so there is nowhere to send to.";
    }
    if (!input.trusted) {
        return "This workspace is not trusted, so nothing is sent.";
    }
    if (input.offline) {
        return "The last attempt failed, so sending is paused for a minute.";
    }
    return undefined;
}

/** True only when every gate agrees. */
export function shouldSend(input: TelemetryGateInput): boolean {
    return telemetryHoldReason(input) === undefined;
}

/**
 * Whether already queued metadata may remain in memory. Explicit privacy
 * downgrades purge it; temporary trust/network holds merely pause delivery.
 */
export function shouldRetainQueuedTelemetry(input: TelemetryGateInput): boolean {
    return input.hostTelemetryEnabled
        && input.level !== "off"
        && input.privacyMode !== "local"
        && input.cloudEnabled;
}

/**
 * Whether an individual event is worth recording at the user's chosen level.
 * Separate from `shouldSend` because it is about *this* event, not the channel.
 */
export function shouldRecord(level: string, riskScore: number): boolean {
    if (level === "off") return false;
    if (level === "high-risk-only") return riskScore >= 30;
    return true;
}
