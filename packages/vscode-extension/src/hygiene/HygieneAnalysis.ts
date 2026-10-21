import { createHmac } from "node:crypto";
import { createVaultMigrationPlan } from "../firewall/VaultMigrationPlan";
import { sourceSyntaxForPath } from "../config-scanners/SourceSecretPlan";
import { isHygieneCandidate, normalizeHygieneName } from "./HygieneCandidatePolicy";
export const HYGIENE_PROVIDERS = ["openai", "anthropic", "google", "aws", "github", "stripe", "unknown"] as const;
export const HYGIENE_KINDS = ["api-key", "cloud-access", "private-key", "connection-string", "password", "token", "secret"] as const;
export type HygieneProvider = typeof HYGIENE_PROVIDERS[number];
export type HygieneKind = typeof HYGIENE_KINDS[number];
export const HYGIENE_EXPOSURE_ACTIONS = ["possible-project-exposure", "owner-reported-possible-exposure", "vaulted", "restored-after-owner-disclosure"] as const;
export const HYGIENE_LEDGER_ASSESSMENT = "Possible exposure metadata only; AI access and rotation are unverified.";
export interface HygieneInput { source: string; text: string; environment: boolean }
export interface HygieneFinding { id: string; fileRef: string; valueRef: string; line: number; kind: HygieneKind; provider: HygieneProvider; suggestions: readonly string[] }
export interface HygieneAnalysis { version: 1; fileRef: string; revision: string; assessment: string; findings: readonly HygieneFinding[] }
export function hygieneUnavailable(): never { throw Error("Hygiene operation unavailable; existing protection and records are preserved."); }
export function hygieneReference(key: Buffer, domain: string, value: string): string {
    if (!Buffer.isBuffer(key) || key.length !== 32) return hygieneUnavailable();
    return createHmac("sha256", key).update(domain + "\0").update(value, "utf8").digest("hex");
}
function provider(name: string, value: string): HygieneProvider {
    if (/ANTHROPIC|CLAUDE/.test(name) || /^sk-ant-/.test(value)) return "anthropic";
    if (/OPENAI/.test(name) || /^sk-(?:proj|svcacct)-/.test(value)) return "openai";
    if (/GEMINI|GOOGLE/.test(name)) return "google";
    if (/^AWS(?:_|$)/.test(name) || /^(?:AKIA|ASIA)[A-Z0-9]{16}$/.test(value)) return "aws";
    if (/GITHUB/.test(name) || /^gh[pousr]_/.test(value)) return "github";
    if (/STRIPE/.test(name) || /^(?:sk|rk)_(?:test|live)_/.test(value)) return "stripe";
    return "unknown";
}
function kind(type: string): HygieneKind {
    return type === "private_key" ? "private-key" : type === "database_url" ? "connection-string" : type === "password" ? "password"
        : type === "aws_access_key" ? "cloud-access" : /token/.test(type) ? "token" : /key/.test(type) ? "api-key" : "secret";
}
/** Private local processing only. Findings never include names, paths, values,
 * snippets or reversible value hashes. A candidate is not live validation. */
export function analyzeHygieneText(input: HygieneInput, key: Buffer): Readonly<HygieneAnalysis> {
    return analyze(input, key, false);
}
/** Fixed source-family parser; only trusted internal callers select this mode. */
export function analyzeSourceText(input: HygieneInput, key: Buffer): Readonly<HygieneAnalysis> {
    return analyze(input, key, true);
}
function analyze(input: HygieneInput, key: Buffer, sourceMode: boolean): Readonly<HygieneAnalysis> {
    try {
        if (!input || Object.getPrototypeOf(input) !== Object.prototype || Object.keys(input).sort().join(",") !== "environment,source,text"
            || Object.values(Object.getOwnPropertyDescriptors(input)).some(p => p.get || p.set)
            || typeof input.source !== "string" || !input.source || input.source.length > 2048 || /[\\:\x00-\x1f\x7f]/.test(input.source)
            || input.source.startsWith("/") || input.source.split("/").some(p => !p || p === "." || p === "..") || typeof input.environment !== "boolean"
            || typeof input.text !== "string" || Buffer.byteLength(input.text) > 65536 || input.text.includes("\0") || Buffer.from(input.text, "utf8").toString("utf8") !== input.text) return hygieneUnavailable();
        const fileRef = hygieneReference(key, "file", input.source), revision = hygieneReference(key, "revision", input.text);
        const syntax = sourceMode ? sourceSyntaxForPath(input.source) : undefined;
        if (sourceMode && (!syntax || input.environment)) return hygieneUnavailable();
        const plan = createVaultMigrationPlan(input.text, input.environment, "10000000-0000-4000-8000-000000000021", syntax);
        const findings: HygieneFinding[] = [], values: string[] = [];
        for (const candidate of plan.candidates) {
            const name = normalizeHygieneName(candidate.key);
            if (!isHygieneCandidate(candidate.key, candidate.rawValue)) continue;
            if (findings.length >= 128) return hygieneUnavailable();
            const valueRef = hygieneReference(key, "value", candidate.rawValue), id = hygieneReference(key, "finding", JSON.stringify([fileRef, candidate.start, valueRef]));
            const suggestions = Object.freeze(["review-vault", "move-to-owner-secret-store", ...(input.environment ? ["env-example"] : []), "rotation-checklist"]);
            findings.push(Object.freeze({ id, fileRef, valueRef, line: input.text.slice(0, candidate.start).split("\n").length, kind: kind(candidate.type), provider: provider(name, candidate.rawValue), suggestions }));
            values.push(candidate.rawValue);
        }
        const result: HygieneAnalysis = Object.freeze({ version: 1, fileRef, revision, assessment: "Heuristic candidates only; credential validity and AI access are unverified.", findings: Object.freeze(findings) });
        const encoded = JSON.stringify(result) + JSON.stringify([HYGIENE_LEDGER_ASSESSMENT, HYGIENE_EXPOSURE_ACTIONS,
            "rootRef", "keyTag", "rows", "firstSeen", "lastSeen", "lastAction", "observations"]);
        if (values.some(value => encoded.includes(value))) return hygieneUnavailable();
        return result;
    } catch { return hygieneUnavailable(); }
}
