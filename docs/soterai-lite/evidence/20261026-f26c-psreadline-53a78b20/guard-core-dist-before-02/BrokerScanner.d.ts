import type { Finding, GuardAction } from "./types";
import { DecisionEngine } from "./DecisionEngine";
import { type OutputScanResult } from "./OutputLeakScanner";
import { type SafeModeLevel } from "./SafeMode";
import { type Canary } from "./Canary";
/**
 * BrokerScanner — the guard-core brain the Local AI Broker uses to inspect
 * OpenAI/Anthropic-compatible requests and responses. Pure and local: it never
 * calls a provider, never logs raw content, and returns redacted evidence only.
 */
export interface BrokerMessage {
    role: string;
    content: string;
    name?: string;
}
export interface BrokerSafeModeInput {
    enabled: boolean;
    level: SafeModeLevel;
}
export interface BrokerRequestScanOptions {
    engine?: DecisionEngine;
    safeMode?: BrokerSafeModeInput;
    canaries?: Array<Pick<Canary, "id" | "token" | "hash" | "redactedPreview">>;
    maxContentLength?: number;
}
export interface BrokerRequestScanResult {
    decision: GuardAction;
    riskScore: number;
    categories: string[];
    findings: Finding[];
    evidencePreview: string;
    /** Redacted copy of the messages — safe to forward for redact/warn/allow. */
    redactedMessages: BrokerMessage[];
    redacted: boolean;
    canaryInRequest: boolean;
    /** SHA-256 of the joined message content (never the content itself). */
    contentHash: string;
    /** True when no raw high-risk secret survives redaction (invariant). */
    safe: boolean;
}
/**
 * Scan an OpenAI/Anthropic-compatible request. Runs guard-core detectors over the
 * concatenated messages, checks for planted canaries, then escalates via Safe
 * Mode. Produces a redacted copy suitable for forwarding.
 */
export declare function scanBrokerRequest(messages: BrokerMessage[], options?: BrokerRequestScanOptions): Promise<BrokerRequestScanResult>;
/** True when the broker should forward to the provider for a given decision. */
export declare function shouldForward(decision: GuardAction, approved: boolean): boolean;
/** For redact/approval decisions the provider must receive the redacted copy. */
export declare function messagesToForward(decision: GuardAction, original: BrokerMessage[], redacted: BrokerMessage[]): BrokerMessage[];
export interface BrokerResponseScanOptions {
    canaries?: Array<Pick<Canary, "id" | "token" | "hash" | "redactedPreview">>;
    placeholders?: string[];
}
export interface BrokerResponseScanResult extends OutputScanResult {
    contentHash: string;
    dangerousCommands: boolean;
    unsafeCode: boolean;
    exfiltration: boolean;
}
/**
 * Scan a provider response for secrets, canary leaks, dangerous terminal
 * commands, unsafe generated code, and exfiltration instructions.
 */
export declare function scanBrokerResponse(text: string, options?: BrokerResponseScanOptions): Promise<BrokerResponseScanResult>;
//# sourceMappingURL=BrokerScanner.d.ts.map