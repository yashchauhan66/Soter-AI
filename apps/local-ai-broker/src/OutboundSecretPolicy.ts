import { findUnredactedSecrets } from "../../../packages/guard-core/src/Redactor";
import { decodeBoundedJson } from "./BoundedJson";
import { GatewayPolicyError, GATEWAY_LIMITS } from "./GatewayBoundary";
import { performance } from "node:perf_hooks";

export const OUTBOUND_SECRET_LIMITS = Object.freeze({ values: 8192, decodedBytes: 524288, jsonLayers: 4, depth: 32 });

/** Inspect the exact serialized body subsequently passed to fetch. Semantic
 * string inspection includes bounded JSON embedded in tool arguments/metadata.
 * Does not mutate protocol objects, persist content, or infer arbitrary encoding. */
export function assertSafeOutboundJson(wire: string): void {
    const start = performance.now();
    let inspectedValues = 0, decodedBytes = 0;
    const limit = (): never => { throw new GatewayPolicyError("gateway_limit"); };
    const checkTime = (): void => {
        if (performance.now() - start > GATEWAY_LIMITS.inspectionMs) limit();
    };
    const inspect = (text: string): void => {
        decodedBytes += Buffer.byteLength(text, "utf8");
        if (decodedBytes > OUTBOUND_SECRET_LIMITS.decodedBytes) limit();
        checkTime();
        if (findUnredactedSecrets(text).length) throw new GatewayPolicyError("gateway_sensitive");
        checkTime();
    };
    try {
        if (typeof wire !== "string" || Buffer.byteLength(wire, "utf8") > GATEWAY_LIMITS.bytes) limit();
        const parsed = decodeBoundedJson(Buffer.from(wire), { maxBytes: GATEWAY_LIMITS.bytes });
        inspect(wire);
        if (parsed.canonical !== wire) inspect(parsed.canonical);
        const queue: Array<{ value: unknown; depth: number; layers: number }> = [{ value: parsed.body, depth: 0, layers: 0 }];
        while (queue.length) {
            checkTime();
            const { value, depth, layers } = queue.pop()!;
            if (++inspectedValues > OUTBOUND_SECRET_LIMITS.values || depth > OUTBOUND_SECRET_LIMITS.depth) limit();
            if (typeof value === "string") {
                inspect(value);
                const trimmed = value.trim();
                if (!["{", "[", '"'].includes(trimmed[0])) continue;
                // Ordinary text that starts with punctuation is still text.
                // Valid nested JSON must pass the duplicate/depth/UTF-8 boundary.
                try { JSON.parse(trimmed); } catch { checkTime(); continue; }
                checkTime();
                if (layers >= OUTBOUND_SECRET_LIMITS.jsonLayers) limit();
                const decoded = decodeBoundedJson(Buffer.from('{"value":' + trimmed + '}'), { maxBytes: GATEWAY_LIMITS.bytes });
                inspect(decoded.canonical);
                queue.push({ value: decoded.body.value, depth: depth + 1, layers: layers + 1 });
            } else if (Array.isArray(value)) {
                for (const child of value) queue.push({ value: child, depth: depth + 1, layers });
            } else if (value && typeof value === "object") {
                for (const [key, child] of Object.entries(value)) {
                    inspect(key);
                    queue.push({ value: child, depth: depth + 1, layers });
                }
            }
            if (queue.length + inspectedValues > OUTBOUND_SECRET_LIMITS.values) limit();
        }
        checkTime();
    } catch (error) {
        if (error instanceof GatewayPolicyError) throw error;
        throw new GatewayPolicyError("gateway_schema_unsupported");
    }
}
