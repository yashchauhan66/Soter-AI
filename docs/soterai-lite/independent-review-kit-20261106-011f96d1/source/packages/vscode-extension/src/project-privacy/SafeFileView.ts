import { isSensitiveFilePath, redactAIContext } from "@soterai/guard-core";

export type FileViewKind = "environment-schema" | "sensitive-summary" | "redacted-file";
export interface SafeFileView { kind: FileViewKind; text: string; fieldCount: number }
export const MASKED = "[MASKED]";
export const MAX_FILE_BYTES = 64 * 1024;

export function isEnvironmentFile(relativePath: string): boolean {
    return /(?:^|[\\/])\.env(?:\.[^\\/]+)?$/i.test(relativePath);
}

/** Only names cross this boundary. No comments, values, lengths or URL fragments. */
export function environmentSchema(input: string): SafeFileView {
    if (Buffer.byteLength(input, "utf8") > MAX_FILE_BYTES || input.includes("\0")) {
        throw new Error("Unsupported environment file.");
    }
    const names = new Set<string>();
    let multilineQuote: string | undefined;
    for (const line of input.replace(/^\uFEFF/, "").split(/\r?\n/)) {
        if (multilineQuote) {
            if (closesQuotedValue(line, multilineQuote)) multilineQuote = undefined;
            continue;
        }
        const match = /^[ \t]*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]{0,127})[ \t]*=(.*)$/.exec(line);
        if (match) {
            names.add(match[1]);
            const value = match[2].trimStart();
            if (["'", '"', "`"].includes(value[0]) && !closesQuotedValue(value.slice(1), value[0])) {
                multilineQuote = value[0];
            }
        }
        if (names.size > 256) throw new Error("Too many environment fields.");
    }
    return { kind: "environment-schema", fieldCount: names.size,
        text: names.size ? [...names].map(name => `${name}=${MASKED}`).join("\n")
            : "[Sensitive environment content withheld; no supported variable names found.]" };
}

/** Assignment-looking lines inside a quoted value are value data, never names. */
function closesQuotedValue(text: string, quote: string): boolean {
    let escaped = false;
    for (const character of text) {
        if (escaped) { escaped = false; continue; }
        if (character === "\\") { escaped = true; continue; }
        if (character === quote) return true;
    }
    return false;
}

/** This is a local safe-view builder, not universal private-text detection. */
export function buildSafeFileView(relativePath: string, input: string, markedSensitive = false, originalContent = input): SafeFileView {
    if (Buffer.byteLength(input, "utf8") > MAX_FILE_BYTES || input.includes("\0")) throw new Error("Unsupported file.");
    // Replacing protected syntax can turn multiline value data into apparent variable names.
    // Withhold the schema instead of parsing a modified dotenv representation.
    if (isEnvironmentFile(relativePath) && input !== originalContent) {
        return { kind: "sensitive-summary", fieldCount: 0, text: "[MASKED: environment schema withheld because protected regions apply.]" };
    }
    if (isEnvironmentFile(relativePath)) return environmentSchema(input);
    if (markedSensitive || isSensitiveFilePath(relativePath)) {
        return { kind: "sensitive-summary", fieldCount: 0, text: "[MASKED: sensitive file contents withheld.]" };
    }
    return { kind: "redacted-file", fieldCount: 0, text: redactAIContext(input) };
}

/** Prevent terminal control/clipboard escape sequences in released file text. */
export function terminalSafeText(text: string): string {
    return text.replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "");
}
