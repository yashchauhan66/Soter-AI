import { randomBytes } from "node:crypto";
import { TextDecoder, types } from "node:util";
import { createScanner, ScanError, SyntaxKind } from "jsonc-parser";
import { RegisteredSecretMatcher } from "../../../core/src/RegisteredSecretMatcher";
import { parseStagedEntries, PRE_COMMIT_LIMITS } from "./PreCommitProtocol";
import { sourceSyntaxForPath } from "../config-scanners/SourceSecretPlan";
import { containerFormatForPath } from "../config-scanners/ContainerSecretPlan";
import { terraformFormatForPath } from "../config-scanners/TerraformSecretPlan";
import { registryFormatForPath } from "../config-scanners/RegistrySecretPlan";
import { serviceAccountFormatForPath } from "../config-scanners/ServiceAccountSecretPlan";
import { ciFormatForPath } from "../config-scanners/CiSecretPlan";
import { editorFormatForPath } from "../config-scanners/EditorSecretPlan";
import { mcpFormatForPath } from "../config-scanners/McpSecretPlan";
import { analyzeHygieneText, analyzeSourceText, analyzeContainerText, analyzeTerraformText, analyzeRegistryText,
    analyzeServiceAccountText, analyzeCiText, analyzeEditorText, analyzeMcpText, type HygieneAnalysis } from "../hygiene/HygieneAnalysis";

type Status = "CLEAN" | "CANDIDATE" | "UNAVAILABLE";
type Analysis = (input: { source: string; text: string; environment: boolean }, key: Buffer) => Readonly<HygieneAnalysis>;
const result = (status: Status): Readonly<{ status: Status }> => Object.freeze({ status });
const sizeOf = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength")!.get!;
const unsafe = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\p{Bidi_Control}]/u;
function validText(value: string): boolean { return !unsafe.test(value) && Buffer.from(value, "utf8").toString("utf8") === value; }
/** Existing fixed parsers remain syntax/credential authority. The canonical
 * lexer adds bounded decoded-string safety checks without interpreting config. */
function safeJsonStrings(text: string): boolean {
    const scanner = createScanner(text, false); let work = 0;
    for (;;) {
        const token = scanner.scan();
        if (++work > 32768 || scanner.getTokenError() !== ScanError.None || token === SyntaxKind.Unknown) return false;
        if (token === SyntaxKind.StringLiteral && !validText(scanner.getTokenValue())) return false;
        if (token === SyntaxKind.EOF) return true;
    }
}
/** Private, request-local, heuristic-only classification. This grants no index
 * or commit authority and performs no filesystem, child or reference I/O. */
export function inspectStagedBlob(source: string, raw: Buffer): Readonly<{ status: Status }> {
    let key: Buffer | undefined;
    try {
        if (typeof source !== "string" || Buffer.byteLength(source) > PRE_COMMIT_LIMITS.pathBytes
            || !parseStagedEntries(Buffer.from("100644 " + "0".repeat(40) + " 0\t" + source + "\0"))?.length
            || !types.isUint8Array(raw) || !Buffer.isBuffer(raw)) return result("UNAVAILABLE");
        const size: number = sizeOf.call(raw); if (size > PRE_COMMIT_LIMITS.blobBytes) return result("UNAVAILABLE");
        const copy = new Uint8Array(size); Uint8Array.prototype.set.call(copy, raw);
        const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(copy);
        if (!validText(text)) return result("UNAVAILABLE");
        const name = source.split("/").at(-1)!, environment = /^\.env(?:\..*)?$/i.test(name);
        let analysis: Analysis | undefined;
        if (environment) analysis = analyzeHygieneText;
        else if (mcpFormatForPath(source)) analysis = analyzeMcpText;
        else if (editorFormatForPath(source)) analysis = analyzeEditorText;
        else if (terraformFormatForPath(source)) analysis = analyzeTerraformText;
        else if (registryFormatForPath(source)) analysis = analyzeRegistryText;
        else if (ciFormatForPath(source)) analysis = analyzeCiText;
        else if (containerFormatForPath(source)) analysis = analyzeContainerText;
        else if (sourceSyntaxForPath(source)) analysis = analyzeSourceText;
        else if (serviceAccountFormatForPath(source)) analysis = analyzeServiceAccountText;
        else if (!/\.(?:txt|md|log)$/i.test(name) && name.lastIndexOf(".") > 0) return result("UNAVAILABLE");
        // JSONC/fixed-family parsers validate complete grammar separately; no
        // matching prefix can override malformed or unsafe later semantics.
        if (/\.json$/i.test(name) && !safeJsonStrings(text)) return result("UNAVAILABLE");
        let candidate = false;
        if (analysis) { key = randomBytes(32); candidate = analysis({ source, text, environment }, key).findings.length > 0; }
        const matched = new RegisteredSecretMatcher([]).inspectRequest([text]);
        if (matched.status === "WITHHELD") return result("UNAVAILABLE");
        return result(candidate || matched.status === "MATCHED" ? "CANDIDATE" : "CLEAN");
    } catch { return result("UNAVAILABLE"); }
    finally { key?.fill(0); }
}
