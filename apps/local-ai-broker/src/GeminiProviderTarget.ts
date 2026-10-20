import { validateProviderTarget } from "./ProviderTarget";
import { validGeminiModel } from "./GeminiGenerateContentSchema";

/** A reviewed upstream base only. Neither native nor internal requests can
 * supply a host, path prefix, query credential or alternate Google operation. */
export function validateGeminiProviderBase(value: string): string {
    const url = new URL(validateProviderTarget(value));
    if (url.pathname !== "/" || url.search) throw Error("Gemini provider requires an absolute base without a path or query.");
    return url.href;
}
export function geminiProviderTarget(base: string, model: unknown): string {
    if (!validGeminiModel(model)) throw Error("Gemini model unavailable.");
    return new URL("v1beta/models/" + model + ":streamGenerateContent?alt=sse", validateGeminiProviderBase(base)).href;
}
