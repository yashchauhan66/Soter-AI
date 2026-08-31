/** Default ceiling for one broker JSON response. Broker status/verdict payloads are small. */
export const MAX_BROKER_RESPONSE_BYTES = 1024 * 1024;

/**
 * Read an HTTP response without allowing a compromised local peer to make the
 * extension host buffer an unbounded body. The stream is cancelled as soon as
 * the limit is crossed so the sender is not allowed to continue consuming work.
 */
export async function readBoundedResponseBody(
    response: Response,
    maxBytes = MAX_BROKER_RESPONSE_BYTES,
): Promise<string> {
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
        throw new Error("Response byte limit must be a positive safe integer");
    }

    const declared = response.headers.get("content-length");
    if (declared !== null) {
        const bytes = Number(declared);
        if (Number.isFinite(bytes) && bytes > maxBytes) {
            await response.body?.cancel().catch(() => undefined);
            throw new Error(`Broker response exceeds ${maxBytes} bytes`);
        }
    }

    if (!response.body) return "";
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let total = 0;
    let text = "";
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            total += value.byteLength;
            if (total > maxBytes) {
                await reader.cancel().catch(() => undefined);
                throw new Error(`Broker response exceeds ${maxBytes} bytes`);
            }
            text += decoder.decode(value, { stream: true });
        }
        text += decoder.decode();
        return text;
    } catch (error) {
        await reader.cancel().catch(() => undefined);
        if (error instanceof TypeError) throw new Error("Broker returned invalid UTF-8");
        throw error;
    } finally {
        reader.releaseLock();
    }
}