/** A configured upstream is the only allowed destination; requests cannot override it. */
export function validateProviderTarget(value: string): string {
    let url: URL;
    try { url = new URL(value); } catch { throw new Error("Provider URL must be absolute."); }
    const loopback = url.hostname === "127.0.0.1" || url.hostname === "[::1]";
    if (url.username || url.password || url.hash
        || (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))) {
        throw new Error("Use HTTPS, or an explicit loopback IP for a local provider; URL credentials and fragments are forbidden.");
    }
    return url.href;
}

export const MAX_PROVIDER_RESPONSE_BYTES = 2 * 1024 * 1024;

/** Bound decompressed bytes even when Content-Length is absent or dishonest. */
export async function readProviderBody(response: Response): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Provider returned no body.");
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let bytes = 0;
    const parts: string[] = [];
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > MAX_PROVIDER_RESPONSE_BYTES) throw new Error("Provider response exceeds the local scan limit.");
            parts.push(decoder.decode(value, { stream: true }));
        }
        parts.push(decoder.decode());
        return parts.join("");
    } catch (error) {
        try { await reader.cancel(); } catch { /* already aborted */ }
        throw error;
    } finally { reader.releaseLock(); }
}
