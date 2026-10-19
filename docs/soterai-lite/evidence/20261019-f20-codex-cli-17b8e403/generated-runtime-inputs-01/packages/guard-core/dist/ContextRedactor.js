"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redactAIContext = redactAIContext;
const Redactor_1 = require("./Redactor");
const OMITTED = "[encoded or oversized content withheld by SoterAI]";
/**
 * Best-effort content redaction for our own context and previews. Recognised
 * secrets hidden by common encodings withhold the whole item: transformed
 * offsets cannot safely be applied to the original. Never evaluate source code.
 * Unknown private prose, arbitrary ciphers and cross-request splitting remain
 * outside this detector. Use a path/region deny or isolation for that data.
 */
function redactAIContext(text) {
    if (text.length > 1024 * 1024)
        return OMITTED;
    const redacted = (0, Redactor_1.redactForSharing)(text);
    // Mask our own placeholders while normalizing; stripping their brackets can
    // manufacture a token-shaped value from "Token: [REDACTED_GITHUB_TOKEN]".
    const stripped = redacted.replace(/\[REDACTED_[A-Z0-9_]+\]/g, "<masked>")
        .normalize("NFKC").replace(/[\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, "");
    const packed = stripped.replace(/[\s'"`,+\[\]]/g, "");
    for (const view of [stripped, packed]) {
        if (view !== redacted && (0, Redactor_1.findSurvivingSecrets)(view).length)
            return OMITTED;
    }
    try {
        const decoded = decodeURIComponent(stripped);
        if (decoded !== stripped && (0, Redactor_1.findSurvivingSecrets)(decoded).length)
            return OMITTED;
    }
    catch { /* Invalid percent sequences are ordinary text. */ }
    const unescaped = stripped.replace(/\\x([a-f0-9]{2})|\\u([a-f0-9]{4})/gi, (_match, byte, unit) => String.fromCharCode(parseInt(byte ?? unit, 16)));
    if (unescaped !== stripped && (0, Redactor_1.findSurvivingSecrets)(unescaped).length)
        return OMITTED;
    let candidates = 0;
    // Decode original bytes: the PII pass may otherwise alter digit-heavy hex
    // before it can be recognized as an encoded credential.
    const encodedSource = text.normalize("NFKC").replace(/[\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, "");
    for (const match of encodedSource.matchAll(/[A-Za-z0-9+/_-]{24,}={0,2}/g)) {
        if (++candidates > 256 || match[0].length > 16 * 1024)
            return OMITTED;
        const raw = match[0];
        const encodings = /^[a-f0-9]+$/i.test(raw) && raw.length % 2 === 0 ? ["hex", "base64"] : ["base64"];
        for (const encoding of encodings) {
            try {
                const bytes = encoding === "hex"
                    ? Uint8Array.from(raw.match(/../g) ?? [], pair => parseInt(pair, 16))
                    : Uint8Array.from(atob(raw.replace(/-/g, "+").replace(/_/g, "/")), char => char.charCodeAt(0));
                if ((0, Redactor_1.findSurvivingSecrets)(new TextDecoder().decode(bytes)).length)
                    return OMITTED;
            }
            catch { /* Not a valid encoding. */ }
        }
    }
    return redacted;
}
//# sourceMappingURL=ContextRedactor.js.map