/**
 * Best-effort content redaction for our own context and previews. Recognised
 * secrets hidden by common encodings withhold the whole item: transformed
 * offsets cannot safely be applied to the original. Never evaluate source code.
 * Unknown private prose, arbitrary ciphers and cross-request splitting remain
 * outside this detector. Use a path/region deny or isolation for that data.
 */
export declare function redactAIContext(text: string): string;
//# sourceMappingURL=ContextRedactor.d.ts.map